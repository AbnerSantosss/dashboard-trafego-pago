/**
 * GTech ponta a ponta: fonte criada pela rota de administração → preset GTech publicado →
 * webhooks no formato real da plataforma (Authorization: Basic, sem X-Signature/X-Event-Id) →
 * worker → agregação → GET /metricas/visao-geral. Payloads fictícios de `@trafego/rules`.
 */
import { mapeamentoGtech } from '@trafego/rules';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FonteComSegredo, VisaoGeralResposta } from '@trafego/contratos';
import {
  DEPOSIT_CREATED,
  DEPOSIT_PAYMENT_PRIMEIRO,
  DEPOSIT_PAYMENT_REDEPOSITO,
  USER_CREATED,
} from '../../../../packages/rules/src/presets/gtech.fixtures.js';
import { buildApp, type App } from '../app.js';
import { bancoDisponivel, criarCenario, URL_APP, type Cenario } from '../auth/banco-teste.js';
import { emitirToken } from '../auth/plugin.js';
import type { Db } from '../db/client.js';
import { carregarEnv } from '../env.js';
import { limparCacheMetricas } from '../metricas/cache.js';
import { publicarRegras } from '../rules/aplicar-preset.js';
import { processarWebhookEvent } from '../rules/processar.js';
import { criarFilaMemoria } from '../webhooks/fila.js';
import { dbTeste } from '../webhooks/teste-util.js';
import { criarWorker } from '../webhooks/worker.js';

const disponivel = await bancoDisponivel('e2e/gtech.test');

const DIA = '2026-10-20';

describe.skipIf(!disponivel)('GTech: webhook Basic → preset → painel', () => {
  let c: Cenario;
  let db: Db;
  let app: App;
  let token = '';
  let segredo = '';

  const cabecalhos = () => ({ authorization: `Bearer ${token}`, 'x-tenant': c.t1.slug });

  /** Como a GTech envia: um JSON por POST, Basic com usuário livre e senha = segredo. */
  const enviar = (corpo: unknown, senha = segredo) =>
    app.inject({
      method: 'POST',
      url: `/webhooks/${c.t1.slug}/gtech`,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        authorization: `Basic ${Buffer.from(`gtech:${senha}`).toString('base64')}`,
      },
      payload: JSON.stringify(corpo),
    });

  beforeAll(async () => {
    c = await criarCenario(['admin', 'admin']);
    db = dbTeste();
    app = await buildApp({
      env: carregarEnv({ NODE_ENV: 'test', DATABASE_URL: URL_APP }),
      logger: false,
      webhooks: { fila: criarFilaMemoria() },
    });
    await app.ready();
    token = emitirToken(app, { sub: c.usuario.id, email: c.usuario.email, tenant: c.t1.id });

    const criada = await app.inject({
      method: 'POST',
      url: '/empresas/atual/fontes',
      headers: cabecalhos(),
      payload: { slug: 'gtech', nome: 'GTech' },
    });
    expect(criada.statusCode).toBe(201);
    const corpo = criada.json<FonteComSegredo>();
    segredo = corpo.segredo;
    await publicarRegras(db, {
      tenantId: c.t1.id,
      sourceId: corpo.fonte.id,
      mapping: mapeamentoGtech(),
    });
  });

  afterAll(async () => {
    await app?.close();
    await db?.$client.end({ timeout: 5 });
    await c?.limpar();
  });

  it('recebe cadastro, pendente, FTD e redepósito e mostra no painel', async () => {
    const worker = criarWorker({ db, processar: processarWebhookEvent });
    const eventos = [];
    for (const payload of [
      USER_CREATED,
      DEPOSIT_CREATED,
      DEPOSIT_PAYMENT_PRIMEIRO,
      DEPOSIT_PAYMENT_REDEPOSITO,
    ]) {
      const res = await enviar(payload);
      expect(res.statusCode).toBe(202);
      const r = await worker.tratarProcessar({
        data: { tenantId: c.t1.id, webhookEventId: res.json().id as string },
        retryCount: 0,
      });
      expect(r).toMatchObject({ status: 'processado' });
      eventos.push((r as { eventos: number }).eventos);
    }
    // O pendente (DEPOSIT_CREATED) não vira evento.
    expect(eventos).toEqual([1, 0, 1, 1]);

    // Reenvio idêntico (a GTech não manda X-Event-Id): idempotente pelo hash do corpo.
    expect((await enviar(DEPOSIT_PAYMENT_PRIMEIRO)).statusCode).toBe(200);
    expect((await enviar(USER_CREATED, 'senha-errada')).statusCode).toBe(401);

    limparCacheMetricas();
    const res = await app.inject({
      method: 'GET',
      url: `/metricas/visao-geral?de=${DIA}&ate=${DIA}&comparar=nenhum`,
      headers: cabecalhos(),
    });
    expect(res.statusCode).toBe(200);
    const v = res.json<VisaoGeralResposta>();
    expect(v.total.cadastros).toBe(1);
    expect(v.total.ftdsQtd).toBe(1);
    expect(v.total.ftdsValor).toBe(20);
    expect(v.total.depositos).toBeCloseTo(70.5);
  });
});
