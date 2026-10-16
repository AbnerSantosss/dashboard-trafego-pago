/**
 * Geometria da tela, portada de prototype/gerar.mjs (gate G1). Cada função devolve uma lista de nós
 * posicionados em px absolutos (tela de 1315×710); o React só os desenha.
 *
 * Calibração: cada texto/ícone tem um `slot` estável (ex.: "kpi.2.valor"). Rodando a mesma
 * geometria com o conteúdo da referência, o slot ganha a chave de calibração do protótipo
 * ("texto#n", na ordem de gerar.mjs). Assim o ajuste fino vale para qualquer dado real.
 */
import type { KpiId } from '@trafego/contratos';
import { referencia, type CabecalhoColuna, type ItemMenu } from '@trafego/fixtures';
import type { CSSProperties } from 'react';
import { calibracao } from './calibracao';
import type { TomDelta } from './regras';

export interface NoTexto {
  tipo: 'texto';
  slot: string;
  x: number;
  b: number;
  cls: string;
  texto: string;
  centro?: boolean;
  /** Valor animado pelo Contador (KPIs). */
  contador?: { valor: number; id: KpiId };
}
export interface NoIcone {
  tipo: 'icone';
  slot: string;
  nome: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cls?: string;
  cor?: string;
}
export interface NoCaixa {
  tipo: 'caixa';
  cls: string;
  x: number;
  y: number;
  w: number;
  h: number;
  estilo?: CSSProperties;
}
export interface NoSpark {
  tipo: 'spark';
  slot: string;
  x: number;
  pontos: number[];
}
export type No = NoTexto | NoIcone | NoCaixa | NoSpark;

// ---------------------------------------------------------------------------
// Conteúdo (strings já formatadas)

export interface KpiTela {
  id: KpiId;
  rotulo: string;
  valorTexto: string;
  valor: number | null;
  deltaTexto: string | null;
  direcao: 'alta' | 'baixa';
  tom: TomDelta;
  sparkline: number[] | null;
}

export interface LinhaTela {
  canal: string;
  cor: string | null;
  celulas: string[];
}

export interface ConteudoTela {
  titulo: string;
  subtitulo: string;
  atualizadoRotulo: string;
  atualizadoValor: string;
  exportar: string;
  limpar: string;
  filtros: { id: string; rotulo: string; valor: string }[];
  kpis: KpiTela[];
  legendaVariacao: string;
  funil: { titulo: string; etapas: { rotulo: string; valor: string; taxa: string }[] };
  tabela: {
    titulo: string;
    cabecalhos: CabecalhoColuna[];
    linhas: LinhaTela[];
    total: string[] | null;
  };
}

// ---------------------------------------------------------------------------
// Geometria medida (design/componentes.md)

export const NAV_Y: Record<string, number> = {
  'visao-geral': 105,
  'gestao-custos': 149.5,
  relatorios: 193.5,
};
const NAV_TXT: Record<string, [number, number]> = {
  'visao-geral': [57, 110],
  'gestao-custos': [56, 155],
  relatorios: [56, 199],
};
const NAV_IC_AJ: Record<string, [number, number]> = {
  'visao-geral': [3, 0],
  'gestao-custos': [-1, -3],
  relatorios: [2, 2],
};

export const FILTROS_GEO: Record<
  string,
  {
    box: [number, number, number, number];
    campo: [number, number, number, number];
    rot: number;
    val: number;
    chev: number;
  }
> = {
  periodo: { box: [194, 83, 235, 58], campo: [199, 108, 227, 30], rot: 207, val: 234, chev: 410.5 },
  comparar: {
    box: [441, 83, 223, 58],
    campo: [445, 108, 216, 30],
    rot: 453,
    val: 455,
    chev: 644.5,
  },
  canal: { box: [676, 83, 201, 58], campo: [680, 108, 193, 30], rot: 688, val: 691, chev: 856.5 },
  campanha: {
    box: [889, 83, 234, 58],
    campo: [894, 108, 225, 30],
    rot: 902,
    val: 906,
    chev: 1102.5,
  },
};
export const LIMPAR_GEO = { x: 1138, y: 83, w: 162, h: 58 };
export const EXPORTAR_GEO = { x: 1151, y: 21, w: 142, h: 39 };

