/**
 * Gasto em anúncios contra o Postgres local (pula sem banco): lançamento manual, contas do Meta com
 * cliente falso, sincronização idempotente e reflexo no `investimento` de `metrics_daily`.
 * Cenário: usuário `leitor` em T1 e `admin` em T2; T3 sem membership.
 */
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../app.js';
import { bancoDisponivel, criarCenario, URL_APP, type Cenario } from '../auth/banco-teste.js';
import { emitirToken } from '../auth/plugin.js';
import { comTenant, custos, metaContas, metricsDaily, type Db } from '../db/client.js';
import { carregarEnv } from '../env.js';
import { dbTeste } from '../webhooks/teste-util.js';
import { ErroMeta, type ClienteMeta, type GastoMeta } from './meta.js';

const disponivel = await bancoDisponivel('custos/custos.test');

const TOKEN_BOM = 'EAAB-token-bom-0123456789abcdef';
const TOKEN_RUIM = 'EAAB-token-ruim-0123456789abcdef';
// 15h UTC = 12h em São Paulo: "hoje" é 2026-03-10 no fuso da empresa.
const AGORA = new Date('2026-03-10T15:00:00Z');

/** Cliente falso: o gasto devolvido é trocável entre as chamadas. */
let gastosMeta: GastoMeta[] = [];
const clienteFalso: ClienteMeta = {
  async lerConta(_contaId, token) {
    if (token === TOKEN_RUIM) throw new ErroMeta('O token do Meta é inválido ou expirou.', 190);
    return { nome: 'Conta Teste', moeda: 'BRL', status: 1 };
  },
  async lerGastos(_contaId, token, de, ate) {
    if (token === TOKEN_RUIM) throw new ErroMeta('O token do Meta é inválido ou expirou.', 190);
    return gastosMeta.filter((g) => g.dia >= de && g.dia <= ate);
  },
};

