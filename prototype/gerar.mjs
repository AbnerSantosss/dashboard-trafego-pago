// Gera prototype/index.html a partir de packages/fixtures/referencia.json e do sprite de ícones.
// Uso (na raiz): node prototype/gerar.mjs
// O HTML gerado é estático: abre via file:// sem rede e sem JS. Coordenadas medidas em
// design/componentes.md (P1.2); este arquivo só posiciona, não inventa números.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const dados = JSON.parse(readFileSync(resolve(RAIZ, 'packages/fixtures/referencia.json'), 'utf8'));
const sprite = readFileSync(resolve(RAIZ, 'packages/design/icons/sprite.svg'), 'utf8');

// ---------------------------------------------------------------------------
// Divergências fixtures × imagem: a imagem vence no protótipo (gate visual).
// - Meta cadastros e Outros cliques: fixture "1.900"/"1.420", imagem "1,900"/"1,420" (vírgula).
// - Afiliados vazios: fixture "–" (meia-risca), imagem "-" (hífen ASCII).
const comoNaImagem = (id, campo, v) => {
  if (campo === 'cadastros' && id === 'meta') return v.replace('.', ',');
  if (campo === 'cliques' && id === 'outros') return v.replace('.', ',');
  return v === '–' ? '-' : v;
};

// ---------------------------------------------------------------------------
// Helpers de texto. Segoe UI com line-height 1: linha de base = topo + 0,91 em.
const K_BASE = 0.91;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const px = (n) => `${+n.toFixed(2)}px`;
// Calibração fina por elemento (gerada por prototype/calibrar.mjs): tamanho, peso e
// deslocamento subpixel que minimizam o diff de cada texto contra a referência.
const CAL_ARQ = resolve(AQUI, 'calibracao.json');
const cal =
  existsSync(CAL_ARQ) && !process.env.SEM_CALIBRACAO
    ? JSON.parse(readFileSync(CAL_ARQ, 'utf8'))
    : {};
// Mesma ordem de prototype/calibrar.mjs (0 = família do CSS).
const FAMILIAS_CAL = [
  '',
  "'Segoe UI Variable Text'",
  "'Segoe UI Variable Display'",
  "'Segoe UI Variable Small'",
];
const vistos = new Map();
function chave(texto) {
  const n = (vistos.get(texto) ?? 0) + 1;
  vistos.set(texto, n);
  return `${texto}#${n}`;
}
function estiloCal(k) {
  const c = cal[k];
  if (!c) return '';
  let e = '';
  if (c.fs) e += `font-size:${c.fs}px;`;
  if (c.fw) e += `font-weight:${c.fw};`;
  if (c.ff) e += `font-family:${FAMILIAS_CAL[c.ff]};`;
  if (c.dx) e += `--dx:${c.dx}px;`;
  if (c.dy) e += `--dy:${c.dy}px;`;
  if (c.rx) e += `--rx:${c.rx}px;`;
  if (c.ry) e += `--ry:${c.ry}px;`;
  if (c.op) e += `opacity:${c.op};`;
  if (c.sw) e += `--sw:${c.sw};`;
  return e;
}
/** Texto alinhado à esquerda: x = início, base = linha de base. */
function T(x, base, cls, texto, estilo = '') {
  const k = chave(texto);
  return `<span class="t ${cls}" data-k="${esc(k)}" style="--x:${px(x)};--b:${base};${estilo}${estiloCal(k)}">${esc(texto)}</span>`;
}
/** Texto centralizado em cx. */
function TC(cx, base, cls, texto, estilo = '') {
  const k = chave(texto);
  return `<span class="t c ${cls}" data-k="${esc(k)}" style="--x:${px(cx)};--b:${base};${estilo}${estiloCal(k)}">${esc(texto)}</span>`;
}
const ic = (nome, x, y, w, h, cls = '', estilo = '') => {
  const k = chave(`ic:${nome}`);
  return `<svg class="ic ${cls}" data-k="${k}" style="left:${px(x)};top:${px(y)};width:${px(w)};height:${px(h)};${estilo}${estiloCal(k)}" aria-hidden="true"><use href="#icone-${nome}"/></svg>`;
};
const caixa = (cls, x, y, w, h, estilo = '') =>
  `<div class="${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${estilo}"></div>`;