const KPI_GEO = [
  { x: 194, w: 213, tile: 199, col: 261, spark: 347, aj: [0, 1, -2, 0], ic: [-2, -2] },
  { x: 419, w: 197, tile: 429, col: 492, spark: 558, aj: [2, -3, 4, -3], ic: [0, -1] },
  { x: 628, w: 213, tile: 639, col: 698, spark: 783, aj: [1, 2, -3, 1], ic: [3, -1] },
  { x: 854, w: 225, tile: 863, col: 925, spark: 1019, aj: [-1, 2, -2, 2], ic: [-2, 0] },
  { x: 1092, w: 208, tile: 1103, col: 1164, spark: 1240, aj: [3, 1, -3, 1], ic: [2, 1] },
] as const;
const TILE_COR: Record<KpiId, [string, string]> = {
  investimento: ['#022B5E', '#0F80F5'],
  ftds: ['#012D5C', '#0D7BF4'],
  cpa: ['#2C1F38', '#D55271'],
  depositos: ['#023A43', '#22EED2'],
  roas: ['#023A44', '#2AEBD8'],
};

/** Área do funil (o componente @trafego/graficos desenha dentro dela). */
export const FUNIL_GEO = { x: 194, y: 281, w: 444, h: 429 };
const FUNIL_TOPOS = [332, 395, 458, 520, 580];
const TAXA_Y = [352, 411, 475, 538, 597];

export const COL_X = [650, 720, 795, 845, 895, 951, 1000, 1079, 1160, 1230, 1300];
export const cx = (i: number) => ((COL_X[i] ?? 0) + (COL_X[i + 1] ?? 0)) / 2;
const LINHAS_Y = [397, 446, 495, 543, 591, 640];
/** Topo da linha i (além da 5ª, segue o passo médio). */
export const linhaY = (i: number) => LINHAS_Y[i] ?? 640 + (i - 5) * 48.6;

const ICONE_CANAL: Record<string, string> = {
  meta: 'canal-meta',
  email: 'canal-email',
  'e-mail': 'canal-email',
  sms: 'canal-sms',
  afiliados: 'canal-afiliados',
  outros: 'canal-outros',
};
const COR_ICONE_CANAL: Record<string, string> = {
  meta: '#1B8EE1',
  email: '#20E8BC',
  'e-mail': '#20E8BC',
  sms: '#1080F1',
  afiliados: '#27EBC5',
  outros: '#EDEB3A',
};
const chaveCanal = (c: string) => c.trim().toLowerCase();

// ---------------------------------------------------------------------------
// Montagem

function T(slot: string, x: number, b: number, cls: string, texto: string): NoTexto {
  return { tipo: 'texto', slot, x, b, cls, texto };
}
function TC(slot: string, x: number, b: number, cls: string, texto: string): NoTexto {
  return { tipo: 'texto', slot, x, b, cls, texto, centro: true };
}
function ic(
  slot: string,
  nome: string,
  x: number,
  y: number,
  w: number,
  h: number,
  cls = '',
  cor?: string,
): NoIcone {
  return { tipo: 'icone', slot, nome, x, y, w, h, cls, ...(cor ? { cor } : {}) };
}
function caixa(
  cls: string,
  x: number,
  y: number,
  w: number,
  h: number,
  estilo?: CSSProperties,
): NoCaixa {
  return { tipo: 'caixa', cls, x, y, w, h, ...(estilo ? { estilo } : {}) };
}

export function montarSidebar(menu: ItemMenu[], ativo: string): No[] {
  const nos: No[] = [];
  for (const m of menu.filter((i) => i.posicao === 'topo')) {
    const cy = NAV_Y[m.id] ?? 0;
    const [ajx, ajy] = NAV_IC_AJ[m.id] ?? [0, 0];
    const [tx, tb] = NAV_TXT[m.id] ?? [56, cy + 5];
    const on = m.id === ativo;
    if (on) nos.push(caixa('nav-ativo', 8, cy - 20, 160, 40));
    nos.push(
      ic(`nav.${m.id}.ic`, m.id, 21 + ajx, cy - 9.5 + ajy, 19, 19, on ? 'nav-ic-ativo' : 'nav-ic'),
    );
    nos.push(T(`nav.${m.id}`, tx, tb, on ? 'nav nav-on' : 'nav', m.rotulo));
  }
  const ajuda = menu.find((m) => m.posicao === 'rodape');
  if (ajuda) {
    nos.push(
      ic(
        'nav.ajuda.ic',
        ajuda.id,
        20.5,
        690,
        20,
        20,
        ajuda.id === ativo ? 'nav-ic-ativo' : 'nav-ic',
      ),
    );
    nos.push(T('nav.ajuda', 53, 707, ajuda.id === ativo ? 'nav nav-on' : 'nav', ajuda.rotulo));
  }
  return nos;
}