describe.skipIf(!disponivel)('gasto em anúncios', () => {
  let c: Cenario;
  let db: Db;
  let app: App;
  let token = '';

  beforeAll(async () => {
    c = await criarCenario(['leitor', 'admin']);
    db = dbTeste();
    app = await buildApp({
      env: carregarEnv({ NODE_ENV: 'test', DATABASE_URL: URL_APP }),
      logger: false,
      meta: { cliente: clienteFalso, agora: () => AGORA },
    });
    await app.ready();
    token = emitirToken(app, { sub: c.usuario.id, email: c.usuario.email });
  });

  afterAll(async () => {
    await app?.close();
    await db?.$client.end({ timeout: 5 });
    await c?.limpar();
  });

  const req = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    tenant: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}`, 'x-tenant': tenant },
      ...(payload ? { payload } : {}),
    });

  /** Investimento somado de `metrics_daily` no dia (null se nenhuma linha tiver gasto). */
  async function investimentoDoDia(tenantId: string, dia: string): Promise<number | null> {
    const linhas = await comTenant(db, tenantId, (tx) =>
      tx.select().from(metricsDaily).where(eq(metricsDaily.day, dia)),
    );
    const com = linhas.filter((l) => l.investimento != null);
    return com.length ? com.reduce((s, l) => s + Number(l.investimento), 0) : null;
  }

  it('leitor não lança gasto nem vê contas do Meta (403)', async () => {
    const r1 = await req('POST', '/empresas/atual/custos', c.t1.slug, {
      dia: '2026-03-01',
      canal: 'Meta',
      valor: 10,
    });
    expect(r1.statusCode).toBe(403);
    const r2 = await req('GET', '/empresas/atual/meta/contas', c.t1.slug);
    expect(r2.statusCode).toBe(403);
  });

  it('empresa sem membership → 403', async () => {
    const r = await req('GET', '/empresas/atual/custos', c.t3.slug);
    expect(r.statusCode).toBe(403);
  });

  it('valida valor e canal', async () => {
    for (const corpo of [
      { dia: '2026-03-01', canal: 'Meta', valor: 0 },
      { dia: '2026-03-01', canal: 'Meta', valor: 1.234 },
      { dia: '2026-03-01', canal: '__funil__', valor: 5 },
      { dia: '01/03/2026', canal: 'Meta', valor: 5 },
    ]) {
      const r = await req('POST', '/empresas/atual/custos', c.t2.slug, corpo);
      expect(r.statusCode).toBe(400);
    }
  });

  it('gasto manual entra no investimento do dia e sai ao remover', async () => {
    const r = await req('POST', '/empresas/atual/custos', c.t2.slug, {
      dia: '2026-03-05',
      canal: 'Email',
      campanha: 'Newsletter',
      valor: 150.25,
      descricao: 'Disparo de março',
    });
    expect(r.statusCode).toBe(201);
    const criado = r.json();
    expect(criado).toMatchObject({ origem: 'manual', valor: 150.25, conta: null });
    expect(await investimentoDoDia(c.t2.id, '2026-03-05')).toBe(150.25);

    const lista = await req(
      'GET',
      '/empresas/atual/custos?de=2026-03-01&ate=2026-03-10',
      c.t2.slug,
    );
    expect(lista.statusCode).toBe(200);
    expect(lista.json()).toMatchObject({
      de: '2026-03-01',
      ate: '2026-03-10',
      total: 150.25,
      porCanal: [{ canal: 'Email', total: 150.25 }],
    });

    const del = await req('DELETE', `/empresas/atual/custos/${criado.id}`, c.t2.slug);
    expect(del.statusCode).toBe(204);
    expect(await investimentoDoDia(c.t2.id, '2026-03-05')).toBeNull();
    const de2 = await req('DELETE', `/empresas/atual/custos/${criado.id}`, c.t2.slug);
    expect(de2.statusCode).toBe(404);
    expect(de2.json().erro.codigo).toBe('custo_nao_encontrado');
  });

  it('GET sem datas usa os últimos 30 dias no fuso da empresa', async () => {
    const r = await req('GET', '/empresas/atual/custos', c.t2.slug);
    expect(r.json()).toMatchObject({ de: '2026-02-09', ate: '2026-03-10' });
  });

  describe('Meta Ads', () => {
    let contaRowId = '';

    it('token recusado pelo Meta → 422 meta_recusou', async () => {
      const r = await req('POST', '/empresas/atual/meta/contas', c.t2.slug, {
        contaId: '123456789',
        token: TOKEN_RUIM,
      });
      expect(r.statusCode).toBe(422);
      expect(r.json().erro).toMatchObject({ codigo: 'meta_recusou' });
    });

    it('ID de conta inválido → 400', async () => {
      const r = await req('POST', '/empresas/atual/meta/contas', c.t2.slug, {
        contaId: 'minha-conta',
        token: TOKEN_BOM,
      });
      expect(r.statusCode).toBe(400);
    });

    it('conectar grava o token cifrado e já lê os últimos 30 dias', async () => {
      gastosMeta = [
        { dia: '2026-03-08', campanhaId: '11', campanha: 'Camp A', valor: 100 },
        { dia: '2026-03-09', campanhaId: '11', campanha: 'Camp A', valor: 40.5 },
        { dia: '2026-03-09', campanhaId: '12', campanha: 'Camp B', valor: 9.5 },
      ];
      const r = await req('POST', '/empresas/atual/meta/contas', c.t2.slug, {
        contaId: '123456789',
        token: TOKEN_BOM,
      });
      expect(r.statusCode).toBe(201);
      expect(r.body).not.toContain(TOKEN_BOM);
      const corpo = r.json();
      contaRowId = corpo.conta.id;
      expect(corpo.conta).toMatchObject({
        contaId: 'act_123456789',
        nome: 'Conta Teste',
        canal: 'Meta',
        ultimoErro: null,
      });
      expect(corpo.sincronizacao).toEqual({
        ok: true,
        de: '2026-02-09',
        ate: '2026-03-10',
        linhas: 3,
        total: 150,
      });

      const [linha] = await comTenant(db, c.t2.id, (tx) =>
        tx.select().from(metaContas).where(eq(metaContas.id, contaRowId)),
      );
      expect(linha!.tokenEnc).not.toContain(TOKEN_BOM);
      expect(await investimentoDoDia(c.t2.id, '2026-03-09')).toBe(50);

      const lista = await req(
        'GET',
        '/empresas/atual/custos?de=2026-03-01&ate=2026-03-10',
        c.t2.slug,
      );
      const meta = lista.json().custos.filter((x: { origem: string }) => x.origem === 'meta');
      expect(meta).toHaveLength(3);
      expect(meta[0]).toMatchObject({ conta: 'Conta Teste', canal: 'Meta' });
    });

    it('mesma conta de novo → 409 meta_conta_existente', async () => {
      const r = await req('POST', '/empresas/atual/meta/contas', c.t2.slug, {
        contaId: 'act_123456789',
        token: TOKEN_BOM,
      });
      expect(r.statusCode).toBe(409);
      expect(r.json().erro.codigo).toBe('meta_conta_existente');
    });

    it('sincronizar de novo substitui o gasto em vez de somar', async () => {
      gastosMeta = [{ dia: '2026-03-09', campanhaId: '11', campanha: 'Camp A', valor: 42 }];
      const r = await req(
        'POST',
        `/empresas/atual/meta/contas/${contaRowId}/sincronizar`,
        c.t2.slug,
        { dias: 3 },
      );
      expect(r.statusCode).toBe(200);
      expect(r.json()).toMatchObject({ ok: true, de: '2026-03-08', ate: '2026-03-10', linhas: 1 });
      expect(await investimentoDoDia(c.t2.id, '2026-03-09')).toBe(42);
      // 2026-03-08 estava no intervalo e o Meta não devolveu gasto: some.
      expect(await investimentoDoDia(c.t2.id, '2026-03-08')).toBeNull();
    });

    it('token novo ruim no PATCH → 422; desativar funciona', async () => {
      const ruim = await req('PATCH', `/empresas/atual/meta/contas/${contaRowId}`, c.t2.slug, {
        token: TOKEN_RUIM,
      });
      expect(ruim.statusCode).toBe(422);
      const r = await req('PATCH', `/empresas/atual/meta/contas/${contaRowId}`, c.t2.slug, {
        ativo: false,
      });
      expect(r.statusCode).toBe(200);
      expect(r.json().ativo).toBe(false);
    });

    it('gasto do Meta não é removido pela rota de gasto manual', async () => {
      const [g] = await comTenant(db, c.t2.id, (tx) =>
        tx
          .select({ id: custos.id })
          .from(custos)
          .where(and(eq(custos.metaContaId, contaRowId), eq(custos.origem, 'meta'))),
      );
      const r = await req('DELETE', `/empresas/atual/custos/${g!.id}`, c.t2.slug);
      expect(r.statusCode).toBe(404);
    });

    it('outra empresa não enxerga a conta', async () => {
      const r = await req('GET', '/empresas/atual/meta/contas', c.t2.slug);
      expect(r.json()).toMatchObject({ moedaEmpresa: 'BRL' });
      const t3 = await comTenant(db, c.t3.id, (tx) => tx.select().from(metaContas));
      expect(t3).toHaveLength(0);
    });

    it('remover a conta apaga o gasto dela e recalcula o painel', async () => {
      const r = await req('DELETE', `/empresas/atual/meta/contas/${contaRowId}`, c.t2.slug);
      expect(r.statusCode).toBe(204);
      expect(await investimentoDoDia(c.t2.id, '2026-03-09')).toBeNull();
      const restantes = await comTenant(db, c.t2.id, (tx) => tx.select().from(custos));
      expect(restantes).toHaveLength(0);
      const de2 = await req('DELETE', `/empresas/atual/meta/contas/${contaRowId}`, c.t2.slug);
      expect(de2.statusCode).toBe(404);
    });
  });
});
