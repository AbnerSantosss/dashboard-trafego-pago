/**
 * Preset GTech publicado numa fonte e aplicado aos brutos, com o Postgres local (pula com aviso
 * se o banco não responder). Payloads fictícios de `@trafego/rules`.
 */
import { randomUUID } from 'node:crypto';
import { mapeamentoGtech } from '@trafego/rules';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DEPOSIT_CREATED,
  DEPOSIT_PAYMENT_PRIMEIRO,
  DEPOSIT_PAYMENT_REDEPOSITO,
  USER_CREATED,
} from '../../../../packages/rules/src/presets/gtech.fixtures.js';
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
import { localizarFonte, publicarRegras } from './aplicar-preset.js';
import { processarWebhookEvent } from './processar.js';

const disponivel = await bancoDisponivel('rules/aplicar-preset.test');

describe.skipIf(!disponivel)('publicarRegras + preset GTech', () => {
  const db = criarDb(URL_APP, { max: 3 });
  const slug = `teste-gtech-${randomUUID().slice(0, 8)}`;
  let tenantId = '';
  let sourceId = '';

  beforeAll(async () => {
    const [t] = await db
      .insert(tenants)
      .values({ slug, nome: 'GTech teste' })
      .returning({ id: tenants.id });
    tenantId = t!.id;
    sourceId = await comTenant(db, tenantId, async (tx) => {
      const [s] = await tx
        .insert(sources)
        .values({ tenantId, slug: 'gtech', nome: 'GTech', secretHash: 'x' })
        .returning({ id: sources.id });
      return s!.id;
    });
  });

  afterAll(async () => {
    if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.$client.end({ timeout: 5 });
  });

  it('localiza a fonte pelos slugs e recusa a inexistente', async () => {
    expect(await localizarFonte(db, slug, 'gtech')).toEqual({ tenantId, sourceId });
    await expect(localizarFonte(db, slug, 'nao-existe')).rejects.toThrow(/Configurações/);
    await expect(localizarFonte(db, `${slug}-x`, 'gtech')).rejects.toThrow(/não existe/);
  });

  it('publica versão 1 ativa; republicar igual não cria versão; conteúdo novo cria a 2', async () => {
    expect(await publicarRegras(db, { tenantId, sourceId, mapping: mapeamentoGtech() })).toEqual({
      version: 1,
      criada: true,
    });
    expect(await publicarRegras(db, { tenantId, sourceId, mapping: mapeamentoGtech() })).toEqual({
      version: 1,
      criada: false,
    });
    const outro = { ...mapeamentoGtech(), ignorar: [] };
    expect(await publicarRegras(db, { tenantId, sourceId, mapping: outro })).toEqual({
      version: 2,
      criada: true,
    });
    expect(await publicarRegras(db, { tenantId, sourceId, mapping: mapeamentoGtech() })).toEqual({
      version: 3,
      criada: true,
    });
    const linhas = await comTenant(db, tenantId, (tx) =>
      tx.select({ version: rules.version, ativo: rules.ativo }).from(rules),
    );
    expect(linhas.filter((l) => l.ativo).map((l) => l.version)).toEqual([3]);
    const [fonte] = await comTenant(db, tenantId, (tx) =>
      tx.select({ v: sources.rulesVersion }).from(sources).where(eq(sources.id, sourceId)),
    );
    expect(fonte!.v).toBe(3);
  });

  it('recusa regras inválidas sem tocar no banco', async () => {
    await expect(
      publicarRegras(db, { tenantId, sourceId, mapping: { regras: [] } }),
    ).rejects.toThrow(/Regras inválidas/);
  });

  it('processa os webhooks GTech: cadastro, ftd, deposito e pendente ignorado', async () => {
    const resultados = [];
    for (const payload of [
      USER_CREATED,
      DEPOSIT_CREATED,
      DEPOSIT_PAYMENT_PRIMEIRO,
      DEPOSIT_PAYMENT_REDEPOSITO,
    ]) {
      const id = await comTenant(db, tenantId, async (tx) => {
        const [w] = await tx
          .insert(webhookEvents)
          .values({ tenantId, sourceId, eventKey: randomUUID(), payload })
          .returning({ id: webhookEvents.id });
        return w!.id;
      });
      resultados.push(await processarWebhookEvent(db, { tenantId, webhookEventId: id }));
    }
    expect(resultados).toEqual([
      { status: 'processado', eventos: 1 },
      { status: 'processado', eventos: 0 },
      { status: 'processado', eventos: 1 },
      { status: 'processado', eventos: 1 },
    ]);
    const evs = await comTenant(db, tenantId, (tx) =>
      tx.select({ type: events.type, value: events.value, currency: events.currency }).from(events),
    );
    expect(evs.map((e) => e.type).sort()).toEqual(['cadastro', 'deposito', 'ftd']);
    const [m] = await comTenant(db, tenantId, (tx) =>
      tx.select().from(metricsDaily).where(eq(metricsDaily.channel, 'Outros')),
    );
    // FTD de 20 conta em FTDs e em Depósitos uma vez só.
    expect(Number(m!.ftdsValor)).toBe(20);
    expect(Number(m!.depositos)).toBe(20);
  });
});