export function montarCabecalho(
  c: Pick<
    ConteudoTela,
    'titulo' | 'subtitulo' | 'atualizadoRotulo' | 'atualizadoValor' | 'exportar'
  >,
  comStatus = true,
): No[] {
  const nos: No[] = [
    T('titulo', 200, 42, 'titulo', c.titulo),
    T('subtitulo', 201, 67, 'subtitulo', c.subtitulo),
  ];
  if (!comStatus) return nos;
  nos.push(
    caixa('status-dot', 970, 31, 11, 11),
    T('status.rotulo', 992, 32, 'status', c.atualizadoRotulo),
    T('status.valor', 993, 50, 'status', c.atualizadoValor),
    caixa('btn-exportar', EXPORTAR_GEO.x, EXPORTAR_GEO.y, EXPORTAR_GEO.w, EXPORTAR_GEO.h),
    ic('exportar.ic', 'exportar', 1165, 31, 19, 19, 'ic-branco'),
    T('exportar', 1194, 45, 'btn-txt', c.exportar),
    ic('exportar.chev', 'chevron-down', 1264.5, 33.5, 14, 14, 'ic-sec'),
  );
  return nos;
}

export function montarPrincipal(c: ConteudoTela): No[] {
  const nos: No[] = montarCabecalho(c);

  // Filtros
  for (const f of c.filtros) {
    const g = FILTROS_GEO[f.id];
    if (!g) continue;
    nos.push(caixa('filtro', ...g.box), caixa('filtro-campo', ...g.campo));
    nos.push(T(`filtro.${f.id}.rot`, g.rot, 102, 'filtro-rot', f.rotulo));
    if (f.id === 'periodo')
      nos.push(ic('filtro.periodo.cal', 'calendario', 209, 113, 16, 18, 'ic-cal'));
    nos.push(T(`filtro.${f.id}.val`, g.val, 127, 'filtro-val', f.valor));
    nos.push(ic(`filtro.${f.id}.chev`, 'chevron-down', g.chev - 7, 116, 14, 14, 'ic-sec'));
  }
  nos.push(caixa('btn-limpar', LIMPAR_GEO.x, LIMPAR_GEO.y, LIMPAR_GEO.w, LIMPAR_GEO.h));
  nos.push(ic('limpar.ic', 'limpar', 1164, 100, 21, 21, 'ic-limpar'));
  nos.push(T('limpar', 1193, 117, 'limpar-txt', c.limpar));

  // KPIs
  c.kpis.slice(0, KPI_GEO.length).forEach((k, i) => {
    const g = KPI_GEO[i]!;
    const [bg, fg] = TILE_COR[k.id];
    nos.push(caixa('kpi', g.x, 156, g.w, 114));
    nos.push(caixa('tile', g.tile, 167, 46, 46, { background: bg, color: fg }));
    nos.push(ic(`kpi.${i}.ic`, k.id, g.tile + 9 + g.ic[0], 176 + g.ic[1], 28, 28, '', fg));
    nos.push(T(`kpi.${i}.rot`, g.col - 1 + g.aj[0], 183, 'kpi-rot', k.rotulo));
    const valor = T(`kpi.${i}.valor`, g.col, 211, 'kpi-val', k.valorTexto);
    if (k.valor !== null) valor.contador = { valor: k.valor, id: k.id };
    nos.push(valor);
    if (k.deltaTexto !== null) {
      const cls = k.tom === 'negativo' ? 'ic-neg' : k.tom === 'neutro' ? 'ic-neutro' : 'ic-pos';
      nos.push(
        ic(
          `kpi.${i}.seta`,
          k.direcao === 'alta' ? 'seta-alta' : 'seta-baixa',
          g.col - 2 + g.aj[1],
          k.direcao === 'alta' ? 232.5 : 230.5,
          11,
          11,
          cls,
        ),
      );
      nos.push(
        T(`kpi.${i}.delta`, g.col + 17 + g.aj[2], 242, `kpi-delta tom-${k.tom}`, k.deltaTexto),
      );
      nos.push(T(`kpi.${i}.vs`, g.col - 1 + g.aj[3], 259, 'kpi-vs', c.legendaVariacao));
    }
    if (k.sparkline)
      nos.push({ tipo: 'spark', slot: `kpi.${i}.spark`, x: g.spark, pontos: k.sparkline });
  });

  // Funil: só o card e o título; o desenho é do componente Funil. Os textos entram como nós
  // "fantasmas" (não desenhados) apenas para manter a contagem de chaves igual à do protótipo.
  nos.push(caixa('card funil-card', 194, 281, 444, 440));
  nos.push(T('funil.titulo', 208, 313, 'card-titulo', c.funil.titulo));
  nos.push(ic('funil.info', 'info', 361, 300, 15, 15, 'ic-sec'));
  c.funil.etapas.forEach((e, i) => {
    const topo = FUNIL_TOPOS[i] ?? 0;
    const ty = TAXA_Y[i] ?? 0;
    nos.push(TC(`fantasma.funil.${i}.rot`, 370, topo + 21.5, '', e.rotulo));
    nos.push(TC(`fantasma.funil.${i}.val`, 369, topo + 45, '', e.valor));
    nos.push(T(`fantasma.funil.${i}.pct`, 543, ty + 11, '', e.taxa));
    nos.push(
      T(
        `fantasma.funil.${i}.leg`,
        540,
        ty + 9,
        '',
        i === 0 ? referencia.funil.legendaBase : referencia.funil.legendaConversao,
      ),
    );
  });

  // Tabela
  const tb = c.tabela;
  nos.push(caixa('card tabela-card', 650, 281, 650, 440));
  nos.push(T('tabela.titulo', 662, 313, 'card-titulo', tb.titulo));
  nos.push(ic('tabela.info', 'info', 847, 300, 15, 15, 'ic-sec'));
  const nLinhas = tb.linhas.length;
  const fimGrade = linhaY(nLinhas);
  for (let i = 1; i < COL_X.length - 1; i++)
    nos.push(caixa('grade', COL_X[i]!, 330, 1, fimGrade - 330));
  nos.push(caixa('grade', 650, 330, 650, 1));
  nos.push(caixa('grade', 951, 360, 128, 1));
  for (let i = 0; i <= nLinhas; i++) nos.push(caixa('grade', 650, linhaY(i), 650, 1));

  const H = tb.cabecalhos;
  const r = (i: number) => H[i]?.rotulo ?? [];
  nos.push(T('th.0', 661, 366, 'th', r(0)[0] ?? ''));
  nos.push(TC('th.1', cx(1) - 8, 366, 'th', r(1)[0] ?? ''));
  nos.push(ic('th.1.ordenar', 'ordenar', 783, 356, 12, 12, 'ic-sec'));
  nos.push(TC('th.2', cx(2) + 0.5, 366, 'th', r(2)[0] ?? ''));
  nos.push(TC('th.3', cx(3) + 0.5, 366, 'th', r(3)[0] ?? ''));
  nos.push(TC('th.4', cx(4) + 0.5, 366, 'th', r(4)[0] ?? ''));
  nos.push(TC('th.5', (COL_X[5]! + COL_X[7]!) / 2 + 3, 350, 'th', r(5)[0] ?? ''));
  const sub = H[5]?.subcolunas ?? [];
  nos.push(TC('th.5.0', cx(5) + 1, 383, 'th', sub[0]?.rotulo[0] ?? ''));
  nos.push(TC('th.5.1', cx(6) + 1, 383, 'th', sub[1]?.rotulo[0] ?? ''));
  r(6).forEach((l, j) => nos.push(TC(`th.6.${j}`, cx(7) + 2.5, 352 + j * 15.5, 'th', l)));
  r(7).forEach((l, j) => nos.push(TC(`th.7.${j}`, cx(8) + [0, -3][j]!, 358 + j * 18, 'th', l)));
  nos.push(ic('th.7.info', 'info', 1206, 339.5, 14, 14, 'ic-sec'));
  r(8).forEach((l, j) => nos.push(TC(`th.8.${j}`, cx(9) + [4, -1][j]!, 358 + j * 18, 'th', l)));
  nos.push(ic('th.8.info', 'info', 1278, 339.5, 14, 14, 'ic-roas'));

  tb.linhas.forEach((l, i) => {
    const y0 = linhaY(i);
    const y1 = linhaY(i + 1);
    const base = y0 + 29;
    const k = chaveCanal(l.canal);
    const nome = ICONE_CANAL[k] ?? 'canal-outros';
    const cor = COR_ICONE_CANAL[k] ?? l.cor ?? '#748BA5';
    nos.push(ic(`linha.${i}.ic`, nome, 658, (y0 + y1) / 2 - 9, 19, 19, '', cor));
    const pequeno = k === 'afiliados' || k === 'outros';
    nos.push(
      T(`linha.${i}.canal`, 683, base - (pequeno ? 0.5 : 0), pequeno ? 'td td-pq' : 'td', l.canal),
    );
    l.celulas.forEach((v, j) => {
      const roas = j === 8 && v !== '–' && v !== '-';
      nos.push(TC(`linha.${i}.${j}`, cx(j + 1) + 1, base, roas ? 'td td-roas' : 'td', v));
    });
  });
  if (tb.total) {
    const y = linhaY(nLinhas);
    nos.push(caixa('total', 651, y, 648, 62));
    for (let i = 1; i < COL_X.length - 1; i++) nos.push(caixa('grade-total', COL_X[i]!, y, 1, 62));
    nos.push(T('total.canal', 660, y + 37, 'td-total', 'Total'));
    tb.total.forEach((v, j) => nos.push(TC(`total.${j}`, cx(j + 1) + 0.5, y + 37, 'td-total', v)));
  }
  return nos;
}

