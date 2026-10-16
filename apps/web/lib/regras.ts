/**
 * Regras puras da Visão Geral: formatação de células, ordenação, filtros na URL, cor do delta e CSV.
 * Sem React nem rede, para serem testadas isoladamente.
 */
import type { KpiId, LinhaCanalMetrica, VisaoGeralQuery } from '@trafego/contratos';
import {
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
  formatarRoas,
  NULO,
} from '@trafego/fixtures';

// ---------------------------------------------------------------------------
// KPIs

/** Formata o valor de um KPI conforme a métrica. */
export function formatarKpi(id: KpiId, n: number): string {
  switch (id) {
    case 'investimento':
    case 'depositos':
      return formatarMoeda(n);
    case 'cpa':
      return formatarMoeda(n, { centavos: true });
    case 'roas':
      return formatarRoas(n);
    case 'ftds':
      return formatarInteiro(n);
  }
}

/** Métricas em que cair é bom (CPA: custo menor por FTD). */
const MENOR_E_MELHOR: ReadonlySet<KpiId> = new Set<KpiId>(['cpa']);

export type TomDelta = 'positivo' | 'negativo' | 'neutro';

/** Cor do delta conforme a métrica: CPA caindo é positivo (verde); investimento subindo também. */
export function tomDelta(id: KpiId, variacaoPct: number | null): TomDelta {
  if (variacaoPct === null || variacaoPct === 0) return 'neutro';
  const subiu = variacaoPct > 0;
  return subiu !== MENOR_E_MELHOR.has(id) ? 'positivo' : 'negativo';
}

/** Texto do delta sem sinal de "+" (a seta indica a direção); negativo com hífen, como na imagem. */
export function formatarDelta(variacaoPct: number | null): string | null {
  return variacaoPct === null ? null : formatarPercentual(variacaoPct);
}

// ---------------------------------------------------------------------------
// Tabela

export type ColunaDado =
  | 'investimento'
  | 'cliques'
  | 'visitas'
  | 'cadastros'
  | 'ftdsQtd'
  | 'ftdsValor'
  | 'depositos'
  | 'cpa'
  | 'roas';

export type ColunaTabela = 'canal' | ColunaDado;

/** Colunas na ordem exibida. */
export const COLUNAS_DADO: ColunaDado[] = [
  'investimento',
  'cliques',
  'visitas',
  'cadastros',
  'ftdsQtd',
  'ftdsValor',
  'depositos',
  'cpa',
  'roas',
];

/** Cabeçalho "achatado" usado no CSV (mesma ordem da tela). */
export const ROTULOS_CSV: Record<ColunaTabela, string> = {
  canal: 'Canal',
  investimento: 'Investimento',
  cliques: 'Cliques',
  visitas: 'Visitas',
  cadastros: 'Cadastros',
  ftdsQtd: 'FTDs Qtd.',
  ftdsValor: 'FTDs Valor (R$)',
  depositos: 'Depósitos no período (R$)',
  cpa: 'CPA (R$)',
  roas: 'ROAS (Depósitos)',
};

/** Texto exibido numa célula; `null` vira "–". */
export function formatarCelula(coluna: ColunaDado, linha: LinhaCanalMetrica): string {
  const v = linha[coluna];
  if (v === null) return NULO;
  switch (coluna) {
    case 'investimento':
    case 'ftdsValor':
    case 'depositos':
      return formatarMoeda(v);
    case 'cpa':
      return formatarMoeda(v, { centavos: true });
    case 'roas':
      return formatarRoas(v);
    default:
      return formatarInteiro(v);
  }
}

export type Direcao = 'asc' | 'desc';
export interface Ordenacao {
  coluna: ColunaTabela;
  direcao: Direcao;
}

/**
 * Ordena as linhas (sem a de total). Sem ordenação, mantém a ordem da API.
 * Nulos vão sempre para o fim; empate preserva a ordem original (sort estável).
 */
export function ordenarLinhas(
  linhas: LinhaCanalMetrica[],
  ordem: Ordenacao | null,
): LinhaCanalMetrica[] {
  if (!ordem) return linhas;
  const { coluna, direcao } = ordem;
  const sinal = direcao === 'asc' ? 1 : -1;
  return [...linhas].sort((a, b) => {
    if (coluna === 'canal') return sinal * a.canal.localeCompare(b.canal, 'pt-BR');
    const va = a[coluna];
    const vb = b[coluna];
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return sinal * (va - vb);
  });
}

