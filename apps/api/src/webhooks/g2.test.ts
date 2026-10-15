/**
 * Gate G2: isolamento entre empresas de ponta a ponta na ingestão.
 * A = empresa sem membership do usuário (t3); B = empresa onde o usuário é admin (t2).
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { bancoDisponivel, criarCenario, type Cenario } from '../auth/banco-teste.js';
import { emitirToken } from '../auth/plugin.js';
import {
  comTenant,
  events,
  metricsDaily,
  rules,
  sources,
  webhookEvents,
  type Db,
} from '../db/client.js';
import { processarWebhookEvent } from '../rules/processar.js';
import { criarWorker } from './worker.js';
import {
  appWebhooks,
  criarFonte,
  dbTeste,
  requisicaoAssinada,
  type FonteTeste,
} from './teste-util.js';

const disponivel = await bancoDisponivel('webhooks/g2.test');

describe.skipIf(!disponivel)('gate G2: isolamento de webhooks entre empresas', () => {
  let c: Cenario;
  let db: Db;
  let a: FonteTeste;
  let b: FonteTeste;
  let app: App;
  let idA = '';

  beforeAll(async () => {
    c = await criarCenario(['leitor', 'admin']);
    db = dbTeste();
    a = await criarFonte(db, c.t3, 'demo');
    b = await criarFonte(db, c.t2, 'demo');
    expect(a.segredo).not.toBe(b.segredo);
    ({ app } = await appWebhooks([a, b]));
    const res = await app.inject(
      requisicaoAssinada(a.tenantSlug, 'demo', a.segredo, {
        eventId: 'g2-evt',
        corpo: { event: 'first_deposit', amount: 10000, user: { id: 'lead-a' } },
      }),
    );
    expect(res.statusCode).toBe(202);
    idA = res.json().id;
  });

  afterAll(async () => {
    await app?.close();
    await db?.$client.end({ timeout: 5 });
    await c?.limpar();
  });

  it('(1) aparece em webhook_events de A sob RLS de A', async () => {
    const linhas = await comTenant(db, a.tenantId, (tx) =>
      tx.select().from(webhookEvents).where(eq(webhookEvents.id, idA)),
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.tenantId).toBe(a.tenantId);
  });

  it('(2) sob RLS de B não aparece nada de A', async () => {
    const porId = await comTenant(db, b.tenantId, (tx) =>
      tx.select().from(webhookEvents).where(eq(webhookEvents.id, idA)),
    );
    expect(porId).toHaveLength(0);
    const todos = await comTenant(db, b.tenantId, (tx) => tx.select().from(webhookEvents));
    expect(todos.every((l) => l.tenantId === b.tenantId)).toBe(true);
  });

  it('(3) assinatura de A no endpoint de B → 401', async () => {
    const res = await app.inject(requisicaoAssinada(b.tenantSlug, 'demo', a.segredo));
    expect(res.statusCode).toBe(401);
    expect(res.json().erro.codigo).toBe('assinatura_invalida');
  });

  it('(4) usuário só de B não vê entregas de A', async () => {
    const tok = emitirToken(app, { sub: c.usuario.id, email: c.usuario.email, tenant: b.tenantId });
    const h = { authorization: `Bearer ${tok}` };
    const deB = await app.inject({
      method: 'GET',
      url: `/webhooks/${b.tenantSlug}/demo/entregas`,
      headers: h,
    });
    expect(deB.statusCode).toBe(200);
    expect(deB.json().entregas.map((e: { id: string }) => e.id)).not.toContain(idA);
    // Pedir a URL de A com empresa ativa B → 404; trocar x-tenant para A → 403.
    const urlA = `/webhooks/${a.tenantSlug}/demo/entregas`;
    expect((await app.inject({ method: 'GET', url: urlA, headers: h })).statusCode).toBe(404);
    const comXTenant = await app.inject({
      method: 'GET',
      url: urlA,
      headers: { ...h, 'x-tenant': a.tenantSlug },
    });
    expect(comXTenant.statusCode).toBe(403);
  });

  it('(5) mesmo X-Event-Id em A e B são eventos distintos', async () => {
    const res = await app.inject(
      requisicaoAssinada(b.tenantSlug, 'demo', b.segredo, { eventId: 'g2-evt' }),
    );
    expect(res.statusCode).toBe(202);
    expect(res.json().id).not.toBe(idA);
    const dup = await app.inject(
      requisicaoAssinada(a.tenantSlug, 'demo', a.segredo, { eventId: 'g2-evt' }),
    );
    expect(dup.statusCode).toBe(200);
    expect(dup.json().id).toBe(idA);
  });

  it('(6) processado de verdade em A cria events e metrics_daily só sob A', async () => {
    await comTenant(db, a.tenantId, async (tx) => {
      await tx.insert(rules).values({
        tenantId: a.tenantId,
        sourceId: a.sourceId,
        version: 1,
        ativo: true,
        mapping: {
          version: 1,
          regras: [
            {
              match: { path: '$.event', equals: 'first_deposit' },
              type: 'ftd',
              fields: {
                occurred_at: { path: '$.created_at', format: 'iso' },
                value: { path: '$.amount', divide: 100 },
                lead_key: { path: '$.user.id' },
                utm_source: { path: '$.utm.source', lower: true },
              },
            },
          ],
        },
      });
      await tx.update(sources).set({ rulesVersion: 1 }).where(eq(sources.id, a.sourceId));
    });
    const res = await app.inject(
      requisicaoAssinada(a.tenantSlug, 'demo', a.segredo, {
        eventId: 'g2-e2e',
        corpo: {
          event: 'first_deposit',
          created_at: '2026-05-11T15:00:00Z',
          amount: 25000,
          user: { id: 'lead-e2e' },
          utm: { source: 'Facebook' },
        },
      }),
    );
    expect(res.statusCode).toBe(202);
    const id = res.json().id as string;
    const w = criarWorker({ db, processar: processarWebhookEvent });
    await expect(
      w.tratarProcessar({ data: { tenantId: a.tenantId, webhookEventId: id }, retryCount: 0 }),
    ).resolves.toMatchObject({ status: 'processado' });

    const evA = await comTenant(db, a.tenantId, (tx) =>
      tx.select().from(events).where(eq(events.webhookEventId, id)),
    );
    expect(evA.length).toBeGreaterThan(0);
    const mA = await comTenant(db, a.tenantId, (tx) => tx.select().from(metricsDaily));
    expect(mA.length).toBeGreaterThan(0);

    const evB = await comTenant(db, b.tenantId, (tx) =>
      tx.select().from(events).where(eq(events.webhookEventId, id)),
    );
    expect(evB).toHaveLength(0);
    const mB = await comTenant(db, b.tenantId, (tx) => tx.select().from(metricsDaily));
    expect(mB.filter((m) => m.tenantId === a.tenantId)).toHaveLength(0);
    expect(mB).toHaveLength(0);
  });
});