// ---------------------------------------------------------------------------
// Chaves de calibração

/** Conteúdo exatamente como o protótipo o imprimiu (inclusive as divergências da imagem). */
function conteudoReferencia(): ConteudoTela {
  const R = referencia;
  const comoNaImagem = (id: string, campo: string, v: string) => {
    if (campo === 'cadastros' && id === 'meta') return v.replace('.', ',');
    if (campo === 'cliques' && id === 'outros') return v.replace('.', ',');
    return v === '–' ? '-' : v;
  };
  const campos = [
    'investimento',
    'cliques',
    'visitas',
    'cadastros',
    'ftdsQtd',
    'ftdsValor',
    'depositos',
    'cpa',
    'roas',
  ] as const;
  return {
    titulo: R.titulo,
    subtitulo: R.subtitulo,
    atualizadoRotulo: R.atualizadoEm.rotulo,
    atualizadoValor: R.atualizadoEm.valor,
    exportar: R.botoes.exportar,
    limpar: R.botoes.limparFiltros,
    filtros: R.filtros,
    legendaVariacao: R.legendaVariacao,
    kpis: R.kpis.map((k) => ({
      id: k.id,
      rotulo: k.rotulo,
      valorTexto: k.valorFormatado,
      valor: k.valor,
      deltaTexto: k.variacaoFormatada,
      direcao: k.direcao,
      tom: 'positivo',
      sparkline: [],
    })),
    funil: {
      titulo: R.funil.titulo,
      etapas: R.funil.etapas.map((e) => ({
        rotulo: e.rotulo,
        valor: e.valorFormatado,
        taxa: e.taxaFormatada,
      })),
    },
    tabela: {
      titulo: R.tabela.titulo,
      cabecalhos: R.tabela.cabecalhos,
      linhas: R.tabela.linhas.map((l) => ({
        canal: l.canal,
        cor: null,
        celulas: campos.map((c) => comoNaImagem(l.id, c, l.formatado[c])),
      })),
      total: campos.map((c) => R.tabela.total.formatado[c]),
    },
  };
}