/** Próximo estado ao clicar num cabeçalho: desc → asc → ordem da API. */
export function proximaOrdenacao(atual: Ordenacao | null, coluna: ColunaTabela): Ordenacao | null {
  const inicial: Direcao = coluna === 'canal' ? 'asc' : 'desc';
  if (!atual || atual.coluna !== coluna) return { coluna, direcao: inicial };
  if (atual.direcao === inicial) return { coluna, direcao: inicial === 'asc' ? 'desc' : 'asc' };
  return null;
}

// ---------------------------------------------------------------------------
// Filtros na URL

export interface Filtros {
  de?: string;
  ate?: string;
  comparar: 'anterior' | 'nenhum';
  canal: string;
  campanha: string;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

type Parametros = Record<string, string | string[] | undefined>;

function primeiro(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Lê os filtros dos parâmetros da URL, descartando valores inválidos. */
export function lerFiltros(p: Parametros): Filtros {
  const de = primeiro(p.de);
  const ate = primeiro(p.ate);
  const f: Filtros = {
    comparar: primeiro(p.comparar) === 'nenhum' ? 'nenhum' : 'anterior',
    canal: primeiro(p.canal)?.trim() || 'todos',
    campanha: primeiro(p.campanha)?.trim() || 'todas',
  };
  if (de && DATA_ISO.test(de)) f.de = de;
  if (ate && DATA_ISO.test(ate)) f.ate = ate;
  if (f.de && f.ate && f.de > f.ate) [f.de, f.ate] = [f.ate, f.de];
  return f;
}

/** Monta a query string (sem "?") só com o que difere do padrão. */
export function montarBusca(f: Filtros): string {
  const s = new URLSearchParams();
  if (f.de) s.set('de', f.de);
  if (f.ate) s.set('ate', f.ate);
  if (f.comparar !== 'anterior') s.set('comparar', f.comparar);
  if (f.canal !== 'todos') s.set('canal', f.canal);
  if (f.campanha !== 'todas') s.set('campanha', f.campanha);
  return s.toString();
}

/** Query da API a partir dos filtros. */
export function paraQueryApi(f: Filtros): VisaoGeralQuery {
  const q: VisaoGeralQuery = { comparar: f.comparar, canal: f.canal, campanha: f.campanha };
  if (f.de) q.de = f.de;
  if (f.ate) q.ate = f.ate;
  return q;
}

// ---------------------------------------------------------------------------
// Datas

/** "2024-05-01" → "01/05/2024". */
export function formatarDataIso(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** Instante ISO → "24/05/2024 08:30" no fuso informado. */
export function formatarDataHora(iso: string, fuso: string): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return `${v('day')}/${v('month')}/${v('year')} ${v('hour')}:${v('minute')}`;
}

/** "Dados atualizados em": data e hora do último webhook ou, sem ele, só a data final do período. */
export function textoAtualizacao(atualizadoEm: string | null, ate: string, fuso: string): string {
  return atualizadoEm ? formatarDataHora(atualizadoEm, fuso) : formatarDataIso(ate);
}

// ---------------------------------------------------------------------------
// CSV

function numeroCsv(n: number | null, casas: number): string {
  if (n === null) return '';
  return n.toFixed(casas).replace('.', ',');
}

const CASAS_CSV: Record<ColunaDado, number> = {
  investimento: 2,
  cliques: 0,
  visitas: 0,
  cadastros: 0,
  ftdsQtd: 0,
  ftdsValor: 2,
  depositos: 2,
  cpa: 2,
  roas: 2,
};

function campoCsv(s: string): string {
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV da tabela: colunas na ordem exibida, separador `;`, decimal com vírgula, sem milhar,
 * BOM UTF-8 no início e linha Total no fim. Nulos ficam vazios.
 */
export function gerarCsv(linhas: LinhaCanalMetrica[], total: LinhaCanalMetrica | null): string {
  const colunas: ColunaTabela[] = ['canal', ...COLUNAS_DADO];
  const cab = colunas.map((c) => campoCsv(ROTULOS_CSV[c])).join(';');
  const corpo = [...linhas, ...(total ? [{ ...total, canal: 'Total' }] : [])].map((l) =>
    colunas
      .map((c) => (c === 'canal' ? campoCsv(l.canal) : numeroCsv(l[c], CASAS_CSV[c])))
      .join(';'),
  );
  return '﻿' + [cab, ...corpo].join('\r\n') + '\r\n';
}

export function nomeArquivoCsv(de: string, ate: string): string {
  return `desempenho-por-canal_${de}_${ate}.csv`;
}