// ---------------------------------------------------------------------------
// Sidebar
const menu = dados.menu;
const navY = { 'visao-geral': 105, 'gestao-custos': 149.5, relatorios: 193.5 };
const navTxt = { 'visao-geral': [57, 110], 'gestao-custos': [56, 155], relatorios: [56, 199] };
const navIcAj = { 'visao-geral': [3, 0], 'gestao-custos': [-1, -3], relatorios: [2, 2] };
let sidebar = '';
for (const m of menu.filter((m) => m.posicao === 'topo')) {
  const cy = navY[m.id];
  if (m.ativo) sidebar += caixa('nav-ativo', 8, 85, 160, 40);
  sidebar += ic(
    m.id,
    21 + navIcAj[m.id][0],
    cy - 9.5 + navIcAj[m.id][1],
    19,
    19,
    m.ativo ? 'nav-ic-ativo' : 'nav-ic',
  );
  sidebar += T(navTxt[m.id][0], navTxt[m.id][1], m.ativo ? 'nav nav-on' : 'nav', m.rotulo);
}
const ajuda = menu.find((m) => m.posicao === 'rodape');
sidebar += ic(ajuda.id, 20.5, 690, 20, 20, 'nav-ic');
sidebar += T(53, 707, 'nav', ajuda.rotulo);

const logo = `
  <div class="logo logo-ref" aria-hidden="true">
    <svg viewBox="0 0 56 54" width="56" height="54">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#5C84C4"/><stop offset=".5" stop-color="#5568B0"/><stop offset="1" stop-color="#5350A0"/>
        </linearGradient>
      </defs>
      <!-- contorno medido do logo da referência (placeholder, sem marca real) -->
      <path d="M26.2 0.2 L20.7 1.1 L15.2 3.2 L10.9 5.9 L5.9 10.9 L1.8 18.9 L0.7 24.6 L0.7 30.3 L1.6 35.3 L4.3 41.8 L8.2 47.1 L11.3 50.1 L12.8 50.7 L9.4 46.1 L7.2 39.4 L7.3 34.6 L9.3 27.9 L13.3 21.8 L17.8 17.3 L23.8 13.4 L26.7 12.2 L28.4 12.3 L29.6 13.7 L34.6 30.8 L27.9 34.9 L23.9 38.8 L21.1 43.6 L20.3 48.3 L20.8 50.3 L23.8 52.9 L26.6 53.8 L30.4 53.8 L38.2 51.8 L41.9 49.9 L47.7 45.4 L50.1 42.4 L50.9 40.4 L50.4 38.4 L47.9 37.1 L45.1 37.3 L38.8 39.9 L37.9 39.8 L36.6 37.2 L34.9 31.2 L40.1 29.1 L43.4 28.4 L49.2 28.9 L50.6 29.6 L53.1 32.6 L53.6 38.2 L54.7 36.3 L55.6 31.6 L55.6 24.3 L54.1 17.9 L51.3 12.7 L48.1 8.7 L44.6 5.6 L41.3 3.4 L36.1 1.2 L31.3 0.2 Z" fill="url(#lg)"/>
    </svg>
  </div>
  <img class="logo logo-pasio" src="../packages/design/brand/pasio-logo.png" alt="${esc(dados.empresa)}">`;

// ---------------------------------------------------------------------------
// Cabeçalho
const cab = `
  ${T(200, 42, 'titulo', dados.titulo)}
  ${T(201, 67, 'subtitulo', dados.subtitulo)}
  <div class="status-dot"></div>
  ${T(992, 32, 'status', dados.atualizadoEm.rotulo)}
  ${T(993, 50, 'status', dados.atualizadoEm.valor)}
  <div class="btn-exportar"></div>
  ${ic('exportar', 1165, 31, 19, 19, 'ic-branco')}
  ${T(1194, 45, 'btn-txt', dados.botoes.exportar)}
  ${ic('chevron-down', 1264.5, 33.5, 14, 14, 'ic-sec')}`;

