/**
 * Processamento de brutos com o Postgres local (pula com aviso se o banco não responder).
 * Lento (10 mil eventos): `TESTE_LENTO=1 pnpm --filter @trafego/api test src/rules`.
 */
import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoDisponivel, URL_APP } from '../auth/banco-teste.js';
import {
  comTenant,
  criarDb,
  events,
  metricsDaily,
  rules,
  sources,
  tenants,
  webhookEvents,
} from '../db/client.js';
import { reagregarDias } from './agregar.js';
import { processarWebhookEvent } from './processar.js';
import { reprocessarFonte } from './reprocessar.js';

const disponivel = await bancoDisponivel('rules/processar.test');

const MAPEAMENTO = {
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
        campaign: { path: '$.utm.campaign' },
      },
    },
    {
      match: { path: '$.event', in: ['signup', 'first_deposit'] },
      type: 'cadastro',
      fields: {
        occurred_at: { path: '$.created_at', format: 'iso' },
        lead_key: { path: '$.user.id' },
        utm_source: { path: '$.utm.source', lower: true },
        campaign: { path: '$.utm.campaign' },
      },
    },
    {
      match: { path: '$.event', equals: 'click' },
      type: 'clique',
      fields: {
        occurred_at: { path: '$.created_at', format: 'iso' },
        utm_medium: { path: '$.m' },
        base: { path: '$.base' },
      },
    },
    {
      match: { path: '$.event', equals: 'spend' },
      type: 'gasto',
      fields: {
        occurred_at: { path: '$.created_at', format: 'iso' },
        value: { path: '$.amount' },
        utm_source: { path: '$.utm.source', lower: true },
        campaign: { path: '$.utm.campaign' },
      },
    },
  ],
};

const ftd = (n: number, quando = '2024-05-11T02:30:00Z') => ({
  event: 'first_deposit',
  created_at: quando, // 23h30 do dia 10 em São Paulo
  amount: 10000 + n,
  user: { id: `u${n}` },
  utm: { source: 'Facebook', campaign: 'c1' },
});

