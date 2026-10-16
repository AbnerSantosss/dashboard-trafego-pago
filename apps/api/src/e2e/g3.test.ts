/**
 * Gate G3 (P6.2): fluxo ponta a ponta para duas empresas isoladas.
 *
 * Para cada empresa: fonte criada pela rota de administração (segredo cifrado no banco, sem
 * WEBHOOK_SEGREDOS) → regra de tratamento → webhook assinado → worker processa → agregação em
 * metrics_daily → GET /metricas/visao-geral. Cada empresa só enxerga os próprios números.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FonteComSegredo, VisaoGeralResposta } from '@trafego/contratos';
import { buildApp, type App } from '../app.js';
import { bancoDisponivel, criarCenario, URL_APP, type Cenario } from '../auth/banco-teste.js';
import { emitirToken } from '../auth/plugin.js';
import { comTenant, rules, sources, type Db } from '../db/client.js';
import { carregarEnv } from '../env.js';
import { limparCacheMetricas } from '../metricas/cache.js';
import { processarWebhookEvent } from '../rules/processar.js';
import { criarFilaMemoria } from '../webhooks/fila.js';
import { dbTeste, requisicaoAssinada } from '../webhooks/teste-util.js';
import { criarWorker } from '../webhooks/worker.js';

const disponivel = await bancoDisponivel('e2e/g3.test');

const DIA = '2026-05-11';

interface Empresa {
  id: string;
  slug: string;
  segredo: string;
  sourceId: string;
  /** Valor do FTD em reais enviado no webhook (em centavos no corpo). */
  valor: number;
}

describe.skipIf(!disponivel)('gate G3: webhook → agregação → painel em duas empresas', () => {
  let c: Cenario;
  let db: Db;
  let app: App;
  let token = '';
  const empresas: Empresa[] = [];

  const cabecalhos = (slug: string) => ({ authorization: `Bearer ${token}`, 'x-tenant': slug });

  async function visaoGeral(slug: string) {
    const res = await app.inject({
      method: 'GET',
      url: `/metricas/visao-geral?de=${DIA}&ate=${DIA}&comparar=nenhum`,
      headers: cabecalhos(slug),
    });
    return res;
  }

  beforeAll(async () => {
    // Usuário admin em T1 e T2; T3 existe sem vínculo.
    c = await criarCenario(['admin', 'admin']);
    db = dbTeste();
    app = await buildApp({
      env: carregarEnv({ NODE_ENV: 'test', DATABASE_URL: URL_APP }),
      logger: false,
      webhooks: { fila: criarFilaMemoria() },
    });
    await app.ready();
    token = emitirToken(app, { sub: c.usuario.id, email: c.usuario.email, tenant: c.t1.id });

    for (const [t, valor] of [
      [c.t1, 250],
      [c.t2, 777],
    ] as const) {
      // 1. Fonte criada pela API de administração (Fase 5): o segredo vem só na resposta.
      const criada = await app.inject({
        method: 'POST',
        url: '/empresas/atual/fontes',
        headers: cabecalhos(t.slug),
        payload: { slug: 'loja', nome: 'Loja' },
      });
      expect(criada.statusCode).toBe(201);
      const corpo = criada.json<FonteComSegredo>();

      // 2. Regra de tratamento: first_deposit → ftd com valor em reais.
      await comTenant(db, t.id, async (tx) => {
        await tx.insert(rules).values({
          tenantId: t.id,
          sourceId: corpo.fonte.id,
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
        await tx.update(sources).set({ rulesVersion: 1 }).where(eq(sources.id, corpo.fonte.id));
      });
      empresas.push({
        id: t.id,
        slug: t.slug,
        segredo: corpo.segredo,
        sourceId: corpo.fonte.id,
        valor,
      });
    }

    // 3. Webhook assinado e processamento pelo worker (o mesmo caminho do pg-boss).
    const worker = criarWorker({ db, processar: processarWebhookEvent });
    for (const e of empresas) {
      const res = await app.inject(
        requisicaoAssinada(e.slug, 'loja', e.segredo, {
          eventId: `g3-${e.slug}`,
          corpo: {
            event: 'first_deposit',
            created_at: `${DIA}T15:00:00Z`,
            amount: e.valor * 100,
            user: { id: `lead-${e.slug}` },
            utm: { source: 'Facebook' },
          },
        }),
      );
      expect(res.statusCode).toBe(202);
      await expect(
        worker.tratarProcessar({
          data: { tenantId: e.id, webhookEventId: res.json().id as string },
          retryCount: 0,
        }),
      ).resolves.toMatchObject({ status: 'processado' });
    }
    limparCacheMetricas();
  });

  afterAll(async () => {
    await app?.close();
    await db?.$client.end({ timeout: 5 });
    await c?.limpar();
  });

  it('(1) cada empresa vê no painel só o próprio FTD', async () => {
    for (const e of empresas) {
      const res = await visaoGeral(e.slug);
      expect(res.statusCode).toBe(200);
      const v = res.json<VisaoGeralResposta>();
      expect(v.periodo).toEqual({ de: DIA, ate: DIA });
      expect(v.total.ftdsQtd).toBe(1);
      expect(v.total.ftdsValor).toBe(e.valor);
      expect(v.apresentacao.nomeExibicao).toBe(`Apres ${e.slug}`);
    }
  });

  it('(2) o webhook de uma empresa não altera os números da outra', async () => {
    const [a, b] = empresas as [Empresa, Empresa];
    const reenviado = await app.inject(
      requisicaoAssinada(a.slug, 'loja', b.segredo, {
        corpo: { event: 'first_deposit', created_at: `${DIA}T16:00:00Z`, amount: 99900 },
      }),
    );
    expect(reenviado.statusCode).toBe(401);
    limparCacheMetricas();
    expect((await visaoGeral(a.slug)).json<VisaoGeralResposta>().total.ftdsValor).toBe(a.valor);
    expect((await visaoGeral(b.slug)).json<VisaoGeralResposta>().total.ftdsValor).toBe(b.valor);
  });

  it('(3) empresa sem vínculo do usuário → 403 no painel', async () => {
    const res = await visaoGeral(c.t3.slug);
    expect(res.statusCode).toBe(403);
    expect(res.json().erro.codigo).toBe('acesso_negado');
  });
});
