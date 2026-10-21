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

/** Etapa cuja lista de pessoas explica cada KPI; investimento não tem pessoas por trás. */
export const ETAPA_DO_KPI: Record<KpiId, 'ftd' | 'depositos' | null> = {
  investimento: null,
  ftds: 'ftd',
  cpa: 'ftd',
  depositos: 'depositos',
  roas: 'depositos',
};

/** O que cada KPI mede, dito no topo do consolidado por canal. */
export const EXPLICA_KPI: Record<KpiId, string> = {
  investimento: 'Soma dos gastos de cada canal no período, lançados à mão ou importados.',
  ftds: 'Primeiros depósitos (FTD) atribuídos a cada canal de origem.',
  cpa: 'Investimento do canal dividido pelos FTDs dele. Quanto menor, melhor.',
  depositos: 'Tudo o que foi depositado no período, separado pelo canal de origem.',
  roas: 'Depósitos do canal divididos pelo investimento dele. Acima de 1x, o canal se paga.',
};

export interface LinhaConsolidado {
  canal: string;
  valor: number | null;
  texto: string;
  /** 0 a 1: fatia do total (somas) ou proporção do maior valor (CPA e ROAS). */
  fracao: number;
  detalhe: string;
  /** Há pessoas para listar neste canal (FTDs ou depósitos). */
  temPessoas: boolean;
}

function valorDaLinha(id: KpiId, l: LinhaCanalMetrica): number | null {
  switch (id) {
    case 'investimento':
      return l.investimento;
    case 'ftds':
      return l.ftdsQtd;
    case 'cpa':
      return l.cpa;
    case 'depositos':
      return l.depositos;
    case 'roas':
      return l.roas;
  }
}

/**
 * Consolidado de um KPI por canal, do melhor para o pior (CPA do menor para o maior); canais sem
 * valor vão para o fim. Somas mostram a fatia do total; CPA e ROAS, a proporção do maior.
 */
export function consolidarKpi(id: KpiId, linhas: LinhaCanalMetrica[]): LinhaConsolidado[] {
  const soma = id !== 'cpa' && id !== 'roas';
  const valores = linhas.map((l) => valorDaLinha(id, l));
  const validos = valores.filter((v): v is number => v !== null);
  const base = soma ? validos.reduce((a, v) => a + v, 0) : Math.max(0, ...validos);
  const etapa = ETAPA_DO_KPI[id];
  const res = linhas.map((l, i): LinhaConsolidado => {
    const valor = valores[i]!;
    const fracao = valor === null || base <= 0 ? 0 : Math.min(1, Math.max(0, valor / base));
    let detalhe: string;
    if (id === 'cpa') {
      detalhe =
        valor === null
          ? 'Sem FTD no período'
          : `${formatarMoeda(l.investimento ?? 0)} ÷ ${formatarInteiro(l.ftdsQtd)} FTDs`;
    } else if (id === 'roas') {
      detalhe =
        valor === null
          ? 'Sem investimento no período'
          : `${formatarMoeda(l.depositos)} ÷ ${formatarMoeda(l.investimento ?? 0)}`;
    } else if (valor === null) {
      detalhe = 'Sem gasto lançado';
    } else {
      detalhe = `${formatarPercentual(fracao * 100)} do total`;
      if (id === 'ftds') detalhe += ` · ${formatarMoeda(l.ftdsValor)} no 1º depósito`;
    }
    return {
      canal: l.canal,
      valor,
      texto: valor === null ? NULO : formatarKpi(id, valor),
      fracao,
      detalhe,
      temPessoas: etapa === 'ftd' ? l.ftdsQtd > 0 : etapa === 'depositos' ? l.depositos > 0 : false,
    };
  });
  const sinal = id === 'cpa' ? 1 : -1;
  return res.sort((a, b) => {
    if (a.valor === null && b.valor === null) return 0;
    if (a.valor === null) return 1;
    if (b.valor === null) return -1;
    return sinal * (a.valor - b.valor);
  });
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

/** Atalhos do filtro de período (o quarto caminho é a data personalizada, De/Até). */
export type AtalhoPeriodo = 'hoje' | 'ontem' | '7dias';
export const ATALHOS_PERIODO: { id: AtalhoPeriodo; rotulo: string }[] = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'ontem', rotulo: 'Ontem' },
  { id: '7dias', rotulo: 'Últimos 7 dias' },
];

/** Dia civil (AAAA-MM-DD) de um instante no fuso da empresa. */
export function diaNoFuso(agora: Date, fuso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Período de um atalho, contado a partir do dia de hoje no fuso da empresa (inclusivo). */
export function periodoDoAtalho(
  atalho: AtalhoPeriodo,
  agora: Date,
  fuso: string,
): { de: string; ate: string } {
  const hoje = diaNoFuso(agora, fuso);
  if (atalho === 'hoje') return { de: hoje, ate: hoje };
  if (atalho === 'ontem') {
    const ontem = somarDias(hoje, -1);
    return { de: ontem, ate: ontem };
  }
  return { de: somarDias(hoje, -6), ate: hoje };
}

/** Qual atalho corresponde ao período aberto, ou null (data personalizada). */
export function atalhoAtivo(
  de: string,
  ate: string,
  agora: Date,
  fuso: string,
): AtalhoPeriodo | null {
  return (
    ATALHOS_PERIODO.find((a) => {
      const p = periodoDoAtalho(a.id, agora, fuso);
      return p.de === de && p.ate === ate;
    })?.id ?? null
  );
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

/** Número escrito como texto (ex. "-12,5"): o Excel lê como número, não como fórmula. */
const NUMERO_TEXTO = /^[-+]?\d+(?:[.,]\d+)?$/;

/**
 * Campo de texto do CSV (nome do canal, cabeçalho). Começando com `=`, `+`, `-`, `@`, tab ou CR, o
 * Excel e o Sheets executariam o texto como fórmula (injeção de CSV): o `'` na frente o mantém
 * como texto. Os valores numéricos saem por `numeroCsv` e não passam por aqui.
 */
function campoCsv(s: string): string {
  const seguro = /^[=+\-@\t\r]/.test(s) && !NUMERO_TEXTO.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
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