describe.skipIf(!disponivel)('processarWebhookEvent', () => {
  const db = criarDb(URL_APP, { max: 3 });
  const sufixo = randomUUID().slice(0, 8);
  const empresa = { a: '', b: '' };
  const fonte = { a: '', b: '' };

  async function criarEmpresa(rotulo: string) {
    const [t] = await db
      .insert(tenants)
      .values({ slug: `teste-regras-${rotulo}-${sufixo}`, nome: `Regras ${rotulo}` })
      .returning({ id: tenants.id });
    const tenantId = t!.id;
    const sourceId = await comTenant(db, tenantId, async (tx) => {
      const [s] = await tx
        .insert(sources)
        .values({ tenantId, slug: 'f', nome: 'Fonte', secretHash: 'x', rulesVersion: 1 })
        .returning({ id: sources.id });
      await tx
        .insert(rules)
        .values({ tenantId, sourceId: s!.id, version: 1, mapping: MAPEAMENTO, ativo: true });
      return s!.id;
    });
    return { tenantId, sourceId };
  }

  async function bruto(tenantId: string, sourceId: string, payload: unknown) {
    return comTenant(db, tenantId, async (tx) => {
      const [w] = await tx
        .insert(webhookEvents)
        .values({ tenantId, sourceId, eventKey: randomUUID(), payload })
        .returning({ id: webhookEvents.id });
      return w!.id;
    });
  }

  beforeAll(async () => {
    const a = await criarEmpresa('a');
    const b = await criarEmpresa('b');
    empresa.a = a.tenantId;
    fonte.a = a.sourceId;
    empresa.b = b.tenantId;
    fonte.b = b.sourceId;
  });

  afterAll(async () => {
    const ids = [empresa.a, empresa.b].filter(Boolean);
    if (ids.length) await db.delete(tenants).where(inArray(tenants.id, ids));
    await db.$client.end({ timeout: 5 });
  });

  const metricas = (tenantId: string) =>
    comTenant(db, tenantId, (tx) => tx.select().from(metricsDaily));

  it('grava events e metrics_daily no dia do fuso; reprocessar não duplica', async () => {
    const id = await bruto(empresa.a, fonte.a, ftd(1));
    const r = await processarWebhookEvent(db, { tenantId: empresa.a, webhookEventId: id });
    expect(r).toEqual({ status: 'processado', eventos: 2 });

    const r2 = await processarWebhookEvent(db, { tenantId: empresa.a, webhookEventId: id });
    expect(r2.status).toBe('processado');

    const evs = await comTenant(db, empresa.a, (tx) =>
      tx.select().from(events).where(eq(events.webhookEventId, id)),
    );
    expect(evs.map((e) => e.type).sort()).toEqual(['cadastro', 'ftd']);
    expect(evs.every((e) => e.channel === 'Meta')).toBe(true);

    const m = await metricas(empresa.a);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({
      day: '2024-05-10',
      channel: 'Meta',
      campaign: 'c1',
      page: '',
      ftds: 1,
      cadastros: 1,
      ftdsValor: '100.01',
      depositos: '100.01',
      investimento: null,
    });

    const [w] = await comTenant(db, empresa.a, (tx) =>
      tx.select().from(webhookEvents).where(eq(webhookEvents.id, id)),
    );
    expect(w).toMatchObject({ status: 'processado', erro: null, tentativas: 2 });
    expect(w!.processedAt).toBeInstanceOf(Date);
  });

  it('gasto soma investimento na mesma linha', async () => {
    const id = await bruto(empresa.a, fonte.a, {
      event: 'spend',
      created_at: '2024-05-10T15:00:00-03:00',
      amount: '250,50',
      utm: { source: 'meta', campaign: 'c1' },
    });
    await processarWebhookEvent(db, { tenantId: empresa.a, webhookEventId: id });
    const m = await metricas(empresa.a);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ investimento: '250.50', ftds: 1 });
  });

  it('clique com base=true vai para base_contatada, não para cliques', async () => {
    const quando = '2024-05-20T15:00:00Z';
    for (const base of [true, true, false]) {
      const id = await bruto(empresa.a, fonte.a, {
        event: 'click',
        created_at: quando,
        m: 'email',
        base,
      });
      await processarWebhookEvent(db, { tenantId: empresa.a, webhookEventId: id });
    }
    const evs = await comTenant(db, empresa.a, (tx) =>
      tx.select().from(events).where(eq(events.type, 'clique')),
    );
    expect(evs.filter((e) => e.base)).toHaveLength(2);
    const l = (await metricas(empresa.a)).find((m) => m.day === '2024-05-20');
    expect(l).toMatchObject({ channel: 'Email', baseContatada: 2, cliques: 1 });
  });

  it('erro de regra fica com status erro e motivo, sem lançar', async () => {
    const id = await bruto(empresa.a, fonte.a, { event: 'desconhecido' });
    const r = await processarWebhookEvent(db, { tenantId: empresa.a, webhookEventId: id });
    expect(r.status).toBe('erro');
    expect(r.motivo).toMatch(/Nenhum bloco de regra/);
    const [w] = await comTenant(db, empresa.a, (tx) =>
      tx.select().from(webhookEvents).where(eq(webhookEvents.id, id)),
    );
    expect(w).toMatchObject({ status: 'erro', tentativas: 1 });
    expect(w!.erro).toMatch(/Nenhum bloco de regra/);
  });

  it('fonte sem regra ativa vira erro legível', async () => {
    await comTenant(db, empresa.b, (tx) =>
      tx.update(rules).set({ ativo: false }).where(eq(rules.sourceId, fonte.b)),
    );
    const id = await bruto(empresa.b, fonte.b, ftd(9));
    const r = await processarWebhookEvent(db, { tenantId: empresa.b, webhookEventId: id });
    expect(r).toMatchObject({ status: 'erro', motivo: 'A fonte não tem versão de regra ativa.' });
    await comTenant(db, empresa.b, (tx) =>
      tx.update(rules).set({ ativo: true }).where(eq(rules.sourceId, fonte.b)),
    );
  });

  it('isolamento: evento da empresa A não é visível nem processável pela B', async () => {
    const id = await bruto(empresa.a, fonte.a, ftd(2, '2024-05-12T12:00:00Z'));
    const viaB = await processarWebhookEvent(db, { tenantId: empresa.b, webhookEventId: id });
    expect(viaB.status).toBe('erro');
    await processarWebhookEvent(db, { tenantId: empresa.a, webhookEventId: id });

    const evsB = await comTenant(db, empresa.b, (tx) => tx.select().from(events));
    const mB = await metricas(empresa.b);
    expect(evsB).toHaveLength(0);
    expect(mB).toHaveLength(0);
    // E o bruto continua intacto na A.
    const [w] = await comTenant(db, empresa.a, (tx) =>
      tx.select().from(webhookEvents).where(eq(webhookEvents.id, id)),
    );
    expect(w!.status).toBe('processado');
  });

  it('reprocessarFonte percorre os brutos e não duplica; preserva canais __', async () => {
    await comTenant(db, empresa.a, (tx) =>
      tx.insert(metricsDaily).values({
        tenantId: empresa.a,
        day: '2024-05-10',
        channel: '__funil__',
        baseContatada: 999,
      }),
    );
    const antes = await comTenant(db, empresa.a, (tx) => tx.select().from(events));
    const r = await reprocessarFonte(db, { tenantId: empresa.a, sourceId: fonte.a });
    expect(r.total).toBe(7);
    expect(r.erros).toBe(1);
    const depois = await comTenant(db, empresa.a, (tx) => tx.select().from(events));
    expect(depois).toHaveLength(antes.length);
    await reagregarDias(db, empresa.a, ['2024-05-10', '2024-05-12']);
    const m = await metricas(empresa.a);
    const funil = m.find((l) => l.channel === '__funil__');
    expect(funil?.baseContatada).toBe(999);
    const meta10 = m.find((l) => l.channel === 'Meta' && l.day === '2024-05-10');
    expect(meta10).toMatchObject({ ftds: 1, investimento: '250.50' });
  });

  it.skipIf(!process.env.TESTE_LENTO)(
    'reprocessa 10 mil brutos em menos de 2 minutos',
    async () => {
      const n = 10_000;
      await comTenant(db, empresa.b, async (tx) => {
        for (let i = 0; i < n; i += 1000) {
          await tx.insert(webhookEvents).values(
            Array.from({ length: Math.min(1000, n - i) }, (_, j) => ({
              tenantId: empresa.b,
              sourceId: fonte.b,
              eventKey: `lento-${i + j}`,
              payload: ftd(
                i + j,
                new Date(Date.UTC(2024, 4, 1 + ((i + j) % 24), 15)).toISOString(),
              ),
            })),
          );
        }
      });
      const t0 = performance.now();
      const r = await reprocessarFonte(db, { tenantId: empresa.b, sourceId: fonte.b });
      const seg = (performance.now() - t0) / 1000;
      console.info(`[reprocessar] ${r.total} brutos, ${r.eventos} eventos em ${seg.toFixed(1)} s`);
      expect(r.total).toBeGreaterThanOrEqual(n);
      expect(seg).toBeLessThan(120);
      const m = await comTenant(db, empresa.b, (tx) =>
        tx
          .select()
          .from(metricsDaily)
          .where(and(eq(metricsDaily.channel, 'Meta'))),
      );
      expect(m.reduce((s, l) => s + l.ftds, 0)).toBe(n + 1);
    },
    180_000,
  );
});