function calcularChaves(): Map<string, string> {
  const nos = [
    ...montarSidebar(referencia.menu, 'visao-geral'),
    ...montarPrincipal(conteudoReferencia()),
  ];
  const vistos = new Map<string, number>();
  const mapa = new Map<string, string>();
  for (const no of nos) {
    if (no.tipo !== 'texto' && no.tipo !== 'icone') continue;
    const base = no.tipo === 'texto' ? no.texto : `ic:${no.nome}`;
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    mapa.set(no.slot, `${base}#${n}`);
  }
  return mapa;
}

const CHAVES = calcularChaves();
const FAMILIAS = [
  '',
  "'Segoe UI Variable Text'",
  "'Segoe UI Variable Display'",
  "'Segoe UI Variable Small'",
];

/** Estilo de calibração (tamanho, peso, família, deslocamento subpixel) do slot. */
export function estiloCalibrado(slot: string): Record<string, string | number> {
  const chave = CHAVES.get(slot);
  const c = chave ? calibracao[chave] : undefined;
  if (!c) return {};
  const e: Record<string, string | number> = {};
  if (c.fs) e.fontSize = `${c.fs}px`;
  if (c.fw) e.fontWeight = c.fw;
  if (c.ff) e.fontFamily = FAMILIAS[c.ff] ?? '';
  if (c.dx) e['--dx'] = `${c.dx}px`;
  if (c.dy) e['--dy'] = `${c.dy}px`;
  if (c.rx) e['--rx'] = `${c.rx}px`;
  if (c.ry) e['--ry'] = `${c.ry}px`;
  if (c.op) e.opacity = c.op;
  if (c.sw) e['--sw'] = c.sw;
  return e;
}
