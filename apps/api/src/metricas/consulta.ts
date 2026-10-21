/**
 * Leitura da Visão Geral no banco. Tudo roda dentro de `comTenant` (RLS): o `tx` recebido já
 * tem `app.tenant_id` fixado, então nenhuma consulta filtra `tenant_id` à mão.
 *
 * SQL principal (resumo):
 *   select day, channel, sum(investimento), sum(base_contatada), sum(cliques), ...
 *   from metrics_daily
 *   where day between <início da comparação> and <fim do período>
 *     and (left(channel, 2) = '__' or campaign = <campanha>)   -- só com filtro de campanha
 *   group by day, channel
 * Redepósitos (sexta etapa do funil) são contados em `events`, em `contarRedepositos`.
 * O resto (filtro de canal, KPIs, sparklines, funil, tabela) é calculado em `calculo.ts`.
 */
import { and, between, eq, max, ne, or, sql, type SQL } from 'drizzle-orm';
import type {
  Apresentacao,
  CanalApresentacao,
  KpiId,
  Periodo,
  VisaoGeralQuery,
  VisaoGeralResposta,
} from '@trafego/contratos';
import {
  events,
  metricsDaily,
  presentation,
  tenants,
  webhookEvents,
  type Tx,
} from '../db/client.js';
import { ErroApi } from '../erros.js';
import { calcularVisaoGeral, ORDEM_KPIS, type SomaDiaCanal } from './calculo.js';
import {
  DIAS_MAXIMO,
  DIAS_PADRAO,
  duracaoDias,
  hojeNoFuso,
  periodoAnterior,
  somarDias,
} from './periodo.js';

/** Query depois do zod: opcionais de filtro já com padrão. */
export interface QueryNormalizada {
  de?: string | undefined;
  ate?: string | undefined;
  comparar: NonNullable<VisaoGeralQuery['comparar']>;
  canal: string;
  campanha: string;
}

const m = metricsDaily;
const reservado = sql`left(${m.channel}, 2) = '__'`;
const visivel = sql`left(${m.channel}, 2) <> '__'`;

/** Resolve o período: padrão de 24 dias terminando no último dia com dados (ou hoje no fuso). */
export async function resolverPeriodo(tx: Tx, q: QueryNormalizada, fuso: string): Promise<Periodo> {
  let { de, ate } = q;
  if (!de && !ate) {
    const [linha] = await tx
      .select({ dia: max(m.day) })
      .from(m)
      .where(visivel);
    ate = linha?.dia ?? hojeNoFuso(fuso);
  }
  if (!de) de = somarDias(ate!, -(DIAS_PADRAO - 1));
  if (!ate) ate = somarDias(de, DIAS_PADRAO - 1);
  if (de > ate) {
    throw ErroApi.de('validacao_invalida', 'A data inicial (de) é posterior à final (ate).', {
      de,
      ate,
    });
  }
  if (duracaoDias(de, ate) > DIAS_MAXIMO) {
    throw ErroApi.de('validacao_invalida', `Período máximo de ${DIAS_MAXIMO} dias.`, { de, ate });
  }
  return { de, ate };
}

const num = (v: string | number | null | undefined) =>
  v === null || v === undefined ? 0 : Number(v);

function listaDeIds(bruto: unknown): string[] {
  if (!Array.isArray(bruto)) return [];
  const itens = bruto
    .map((x, i) => {
      if (typeof x === 'string') return { id: x, ordem: i, visivel: true };
      if (x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string') {
        const o = x as { id: string; ordem?: unknown; visivel?: unknown };
        return {
          id: o.id,
          ordem: typeof o.ordem === 'number' ? o.ordem : i,
          visivel: o.visivel !== false,
        };
      }
      return null;
    })
    .filter((x): x is { id: string; ordem: number; visivel: boolean } => x !== null && x.visivel);
  return itens.sort((a, b) => a.ordem - b.ordem).map((x) => x.id);
}

function canaisApresentacao(bruto: unknown): CanalApresentacao[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.flatMap((x, i) => {
    if (!x || typeof x !== 'object') return [];
    const o = x as { canal?: unknown; nome?: unknown; cor?: unknown; ordem?: unknown };
    const canal =
      typeof o.canal === 'string' ? o.canal : typeof o.nome === 'string' ? o.nome : null;
    if (!canal || typeof o.cor !== 'string') return [];
    return [{ canal, cor: o.cor, ordem: typeof o.ordem === 'number' ? o.ordem : i + 1 }];
  });
}

function paleta(bruto: unknown): Record<string, string> {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return {};
  return Object.fromEntries(
    Object.entries(bruto as Record<string, unknown>).filter(
      (p): p is [string, string] => typeof p[1] === 'string',
    ),
  );
}