// ---------------------------------------------------------------------------
// Filtros
const filtrosGeo = {
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
let filtros = '';
for (const f of dados.filtros) {
  const g = filtrosGeo[f.id];
  filtros += caixa('filtro', ...g.box) + caixa('filtro-campo', ...g.campo);
  filtros += T(g.rot, 102, 'filtro-rot', f.rotulo);
  if (f.id === 'periodo') filtros += ic('calendario', 209, 113, 16, 18, 'ic-cal');
  filtros += T(f.id === 'periodo' ? g.val : g.val, 127, 'filtro-val', f.valor);
  filtros += ic('chevron-down', g.chev - 7, 116, 14, 14, 'ic-sec');
}
filtros += caixa('btn-limpar', 1138, 83, 162, 58);
filtros += ic('limpar', 1164, 100, 21, 21, 'ic-limpar');
filtros += T(1193, 117, 'limpar-txt', dados.botoes.limparFiltros);

// ---------------------------------------------------------------------------
// KPIs
const kpiGeo = [
  // aj: deslocamentos finos medidos contra a referência [rótulo, seta, delta, legenda] em x
  { x: 194, w: 213, tile: 199, col: 261, spark: 347, aj: [0, 1, -2, 0], ic: [-2, -2] },
  { x: 419, w: 197, tile: 429, col: 492, spark: 558, aj: [2, -3, 4, -3], ic: [0, -1] },
  { x: 628, w: 213, tile: 639, col: 698, spark: 783, aj: [1, 2, -3, 1], ic: [3, -1] },
  { x: 854, w: 225, tile: 863, col: 925, spark: 1019, aj: [-1, 2, -2, 2], ic: [-2, 0] },
  { x: 1092, w: 208, tile: 1103, col: 1164, spark: 1240, aj: [3, 1, -3, 1], ic: [2, 1] },
];
const tileCor = {
  investimento: ['#022B5E', '#0F80F5'],
  ftds: ['#012D5C', '#0D7BF4'],
  cpa: ['#2C1F38', '#D55271'],
  depositos: ['#023A43', '#22EED2'],
  roas: ['#023A44', '#2AEBD8'],
};
const sparkPts =
  '0,22 3,20 6,21 9,17 12,13 15,10 18,11 21,13 24,15 27,15 30,12 33,8 36,6 39,7 42,6 45,4 48,2 51,1';
const sparkSvg = (x) => `
  <svg class="spark" style="left:${x}px;top:224px" width="52" height="24" viewBox="0 0 52 24" aria-hidden="true">
    <polygon points="0,24 ${sparkPts} 52,1 52,24" fill="url(#sg)"/>
    <polyline points="${sparkPts}" fill="none" stroke="var(--p-spark)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
let kpis = '';
dados.kpis.forEach((k, i) => {
  const g = kpiGeo[i];
  const [bg, fg] = tileCor[k.id];
  kpis += caixa('kpi', g.x, 156, g.w, 114);
  kpis += `<div class="tile" style="left:${g.tile}px;top:167px;background:${bg};color:${fg}"></div>`;
  kpis += ic(k.id, g.tile + 9 + g.ic[0], 176 + g.ic[1], 28, 28, '', `color:${fg}`);
  kpis += T(g.col - 1 + g.aj[0], 183, 'kpi-rot', k.rotulo);
  kpis += T(g.col, 211, 'kpi-val', k.valorFormatado);
  kpis += ic(
    k.direcao === 'alta' ? 'seta-alta' : 'seta-baixa',
    g.col - 2 + g.aj[1],
    k.direcao === 'alta' ? 232.5 : 230.5,
    11,
    11,
    'ic-pos',
  );
  kpis += T(g.col + 17 + g.aj[2], 242, 'kpi-delta', k.variacaoFormatada);
  kpis += T(g.col - 1 + g.aj[3], 259, 'kpi-vs', dados.legendaVariacao);
  kpis += sparkSvg(g.spark);
});

// ---------------------------------------------------------------------------
// Funil: polígonos medidos (TL, TR, BR, BL), cantos arredondados com raio 4.
const trap = [
  [
    [206.3, 332],
    [532.4, 332],
    [511.1, 390],
    [228.2, 390],
  ],
  [
    [234.5, 395],
    [505.0, 395],
    [483.3, 453],
    [256.5, 453],
  ],
  [
    [260.7, 458],
    [481.0, 458],
    [459.1, 514],
    [281.2, 514],
  ],
  [
    [285.5, 520],
    [454.1, 520],
    [434.8, 574],
    [305.4, 574],
  ],
  [
    [309.7, 580],
    [430.6, 580],
    [410.2, 635],
    [329.3, 635],
  ],
];
const corFunil = ['#0068FD', '#0078FD', '#00B0DD', '#00C793', '#00C980'];
const corFunilClaro = ['#1C82FF', '#2290FF', '#1CC0EA', '#1AD7A6', '#1AD995'];
/** Path com cantos arredondados de raio r para polígono convexo. */
function pathArredondado(pts, r) {
  let d = '';
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n],
      p1 = pts[i],
      p2 = pts[(i + 1) % n];
    const v1 = [p0[0] - p1[0], p0[1] - p1[1]],
      v2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(...v1),
      l2 = Math.hypot(...v2);
    const a = [p1[0] + (v1[0] / l1) * r, p1[1] + (v1[1] / l1) * r];
    const b = [p1[0] + (v2[0] / l2) * r, p1[1] + (v2[1] / l2) * r];
    d += `${i === 0 ? 'M' : 'L'}${a[0].toFixed(2)},${a[1].toFixed(2)} Q${p1[0]},${p1[1]} ${b[0].toFixed(2)},${b[1].toFixed(2)} `;
  }
  return d + 'Z';
}
const etapas = dados.funil.etapas;
let funilSvg = '<defs>';
corFunil.forEach((c, i) => {
  funilSvg += `<linearGradient id="fg${i}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${corFunilClaro[i]}"/><stop offset=".12" stop-color="${c}"/><stop offset=".88" stop-color="${c}"/><stop offset="1" stop-color="${corFunilClaro[i]}"/></linearGradient>`;
});
funilSvg += '</defs>';
let funilTxt = '';
const taxaY = [
  { pct: 352, leg: 370, con: null },
  { pct: 411, leg: 433, con: 419.5 },
  { pct: 475, leg: 496, con: 481.5 },
  { pct: 538, leg: 558, con: 545 },
  { pct: 597, leg: 618, con: 604 },
];
etapas.forEach((e, i) => {
  const p = trap[i];
  funilSvg += `<path d="${pathArredondado(p, 5)}" fill="url(#fg${i})"/>`;
  const topo = p[0][1];
  funilTxt += TC(370, topo + 21.5, 'funil-rot', e.rotulo);
  funilTxt += TC(369, topo + 45, 'funil-val', e.valorFormatado);
  const ty = taxaY[i];
  funilTxt += T(543, ty.pct + 11, 'funil-pct', e.taxaFormatada);
  if (i === 0) {
    funilTxt += T(540.5, ty.leg + 9, 'funil-leg funil-leg-base', dados.funil.legendaBase);
  } else {
    funilTxt += T(540.5, ty.leg + 9, 'funil-leg', dados.funil.legendaConversao);
    // conector: começa ~24 px antes da borda direita do trapézio na altura do conector
    const t = (ty.con - p[1][1]) / (p[2][1] - p[1][1]);
    const xBorda = p[1][0] + (p[2][0] - p[1][0]) * t;
    funilSvg += `<line x1="${(xBorda - 24).toFixed(1)}" y1="${ty.con}" x2="${xBorda.toFixed(1)}" y2="${ty.con}" stroke="#FFFFFF" stroke-opacity=".28" stroke-width="1"/>`;
    funilSvg += `<line x1="${xBorda.toFixed(1)}" y1="${ty.con}" x2="525.5" y2="${ty.con}" stroke="var(--p-conector)" stroke-width="1"/>`;
    funilSvg += `<circle cx="525.5" cy="${ty.con}" r="3.5" fill="var(--p-ponto)"/>`;
  }
});

// ---------------------------------------------------------------------------
// Tabela
const colX = [650, 720, 795, 845, 895, 951, 1000, 1079, 1160, 1230, 1300];
const cx = (i) => (colX[i] + colX[i + 1]) / 2;
const linhasY = [397, 446, 495, 543, 591, 640];
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
];
const tab = dados.tabela;
let tabela = '';
// linhas de grade
for (let i = 1; i < colX.length - 1; i++) tabela += caixa('grade', colX[i], 330, 1, 310);
tabela += caixa('grade', 650, 330, 650, 1);
tabela += caixa('grade', 951, 360, 128, 1);
for (const y of linhasY) tabela += caixa('grade', 650, y, 650, 1);
// cabeçalho
const H = tab.cabecalhos;
tabela += T(661, 366, 'th', H[0].rotulo[0]);
tabela += TC(cx(1) - 8, 366, 'th', H[1].rotulo[0]);
tabela += ic('ordenar', 783, 356, 12, 12, 'ic-sec');
tabela += TC(cx(2) + 0.5, 366, 'th', H[2].rotulo[0]);
tabela += TC(cx(3) + 0.5, 366, 'th', H[3].rotulo[0]);
tabela += TC(cx(4) + 0.5, 366, 'th', H[4].rotulo[0]);
tabela += TC((colX[5] + colX[7]) / 2 + 3, 350, 'th', H[5].rotulo[0]);
tabela += TC(cx(5) + 1, 383, 'th', H[5].subcolunas[0].rotulo[0]);
tabela += TC(cx(6) + 1, 383, 'th', H[5].subcolunas[1].rotulo[0]);
H[6].rotulo.forEach((l, j) => (tabela += TC(cx(7) + 2.5, 352 + j * 15.5, 'th', l)));
H[7].rotulo.forEach((l, j) => (tabela += TC(cx(8) + [0, -3][j], 358 + j * 18, 'th', l)));
tabela += ic('info', 1206, 339.5, 14, 14, 'ic-sec');
H[8].rotulo.forEach((l, j) => (tabela += TC(cx(9) + [4, -1][j], 358 + j * 18, 'th', l)));
tabela += ic('info', 1278, 339.5, 14, 14, 'ic-roas');
// linhas de dados
const icCanal = {
  meta: 'canal-meta',
  email: 'canal-email',
  sms: 'canal-sms',
  afiliados: 'canal-afiliados',
  outros: 'canal-outros',
};
const corCanal = {
  meta: '#1B8EE1',
  email: '#20E8BC',
  sms: '#1080F1',
  afiliados: '#27EBC5',
  outros: '#EDEB3A',
};
tab.linhas.forEach((l, i) => {
  const y0 = linhasY[i],
    y1 = linhasY[i + 1];
  const base = y0 + 29;
  const cy = (y0 + y1) / 2;
  tabela += ic(icCanal[l.id], 658, cy - 9, 19, 19, '', `color:${corCanal[l.id]}`);
  const pequeno = l.id === 'afiliados' || l.id === 'outros';
  tabela += T(683, base - (pequeno ? 0.5 : 0), pequeno ? 'td td-pq' : 'td', l.canal);
  campos.forEach((c, j) => {
    const v = comoNaImagem(l.id, c, l.formatado[c]);
    tabela += TC(cx(j + 1) + 1, base, c === 'roas' && v !== '-' ? 'td td-roas' : 'td', v);
  });
});
// total
tabela += caixa('total', 651, 640, 648, 62);
for (let i = 1; i < colX.length - 1; i++) tabela += caixa('grade-total', colX[i], 640, 1, 62);
tabela += T(660, 677, 'td-total', tab.total.canal);
campos.forEach((c, j) => (tabela += TC(cx(j + 1) + 0.5, 677, 'td-total', tab.total.formatado[c])));

// ---------------------------------------------------------------------------
// stroke-width sai do símbolo e vem do CSS (.ic), para permitir a calibração por ícone.
const simbolos = sprite
  .replace(/^<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/ stroke-width="1\.75"/g, '');

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1315">
<title>Visão Geral de Aquisição — protótipo</title>
<!-- Gerado por prototype/gerar.mjs a partir de packages/fixtures/referencia.json. Não edite à mão. -->
<link rel="stylesheet" href="../packages/design/tokens.css">
<link rel="stylesheet" href="estilo.css">
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#06F6C7" stop-opacity=".32"/><stop offset="1" stop-color="#06F6C7" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${simbolos}
</svg>
<div class="tela" data-logo="referencia">
  <aside class="sidebar">${logo}${sidebar}</aside>
  <div class="divisor"></div>
  <main class="principal">
    ${cab}
    ${filtros}
    ${kpis}
    <section class="card funil-card"></section>
    ${T(208, 313, 'card-titulo', dados.funil.titulo)}
    ${ic('info', 361, 300, 15, 15, 'ic-sec')}
    <svg class="funil" width="1315" height="710" viewBox="0 0 1315 710" aria-hidden="true">${funilSvg}</svg>
    ${funilTxt}
    <section class="card tabela-card"></section>
    ${T(662, 313, 'card-titulo', tab.titulo)}
    ${ic('info', 847, 300, 15, 15, 'ic-sec')}
    ${tabela}
  </main>
  <div class="faixa-topo"></div>
  <div class="faixa-direita"></div>
</div>
</body>
</html>
`;
writeFileSync(resolve(AQUI, 'index.html'), html);
console.log('prototype/index.html gerado');
