/**
 * GET /metricas/visao-geral (P4.8) contra o seed real da PASIO (mesmo banco de `seed.test.ts`).
 * Pula com aviso se o Postgres não responder.
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { appComBanco, bancoDisponivel, URL_APP } from '../auth/banco-teste.js';
import { emitirToken } from '../auth/plugin.js';
import {
  comTenant,
  criarDb,
  events,
  memberships,
  metricsDaily,
  presentation,
  tenants,
  users,
} from '../db/client.js';
import { executarSeed, SLUG_DEMO } from '../db/seed.js';
import { referencia } from '../db/seed/referencia.js';
import { estatisticasCacheMetricas, limparCacheMetricas } from '../metricas/cache.js';
import { schemaVisaoGeralResposta } from './metricas.js';

const disponivel = await bancoDisponivel('rotas/metricas.test');

const r1 = (n: number | null | undefined) => (n == null ? n : Number(n.toFixed(1)));
const r2 = (n: number | null | undefined) => (n == null ? n : Number(n.toFixed(2)));

describe.skipIf(!disponivel)('GET /metricas/visao-geral', () => {
  const db = criarDb(URL_APP, { max: 2 });
  let app: App;
  let tokenPasio = '';
  let tokenB = '';
  const sufixo = randomUUID().slice(0, 8);
  const empresaB = { id: '', slug: `teste-metricas-b-${sufixo}` };
  let usuarioB = '';

  beforeAll(async () => {
    const seed = await executarSeed(db);
    const [u] = await db.select().from(users).where(eq(users.id, seed.userId));
    app = await appComBanco();
    await app.ready();
    tokenPasio = emitirToken(app, { sub: seed.userId, email: u!.email, tenant: seed.tenantId });

    const [t] = await db
      .insert(tenants)
      .values({ slug: empresaB.slug, nome: 'Empresa B (teste métricas)' })
      .returning({ id: tenants.id });
    empresaB.id = t!.id;
    const email = `metricas-${sufixo}@teste.local`;
    const [ub] = await db.insert(users).values({ email, nome: 'B' }).returning({ id: users.id });
    usuarioB = ub!.id;
    await comTenant(db, empresaB.id, async (tx) => {
      await tx.insert(presentation).values({ tenantId: empresaB.id, nomeExibicao: 'B' });
      await tx
        .insert(memberships)
        .values({ tenantId: empresaB.id, userId: usuarioB, role: 'leitor' });
      const linha = (day: string, channel: string, investimento: string | null, ftds: number) => ({
        tenantId: empresaB.id,
        day,
        channel,
        investimento,
        cliques: 10,
        visitas: 5,
        cadastros: 2,
        ftds,
        depositos: '500.00',
      });
      await tx
        .insert(metricsDaily)
        .values([
          linha('2025-01-10', 'Google', '100.00', 2),
          linha('2025-01-11', 'Google', '50.00', 1),
          linha('2025-01-11', '__secreto__', null, 0),
        ]);
      // Redepósitos: 3 no Google em 10/01 e 1 em canal reservado (não entra).
      const deposito = (channel: string) => ({
        tenantId: empresaB.id,
        type: 'deposito' as const,
        occurredAt: new Date('2025-01-10T15:00:00Z'),
        value: '50.00',
        channel,
      });
      await tx
        .insert(events)
        .values([
          deposito('Google'),
          deposito('Google'),
          deposito('Google'),
          deposito('__secreto__'),
        ]);
    });
    tokenB = emitirToken(app, { sub: usuarioB, email, tenant: empresaB.id });
  });

  afterAll(async () => {
    await app?.close();
    if (empresaB.id) await db.delete(tenants).where(eq(tenants.id, empresaB.id));
    if (usuarioB) await db.delete(users).where(eq(users.id, usuarioB));
    await db.$client.end({ timeout: 5 });
  });

  beforeEach(() => limparCacheMetricas());

  const get = (url: string, token = tokenPasio, extra: Record<string, string> = {}) =>
    app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}`, ...extra } });

  type Kpi = { id: string; valorAnterior: number | null; variacaoPct: number | null };
  const kpi = (corpo: { kpis: Kpi[] }, id: string) => corpo.kpis.find((k) => k.id === id)!;

  it('período da imagem reproduz totais, canais, funil e variações', async () => {
    const res = await get('/metricas/visao-geral?de=2024-05-01&ate=2024-05-24');
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('private, max-age=15');
    const c = schemaVisaoGeralResposta.parse(res.json());
    expect(c.periodo).toEqual({ de: '2024-05-01', ate: '2024-05-24' });
    expect(c.comparacao).toEqual({ de: '2024-04-07', ate: '2024-04-30' });
    expect(c.total.investimento).toBe(33840);
    expect(c.total.ftdsQtd).toBe(995);
    expect(c.total.depositos).toBe(226190);
    expect(r2(c.total.roas)).toBe(6.68);

    expect(c.canais.map((l) => l.canal)).toEqual(referencia.tabela.linhas.map((l) => l.canal));
    for (const ref of referencia.tabela.linhas) {
      const l = c.canais.find((x) => x.canal === ref.canal)!;
      expect(l).toMatchObject({
        investimento: ref.investimento,
        cliques: ref.cliques,
        visitas: ref.visitas,
        cadastros: ref.cadastros,
        ftdsQtd: ref.ftdsQtd,
        ftdsValor: ref.ftdsValor,
        depositos: ref.depositos,
      });
      if (ref.cpa === null) expect(l.cpa).toBeNull();
      else expect(r2(l.cpa)).toBe(ref.cpa);
      expect(l.cor).toMatch(/^#[0-9A-F]{6}$/i);
    }

    expect(c.funil.map((e) => e.valor)).toEqual([320840, 40000, 30000, 6000, 600]);
    expect(c.funil.map((e) => r1(e.taxaPct))).toEqual([100, 12.5, 75, 20, 10]);

    expect(c.kpis.map((k) => k.id)).toEqual(['investimento', 'ftds', 'cpa', 'depositos', 'roas']);
    for (const k of c.kpis) {
      expect(k.variacaoPct, k.id).not.toBeNull();
      expect(k.sparkline).toHaveLength(24);
    }
    expect(r1(kpi(c, 'investimento').variacaoPct)).toBe(12.5);
    expect(r1(kpi(c, 'ftds').variacaoPct)).toBe(18.6);
    expect(r1(kpi(c, 'depositos').variacaoPct)).toBe(22.1);
    expect(r1(kpi(c, 'cpa').variacaoPct)).toBe(-5.1);
    expect(r1(kpi(c, 'roas').variacaoPct)).toBe(8.5);

    expect(c.opcoes.canais).toEqual(['Meta', 'Email', 'SMS', 'Afiliados', 'Outros']);
    expect(c.apresentacao.kpis).toEqual(['investimento', 'ftds', 'cpa', 'depositos', 'roas']);
    expect(c.apresentacao.columns).toHaveLength(10);
    expect(c.apresentacao.currency).toBe('BRL');
  });

  it('sem query cai no mesmo período (último dia com dados)', async () => {
    const c = (await get('/metricas/visao-geral')).json();
    expect(c.periodo).toEqual({ de: '2024-05-01', ate: '2024-05-24' });
    expect(c.total.investimento).toBe(33840);
    const so = (await get('/metricas/visao-geral?de=2024-05-01')).json();
    expect(so.periodo.ate).toBe('2024-05-24');
  });

  it('filtro canal=Meta mantém opcoes.canais completas', async () => {
    const c = (await get('/metricas/visao-geral?de=2024-05-01&ate=2024-05-24&canal=Meta')).json();
    expect(c.canais.map((l: { canal: string }) => l.canal)).toEqual(['Meta']);
    const semRotulo = (l: Record<string, unknown>) => ({ ...l, canal: null, cor: null });
    expect(semRotulo(c.total)).toEqual(semRotulo(c.canais[0]));
    expect(c.opcoes.canais).toHaveLength(5);
  });

  it('comparar=nenhum zera a comparação', async () => {
    const c = (
      await get('/metricas/visao-geral?de=2024-05-01&ate=2024-05-24&comparar=nenhum')
    ).json();
    expect(c.comparacao).toBeNull();
    for (const k of c.kpis as Kpi[]) {
      expect(k.valorAnterior).toBeNull();
      expect(k.variacaoPct).toBeNull();
    }
  });

  it('validação: de > ate, período acima de 400 dias e data inválida → 400', async () => {
    const a = await get('/metricas/visao-geral?de=2024-05-10&ate=2024-05-01');
    expect(a.statusCode).toBe(400);
    expect(a.json().erro.codigo).toBe('validacao_invalida');
    const b = await get('/metricas/visao-geral?de=2023-01-01&ate=2024-05-01');
    expect(b.json().erro.codigo).toBe('validacao_invalida');
    const d = await get('/metricas/visao-geral?de=ontem');
    expect(d.statusCode).toBe(400);
  });

  it('isolamento entre empresas e canais __ ocultos', async () => {
    const b = (await get('/metricas/visao-geral?de=2025-01-01&ate=2025-01-24', tokenB)).json();
    expect(b.canais.map((l: { canal: string }) => l.canal)).toEqual(['Google']);
    expect(b.opcoes.canais).toEqual(['Google']);
    expect(b.total.investimento).toBe(150);
    expect(b.total.cpa).toBe(50);
    // Há canal reservado no período: o funil vem só dele (10 cliques), não do Google (20).
    expect(b.funil[1].valor).toBe(10);

    const bPadrao = (await get('/metricas/visao-geral', tokenB)).json();
    expect(bPadrao.periodo.ate).toBe('2025-01-11');

    const negado = await get('/metricas/visao-geral', tokenB, { 'x-tenant': SLUG_DEMO });
    expect(negado.statusCode).toBe(403);

    const pasio = (await get('/metricas/visao-geral?de=2025-01-01&ate=2025-01-24')).json();
    expect(pasio.canais).toEqual([]);
    expect(pasio.total.investimento).toBeNull();
    expect(pasio.opcoes.canais).not.toContain('Google');
    expect(pasio.opcoes.canais).not.toContain('__funil__');
  });

  it('redepósito vira a sexta etapa do funil quando não há canal reservado', async () => {
    const dia = (await get('/metricas/visao-geral?de=2025-01-10&ate=2025-01-10', tokenB)).json();
    expect(dia.funil.map((e: { id: string }) => e.id)).toEqual([
      'base',
      'cliques',
      'visitas',
      'cadastro',
      'ftd',
      'redeposito',
    ]);
    expect(dia.funil[5].valor).toBe(3);
    // Taxa sobre os 2 FTDs do dia: pode passar de 100%.
    expect(r1(dia.funil[5].taxaPct)).toBe(150);

    // Com o canal reservado no período o funil segue com 5 etapas (demo, D11).
    const mes = (await get('/metricas/visao-geral?de=2025-01-01&ate=2025-01-24', tokenB)).json();
    expect(mes.funil).toHaveLength(5);
    // Empresa sem nenhum evento deposito: sem a etapa.
    const pasio = (await get('/metricas/visao-geral?de=2024-05-01&ate=2024-05-24')).json();
    expect(pasio.funil).toHaveLength(5);
  });

  it('cache: segunda chamada igual não consulta o banco; limpar invalida', async () => {
    const url = '/metricas/visao-geral?de=2024-05-01&ate=2024-05-24';
    const e0 = estatisticasCacheMetricas();
    await get(url);
    const e1 = estatisticasCacheMetricas();
    expect(e1.faltas - e0.faltas).toBe(1);
    const segunda = await get(url);
    const e2 = estatisticasCacheMetricas();
    expect(e2.acertos - e1.acertos).toBe(1);
    expect(e2.faltas).toBe(e1.faltas);
    expect(segunda.json().total.investimento).toBe(33840);
    limparCacheMetricas();
    await get(url);
    expect(estatisticasCacheMetricas().faltas - e2.faltas).toBe(1);
  });
});