async function lerApresentacao(tx: Tx, tenantId: string): Promise<Apresentacao> {
  const [t] = await tx
    .select({
      nome: tenants.nome,
      logoUrl: tenants.logoUrl,
      moeda: tenants.moeda,
      fuso: tenants.fuso,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId));
  if (!t) throw ErroApi.de('nao_encontrado', 'Empresa não encontrada.');
  const [p] = await tx.select().from(presentation).limit(1);
  const kpisValidos = new Set<string>(ORDEM_KPIS);
  return {
    nomeExibicao: p?.nomeExibicao ?? t.nome,
    logoUrl: p ? p.logoUrl : t.logoUrl,
    subtitulo: p?.subtitulo ?? null,
    kpis: listaDeIds(p?.kpis).filter((k): k is KpiId => kpisValidos.has(k)),
    columns: listaDeIds(p?.columns),
    channels: canaisApresentacao(p?.channels),
    palette: paleta(p?.palette),
    currency: t.moeda,
    timezone: t.fuso,
  };
}

/** Monta a resposta completa da Visão Geral. `tx` precisa estar sob `comTenant`. */
export async function consultarVisaoGeral(
  tx: Tx,
  tenantId: string,
  q: QueryNormalizada,
): Promise<VisaoGeralResposta> {
  const apresentacao = await lerApresentacao(tx, tenantId);
  const periodo = await resolverPeriodo(tx, q, apresentacao.timezone);
  const comparacao = q.comparar === 'anterior' ? periodoAnterior(periodo.de, periodo.ate) : null;
  const inicio = comparacao?.de ?? periodo.de;

  const filtros: SQL[] = [between(m.day, inicio, periodo.ate)];
  if (q.campanha !== 'todas') filtros.push(or(reservado, eq(m.campaign, q.campanha))!);

  const brutas = await tx
    .select({
      dia: m.day,
      canal: m.channel,
      investimento: sql<string | null>`sum(${m.investimento})`,
      base: sql<string>`sum(${m.baseContatada})`,
      cliques: sql<string>`sum(${m.cliques})`,
      visitas: sql<string>`sum(${m.visitas})`,
      cadastros: sql<string>`sum(${m.cadastros})`,
      ftds: sql<string>`sum(${m.ftds})`,
      ftdsValor: sql<string>`sum(${m.ftdsValor})`,
      depositos: sql<string>`sum(${m.depositos})`,
    })
    .from(m)
    .where(and(...filtros))
    .groupBy(m.day, m.channel);

  const linhas: SomaDiaCanal[] = brutas.map((l) => ({
    dia: l.dia,
    canal: l.canal,
    investimento: l.investimento === null ? null : Number(l.investimento),
    base: num(l.base),
    cliques: num(l.cliques),
    visitas: num(l.visitas),
    cadastros: num(l.cadastros),
    ftds: num(l.ftds),
    ftdsValor: num(l.ftdsValor),
    depositos: num(l.depositos),
  }));

  const canais = await tx.selectDistinct({ canal: m.channel }).from(m).where(visivel);
  const campanhas = await tx
    .selectDistinct({ campanha: m.campaign })
    .from(m)
    .where(and(visivel, ne(m.campaign, ''), between(m.day, periodo.de, periodo.ate)));
  const [ultimo] = await tx
    .select({ em: sql<string | null>`max(${webhookEvents.processedAt})` })
    .from(webhookEvents);
  const redepositos = await contarRedepositos(tx, q, periodo, apresentacao.timezone);

  return calcularVisaoGeral({
    periodo,
    comparacao,
    linhas,
    canal: q.canal,
    canaisVisiveis: canais.map((c) => c.canal),
    campanhas: campanhas.map((c) => c.campanha),
    apresentacao,
    atualizadoEm: ultimo?.em ? new Date(ultimo.em).toISOString() : null,
    redepositos,
  });
}

/**
 * Redepósitos do período (eventos `deposito`, dia no fuso da empresa, sem canais `__`), com os
 * mesmos filtros de canal e campanha da lista da etapa. Zero enquanto a GTech não mandar nenhum.
 */
async function contarRedepositos(
  tx: Tx,
  q: QueryNormalizada,
  periodo: Periodo,
  fuso: string,
): Promise<number> {
  const ehRedeposito = eq(events.type, 'deposito');
  const dia = sql`(${events.occurredAt} at time zone ${fuso})::date`;
  const filtros: SQL[] = [
    ehRedeposito,
    sql`${dia} between ${periodo.de}::date and ${periodo.ate}::date`,
    sql`left(${events.channel}, 2) <> '__'`,
  ];
  if (q.canal !== 'todos') filtros.push(eq(events.channel, q.canal));
  if (q.campanha !== 'todas') filtros.push(eq(events.campaign, q.campanha));
  const [linha] = await tx
    .select({ n: sql<string>`count(*)` })
    .from(events)
    .where(and(...filtros));
  return num(linha?.n);
}
