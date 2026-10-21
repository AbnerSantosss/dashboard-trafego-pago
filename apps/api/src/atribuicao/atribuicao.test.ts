/**
 * Tag de atribuição com o Postgres local: o toque é gravado, a primeira página da sessão vira
 * `visita` e um cadastro do webhook sem utm herda a campanha e o canal do toque do lead.
 */
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../app.js';
import { bancoDisponivel, URL_APP } from '../auth/banco-teste.js';
import {
  attributionTouches,
  comTenant,
  criarDb,
  events,
  rules,
  sources,
  tenants,
  webhookEvents,
} from '../db/client.js';
import { carregarEnv } from '../env.js';
import { processarWebhookEvent } from '../rules/processar.js';
import { canalDoToque } from './toques.js';

const disponivel = await bancoDisponivel('atribuicao/atribuicao.test');

describe('canalDoToque', () => {
  it('click id vence utm; sem click id usa as regras de canal', () => {
    expect(canalDoToque({ gclid: 'x', utmSource: 'facebook' })).toBe('Google');
    expect(canalDoToque({ fbp: 'fb.1.2.3' })).toBe('Meta');
    expect(canalDoToque({ ttclid: 'x' })).toBe('TikTok');
    expect(canalDoToque({ kwaiClickId: 'x' })).toBe('Kwai');
    expect(canalDoToque({ tblci: 'x' })).toBe('Taboola');
    expect(canalDoToque({ utmSource: 'instagram' })).toBe('Meta');
    expect(canalDoToque({})).toBe('Outros');
  });
});

describe.skipIf(!disponivel)('tag de atribuição', () => {
  let app: App;
  const db = criarDb(URL_APP, { max: 2 });
  const slug = `teste-tag-${randomUUID().slice(0, 8)}`;
  let tenantId = '';
  let sourceId = '';

  beforeAll(async () => {
    const [t] = await db
      .insert(tenants)
      .values({ slug, nome: 'Tag (teste)' })
      .returning({ id: tenants.id });
    tenantId = t!.id;
    sourceId = await comTenant(db, tenantId, async (tx) => {
      const [s] = await tx
        .insert(sources)
        .values({ tenantId, slug: 'f', nome: 'Fonte', secretHash: 'x', rulesVersion: 1 })
        .returning({ id: sources.id });
      await tx.insert(rules).values({
        tenantId,
        sourceId: s!.id,
        version: 1,
        ativo: true,
        mapping: {
          version: 1,
          regras: [
            {
              match: { path: '$.event', equals: 'signup' },
              type: 'cadastro',
              fields: {
                occurred_at: { path: '$.created_at', format: 'iso' },
                lead_key: { path: '$.user_id' },
              },
            },
          ],
        },
      });
      return s!.id;
    });
    app = await buildApp({
      env: carregarEnv({ NODE_ENV: 'test', DATABASE_URL: URL_APP }),
      logger: false,
      atribuicao: { atrasoAgregacaoMs: 0 },
    });
  });

  afterAll(async () => {
    await app?.close();
    if (tenantId) await db.delete(tenants).where(inArray(tenants.id, [tenantId]));
    await db.$client.end({ timeout: 5 });
  });

  const enviar = (corpo: unknown, empresa = slug) =>
    app.inject({
      method: 'POST',
      url: `/t/${empresa}/clk`,
      headers: { 'content-type': 'text/plain' },
      payload: JSON.stringify(corpo),
    });

  it('grava o toque, gera visita na 1ª página e ignora templates do GTM', async () => {
    const r = await enviar({
      tipo: 'page_view',
      cv: 1,
      visitor_id: 'v1',
      user_id: 'jogador-42',
      fbclid: 'abc',
      utm_source: 'facebook',
      utm_campaign: 'black-friday',
      utm_content: '{{Click Text}}',
      url: 'https://site.test/?utm_source=facebook',
    });
    expect(r.statusCode).toBe(204);
    expect(r.headers['access-control-allow-origin']).toBe('*');
    expect(r.headers['access-control-allow-credentials']).toBeUndefined();

    const toques = await comTenant(db, tenantId, (tx) => tx.select().from(attributionTouches));
    expect(toques).toHaveLength(1);
    expect(toques[0]).toMatchObject({ leadKey: 'jogador-42', fbclid: 'abc', utmContent: null });

    const visitas = await comTenant(db, tenantId, (tx) =>
      tx.select().from(events).where(eq(events.type, 'visita')),
    );
    expect(visitas).toHaveLength(1);
    expect(visitas[0]).toMatchObject({ channel: 'Meta', campaign: 'black-friday' });

    // Sem cv, só o toque.
    await enviar({ tipo: 'page_view', visitor_id: 'v1', user_id: 'jogador-42' });
    const depois = await comTenant(db, tenantId, (tx) =>
      tx.select().from(events).where(eq(events.type, 'visita')),
    );
    expect(depois).toHaveLength(1);
  });

  it('empresa inexistente dá 404; corpo inválido não derruba', async () => {
    expect((await enviar({}, 'nao-existe-xyz')).statusCode).toBe(404);
    const r = await app.inject({
      method: 'POST',
      url: `/t/${slug}/clk`,
      headers: { 'content-type': 'text/plain' },
      payload: 'isto não é json',
    });
    expect(r.statusCode).toBe(204);
  });

  it('cadastro do webhook sem utm herda campanha e canal do toque do lead', async () => {
    const id = await comTenant(db, tenantId, async (tx) => {
      const [w] = await tx
        .insert(webhookEvents)
        .values({
          tenantId,
          sourceId,
          eventKey: randomUUID(),
          payload: { event: 'signup', created_at: new Date().toISOString(), user_id: 'jogador-42' },
        })
        .returning({ id: webhookEvents.id });
      return w!.id;
    });
    const r = await processarWebhookEvent(db, { tenantId, webhookEventId: id });
    expect(r.status).toBe('processado');
    const [cad] = await comTenant(db, tenantId, (tx) =>
      tx.select().from(events).where(eq(events.type, 'cadastro')),
    );
    expect(cad).toMatchObject({
      leadKey: 'jogador-42',
      channel: 'Meta',
      campaign: 'black-friday',
      utmSource: 'facebook',
    });
  });
});
