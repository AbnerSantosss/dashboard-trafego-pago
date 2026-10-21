/**
 * Um FTD por jogador com o preset GTech e o Postgres local (pula com aviso se o banco não
 * responder): chegada fora de ordem, pagamento sem contador, reenvio com corpo diferente,
 * dois webhooks do mesmo jogador ao mesmo tempo e reprocessamento da fonte.
 */
import { randomUUID } from 'node:crypto';
import { mapeamentoGtech } from '@trafego/rules';
import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEPOSIT_PAYMENT_PRIMEIRO } from '../../../../packages/rules/src/presets/gtech.fixtures.js';
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
import { processarWebhookEvent } from './processar.js';
import { reprocessarFonte } from './reprocessar.js';

const disponivel = await bancoDisponivel('rules/primeiro-deposito.test');

/** Pagamento GTech fictício; `approved` indefinido = payload sem o contador. */
function pagamento(user: number, hora: string, amount: number, approved?: number) {
  const p: Record<string, unknown> = {
    ...DEPOSIT_PAYMENT_PRIMEIRO,
    deposit_id: randomUUID(),
    user_id: user,
    amount,
    paid_at: `2026-10-20T${hora}:00.000-03:00`,
    approved_deposits: approved,
  };
  if (approved === undefined) delete p.approved_deposits;
  return p;
}

describe.skipIf(!disponivel)('garantirUmFtdPorLead', () => {
  const db = criarDb(URL_APP, { max: 4 });
  let tenantId = '';
  let sourceId = '';

  beforeAll(async () => {
    const [t] = await db
      .insert(tenants)
      .values({ slug: `teste-ftd-${randomUUID().slice(0, 8)}`, nome: 'Um FTD por jogador' })
      .returning({ id: tenants.id });
    tenantId = t!.id;
    sourceId = await comTenant(db, tenantId, async (tx) => {
      const [s] = await tx
        .insert(sources)
        .values({ tenantId, slug: 'gtech', nome: 'GTech', secretHash: 'x', rulesVersion: 1 })
        .returning({ id: sources.id });
      await tx
        .insert(rules)
        .values({ tenantId, sourceId: s!.id, version: 1, mapping: mapeamentoGtech(), ativo: true });
      return s!.id;
    });
  });

  afterAll(async () => {
    if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.$client.end({ timeout: 5 });
  });

  async function bruto(payload: unknown) {
    return comTenant(db, tenantId, async (tx) => {
      const [w] = await tx
        .insert(webhookEvents)
        .values({ tenantId, sourceId, eventKey: randomUUID(), payload })
        .returning({ id: webhookEvents.id });
      return w!.id;
    });
  }

  const processar = async (payload: unknown) =>
    processarWebhookEvent(db, { tenantId, webhookEventId: await bruto(payload) });

  /**
   * Tipos dos depósitos do jogador, do mais antigo ao mais novo, com o valor. Empate de horário:
   * `ftd` antes de `deposito`, como na regra; sem isso a ordem depois de reprocessar é a do banco.
   */
  const historico = (lead: number) =>
    comTenant(db, tenantId, (tx) =>
      tx
        .select({ type: events.type, value: events.value })
        .from(events)
        .where(eq(events.leadKey, String(lead)))
        .orderBy(asc(events.occurredAt), desc(sql`${events.type} = 'ftd'`)),
    ).then((l) => l.map((e) => `${e.type} ${e.value}`));

  const totais = async (lead: number) => {
    const m = await comTenant(db, tenantId, (tx) => tx.select().from(metricsDaily));
    const r = await comTenant(db, tenantId, (tx) =>
      tx
        .select({ type: events.type })
        .from(events)
        .where(inArray(events.leadKey, [String(lead)])),
    );
    return { m, redepositos: r.filter((e) => e.type === 'deposito').length };
  };

  it('pagamentos sem contador fora de ordem: o mais antigo é o FTD, o outro é redepósito', async () => {
    expect(await processar(pagamento(1, '14:00', 50))).toMatchObject({ status: 'processado' });
    expect(await historico(1)).toEqual(['ftd 50.00']);
    await processar(pagamento(1, '13:00', 20));
    expect(await historico(1)).toEqual(['ftd 20.00', 'deposito 50.00']);
    // A agregação do dia foi refeita: 1 FTD de 20, depósitos 70.
    const { m, redepositos } = await totais(1);
    expect(m.reduce((s, l) => s + l.ftds, 0)).toBe(1);
    expect(m.reduce((s, l) => s + Number(l.ftdsValor), 0)).toBe(20);
    expect(m.reduce((s, l) => s + Number(l.depositos), 0)).toBe(70);
    expect(redepositos).toBe(1);
  });

  it('contador 1 repetido (reenvio com outro corpo) conta um FTD só', async () => {
    await processar(pagamento(2, '10:00', 30, 1));
    await processar(pagamento(2, '10:00', 30, 1));
    expect(await historico(2)).toEqual(['ftd 30.00', 'deposito 30.00']);
  });

  it('contador ≥ 2 antes do 1: o 2 segue redepósito e o 1 é o FTD', async () => {
    await processar(pagamento(3, '12:00', 15, 2));
    await processar(pagamento(3, '11:00', 10, 1));
    expect(await historico(3)).toEqual(['ftd 10.00', 'deposito 15.00']);
    // Depósito sem contador depois do FTD é redepósito.
    await processar(pagamento(3, '16:00', 5));
    expect(await historico(3)).toEqual(['ftd 10.00', 'deposito 15.00', 'deposito 5.00']);
  });

  it('dois webhooks do mesmo jogador ao mesmo tempo: um FTD só', async () => {
    const ids = await Promise.all([
      bruto(pagamento(4, '09:00', 40, 1)),
      bruto(pagamento(4, '09:05', 60)),
      bruto(pagamento(4, '09:10', 70)),
    ]);
    const r = await Promise.all(
      ids.map((webhookEventId) => processarWebhookEvent(db, { tenantId, webhookEventId })),
    );
    expect(r.every((x) => x.status === 'processado')).toBe(true);
    expect(await historico(4)).toEqual(['ftd 40.00', 'deposito 60.00', 'deposito 70.00']);
  });

  it('jogadores diferentes não se afetam; reprocessar a fonte mantém um FTD por jogador', async () => {
    await processar(pagamento(5, '08:00', 25));
    expect(await historico(5)).toEqual(['ftd 25.00']);
    const r = await reprocessarFonte(db, { tenantId, sourceId });
    expect(r.erros).toBe(0);
    expect(await historico(1)).toEqual(['ftd 20.00', 'deposito 50.00']);
    expect(await historico(2)).toEqual(['ftd 30.00', 'deposito 30.00']);
    expect(await historico(3)).toEqual(['ftd 10.00', 'deposito 15.00', 'deposito 5.00']);
    expect(await historico(4)).toEqual(['ftd 40.00', 'deposito 60.00', 'deposito 70.00']);
    expect(await historico(5)).toEqual(['ftd 25.00']);
    const m = await comTenant(db, tenantId, (tx) => tx.select().from(metricsDaily));
    expect(m.reduce((s, l) => s + l.ftds, 0)).toBe(5);
  });
});
