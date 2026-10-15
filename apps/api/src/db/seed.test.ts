/**
 * Seed da PASIO (P2.4): confere, lendo do banco via `comTenant`, que as somas reproduzem a
 * imagem de referência. Não apaga nada: a PASIO demo fica no banco.
 * Se o Postgres não responder (ou não estiver migrado), os testes são pulados com aviso.
 */
import { referencia } from './seed/referencia.js';
import { and, between, eq, ne, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { comTenant, criarDb, memberships, metricsDaily, presentation, sources } from './client.js';
import { executarSeed, type ResultadoSeed } from './seed.js';
import { CANAL_FUNIL, PERIODO_ATUAL, PERIODO_COMPARACAO, dividir, repartir } from './seed/dados.js';

const URL_APP = process.env.DATABASE_URL ?? 'postgres://app_user:app_user@127.0.0.1:5460/trafego';

async function bancoDisponivel(): Promise<boolean> {
  const sonda = criarDb(URL_APP, { max: 1 });
  try {
    await sonda.execute(sql`select base_contatada from metrics_daily limit 0`);
    return true;
  } catch {
    return false;
  } finally {
    await sonda.$client.end({ timeout: 1 });
  }
}

describe('distribuição determinística', () => {
  it('dividir soma exato e põe o resto no último', () => {
    const p = dividir(19823, 24);
    expect(p.reduce((a, b) => a + b, 0)).toBe(19823);
    expect(p[0]).toBe(825);
    expect(p[23]).toBe(19823 - 825 * 23);
  });
  it('repartir soma exato', () => {
    expect(repartir(839, [250, 210, 85, 420, 30]).reduce((a, b) => a + b, 0)).toBe(839);
  });
});

const disponivel = await bancoDisponivel();
if (!disponivel) {
  console.warn(
    '[seed.test] Postgres indisponível ou não migrado em DATABASE_URL; testes do seed PULADOS. ' +
      'Suba com "docker compose up -d db" e rode "pnpm --filter @trafego/api db:migrate".',
  );
}

interface Somas {
  investimento: number | null;
  cliques: number;
  visitas: number;
  cadastros: number;
  ftds: number;
  ftdsValor: number;
  depositos: number;
  base: number;
}

describe.skipIf(!disponivel)('seed da PASIO', () => {
  const db = criarDb(URL_APP, { max: 2 });
  let r: ResultadoSeed;

  const colunas = {
    investimento: sql<string | null>`sum(${metricsDaily.investimento})`,
    cliques: sql<string>`sum(${metricsDaily.cliques})`,
    visitas: sql<string>`sum(${metricsDaily.visitas})`,
    cadastros: sql<string>`sum(${metricsDaily.cadastros})`,
    ftds: sql<string>`sum(${metricsDaily.ftds})`,
    ftdsValor: sql<string>`sum(${metricsDaily.ftdsValor})`,
    depositos: sql<string>`sum(${metricsDaily.depositos})`,
    base: sql<string>`sum(${metricsDaily.baseContatada})`,
  };
  const numerico = (l: Record<keyof Somas, string | null>): Somas => ({
    investimento: l.investimento === null ? null : Number(l.investimento),
    cliques: Number(l.cliques),
    visitas: Number(l.visitas),
    cadastros: Number(l.cadastros),
    ftds: Number(l.ftds),
    ftdsValor: Number(l.ftdsValor),
    depositos: Number(l.depositos),
    base: Number(l.base),
  });

  const periodo = (p: { inicio: string; fim: string }) =>
    between(metricsDaily.day, p.inicio, p.fim);

  async function porCanal(p: { inicio: string; fim: string }) {
    return comTenant(db, r.tenantId, async (tx) => {
      const linhas = await tx
        .select({ canal: metricsDaily.channel, ...colunas })
        .from(metricsDaily)
        .where(periodo(p))
        .groupBy(metricsDaily.channel);
      return new Map(linhas.map((l) => [l.canal, numerico(l)]));
    });
  }

  async function total(p: { inicio: string; fim: string }): Promise<Somas> {
    return comTenant(db, r.tenantId, async (tx) => {
      const [l] = await tx
        .select(colunas)
        .from(metricsDaily)
        .where(and(periodo(p), ne(metricsDaily.channel, CANAL_FUNIL)));
      return numerico(l!);
    });
  }

  const contar = () =>
    comTenant(db, r.tenantId, async (tx) => {
      const [m] = await tx.select({ n: sql<number>`count(*)::int` }).from(metricsDaily);
      const [s] = await tx.select({ n: sql<number>`count(*)::int` }).from(sources);
      const [b] = await tx.select({ n: sql<number>`count(*)::int` }).from(memberships);
      const [a] = await tx.select({ n: sql<number>`count(*)::int` }).from(presentation);
      return { metricas: m!.n, fontes: s!.n, membros: b!.n, apresentacao: a!.n };
    });

  beforeAll(async () => {
    r = await executarSeed(db);
  });

  afterAll(async () => {
    await db.$client.end({ timeout: 5 });
  });

  it('cada canal soma exatamente a linha da tabela da imagem', async () => {
    const mapa = await porCanal(PERIODO_ATUAL);
    for (const l of referencia.tabela.linhas) {
      const s = mapa.get(l.canal);
      expect(s, l.canal).toEqual({
        investimento: l.investimento,
        cliques: l.cliques,
        visitas: l.visitas,
        cadastros: l.cadastros,
        ftds: l.ftdsQtd,
        ftdsValor: l.ftdsValor,
        depositos: l.depositos,
        base: 0,
      });
    }
    expect(mapa.get('Afiliados')?.investimento).toBeNull();
  });

  it('Total bate com a imagem (exceto as inconsistências impressas nela)', async () => {
    const t = await total(PERIODO_ATUAL);
    const ref = referencia.tabela.total;
    expect(t.investimento).toBe(ref.investimento);
    expect(t.visitas).toBe(ref.visitas);
    expect(t.cadastros).toBe(ref.cadastros);
    expect(t.ftds).toBe(ref.ftdsQtd);
    expect(t.depositos).toBe(ref.depositos);
    // A imagem imprime Total de Cliques 70.386 e FTDs Valor 137.780, mas as linhas somam
    // 60.016 e 137.200 (documentado em packages/fixtures/src/referencia.test.ts).
    expect(t.cliques).toBe(60016);
    expect(t.ftdsValor).toBe(137200);
  });

  it('CPA e ROAS por canal e no total', async () => {
    const mapa = await porCanal(PERIODO_ATUAL);
    for (const l of referencia.tabela.linhas) {
      const s = mapa.get(l.canal)!;
      if (l.cpa === null || l.roas === null) {
        expect(s.investimento).toBeNull();
        continue;
      }
      expect(Number((s.investimento! / s.ftds).toFixed(2))).toBe(l.cpa);
      // ROAS Email: 45.800 / 10.890 = 4,2057; a imagem mostra 4,20 (tolerância 0,01).
      expect(Math.abs(s.depositos / s.investimento! - l.roas)).toBeLessThanOrEqual(0.01);
    }
    const t = await total(PERIODO_ATUAL);
    expect(Number((t.depositos / t.investimento!).toFixed(2))).toBe(6.68);
    // 33.840 / 995 = 34,01; a imagem mostra 33,97 (inconsistência impressa, mesma das fixtures).
    expect(Number((t.investimento! / t.ftds).toFixed(2))).toBe(34.01);
    expect(Math.abs(t.investimento! / t.ftds - 33.97)).toBeLessThan(0.05);
  });

  it('variações dos KPIs contra o período anterior', async () => {
    const a = await total(PERIODO_ATUAL);
    const c = await total(PERIODO_COMPARACAO);
    const variacao = (x: number, y: number) => Number((((x - y) / y) * 100).toFixed(1));
    const kpi = (id: string) => referencia.kpis.find((k) => k.id === id)!.variacaoPct;
    expect(variacao(a.investimento!, c.investimento!)).toBe(kpi('investimento'));
    expect(variacao(a.ftds, c.ftds)).toBe(kpi('ftds'));
    expect(variacao(a.depositos, c.depositos)).toBe(kpi('depositos'));
    // CPA e ROAS derivam dos três acima; a imagem é inconsistente (-5,4% e +16,8% seriam
    // impossíveis junto com +12,5%, +18,6% e +22,1%). Valores obtidos do banco:
    const cpa = variacao(a.investimento! / a.ftds, c.investimento! / c.ftds);
    const roas = variacao(a.depositos / a.investimento!, c.depositos / c.investimento!);
    expect(cpa).toBe(-5.1);
    expect(roas).toBe(8.5);
  });

  it('funil da imagem reproduzível pelo canal reservado', async () => {
    const f = (await porCanal(PERIODO_ATUAL)).get(CANAL_FUNIL)!;
    const etapas = [f.base, f.cliques, f.visitas, f.cadastros, f.ftds];
    expect(etapas).toEqual(referencia.funil.etapas.map((e) => e.valor));
    const taxas = etapas.map((v, i) =>
      i === 0 ? 100 : Number(((v / etapas[i - 1]!) * 100).toFixed(1)),
    );
    expect(taxas).toEqual(referencia.funil.etapas.map((e) => e.taxaPct));
  });

  it('apresentação padrão, fonte e admin', async () => {
    await comTenant(db, r.tenantId, async (tx) => {
      const [ap] = await tx.select().from(presentation);
      expect(ap?.nomeExibicao).toBe('PASIO');
      expect(ap?.subtitulo).toBe(referencia.subtitulo);
      expect((ap?.kpis as { id: string }[]).map((k) => k.id)).toEqual(
        referencia.kpis.map((k) => k.id),
      );
      expect(ap?.columns as unknown[]).toHaveLength(10);
      const [fonte] = await tx.select().from(sources).where(eq(sources.slug, 'demo'));
      expect(fonte?.secretHash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
      const [m] = await tx.select().from(memberships).where(eq(memberships.userId, r.userId));
      expect(m?.role).toBe('admin');
    });
  });

  it('rodar de novo não duplica nem gira o segredo', async () => {
    const antes = await contar();
    const segunda = await executarSeed(db);
    expect(segunda.tenantId).toBe(r.tenantId);
    expect(segunda.segredoNovo).toBeUndefined();
    expect(await contar()).toEqual(antes);
    expect(antes.metricas).toBe(24 * 6 + 24 * 5);
  });
});
