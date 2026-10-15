// Calibração fina por elemento de texto: para cada .t, testa tamanho, peso e deslocamento
// subpixel e guarda em prototype/calibracao.json o que minimiza o diff do recorte contra
// tests/visual/ref-1.png. Uso (na raiz, PowerShell ou bash):
//   SEM_CALIBRACAO=1 node prototype/gerar.mjs; node prototype/calibrar.mjs; node prototype/gerar.mjs
// (o HTML precisa estar sem calibração para que o tamanho/peso base seja o do CSS)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const require = createRequire(resolve(RAIZ, 'tests/visual/package.json'));
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const pm = require('pixelmatch');
const pixelmatch = pm.default ?? pm;

const ref = PNG.sync.read(readFileSync(resolve(RAIZ, 'tests/visual/ref-1.png')));
const CAL_ARQ = resolve(AQUI, 'calibracao.json');
const cal = existsSync(CAL_ARQ) ? JSON.parse(readFileSync(CAL_ARQ, 'utf8')) : {};
// Famílias testadas (índice 0 = a do CSS); as Variable aceitam peso contínuo.
const FAMILIAS = [
  '',
  "'Segoe UI Variable Text'",
  "'Segoe UI Variable Display'",
  "'Segoe UI Variable Small'",
];
const PASSES = Number(process.env.PASSES ?? 2);

function recorteRef(x, y, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let j = 0; j < h; j++)
    ref.data.copy(out, j * w * 4, ((y + j) * ref.width + x) * 4, ((y + j) * ref.width + x + w) * 4);
  return out;
}

const nav = await chromium.launch();
const pag = await nav.newPage({
  viewport: { width: 1315, height: 710 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
  colorScheme: 'dark',
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
});
await pag.goto(pathToFileURL(resolve(AQUI, 'index.html')).href);
await pag.evaluate(() => document.fonts.ready);
await pag.waitForTimeout(300);

const itens = await pag.evaluate(() =>
  [...document.querySelectorAll('[data-k]')].map((e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return {
      ic: e.classList.contains('ic'),
      k: e.dataset.k,
      x: r.x,
      y: r.y,
      w: r.width,
      h: r.height,
      fs: parseFloat(cs.fontSize),
      fw: Number(cs.fontWeight),
    };
  }),
);

async function avaliar(clip, rbuf) {
  const png = PNG.sync.read(await pag.screenshot({ clip }));
  return pixelmatch(png.data, rbuf, null, clip.width, clip.height, {
    threshold: 0.1,
    includeAA: false,
  });
}
// Reproduz o carregamento: troca o elemento por um clone novo, que ganha camada própria e
// é rasterizado na origem da animação (destino - r), como na primeira pintura da página.
async function aplicar(k, s) {
  await pag.evaluate(
    ([k, s]) => {
      const e = document.querySelector(`[data-k="${CSS.escape(k)}"]`);
      const n = e.cloneNode(true);
      n.style.opacity = String(s.op);
      if (s.ic) n.style.setProperty('--sw', String(s.sw));
      else {
        n.style.fontSize = s.fs + 'px';
        n.style.fontWeight = String(s.fw);
        n.style.fontFamily = s.ffNome;
      }
      for (const v of ['dx', 'dy', 'rx', 'ry']) n.style.setProperty('--' + v, s[v] + 'px');
      e.replaceWith(n);
    },
    [k, { ...s, ffNome: FAMILIAS[s.ff] }],
  );
  await pag.waitForTimeout(60);
}
async function total() {
  const png = PNG.sync.read(await pag.screenshot());
  return pixelmatch(png.data, ref.data, null, 1315, 710, { threshold: 0.1, includeAA: false });
}
console.log('diff da página no início:', await total());
let ganhoTotal = 0;
for (const it of itens) {
  if (process.env.SO_ICONES && !it.ic) continue;
  const P = 4;
  const x = Math.max(0, Math.floor(it.x - P)),
    y = Math.max(0, Math.floor(it.y - P));
  const clip = {
    x,
    y,
    width: Math.min(1315, Math.ceil(it.x + it.w + P)) - x,
    height: Math.min(710, Math.ceil(it.y + it.h + P)) - y,
  };
  const rbuf = recorteRef(clip.x, clip.y, clip.width, clip.height);
  const c0 = cal[it.k] ?? {};
  let s = {
    fs: c0.fs ?? it.fs,
    fw: c0.fw ?? it.fw,
    dx: c0.dx ?? 0,
    dy: c0.dy ?? 0,
    rx: c0.rx ?? 0,
    ry: c0.ry ?? 0,
    ff: c0.ff ?? 0,
    op: c0.op ?? 1,
    sw: c0.sw ?? 1.75,
    ic: it.ic,
  };
  await aplicar(it.k, s);
  let melhor = await avaliar(clip, rbuf);
  const inicial = melhor;
  for (let p = 0; p < PASSES; p++) {
    const cand = [];
    for (const d of [-1, -0.5, -0.25, -0.125, 0.125, 0.25, 0.5, 1]) {
      cand.push({ ...s, dx: s.dx + d });
      cand.push({ ...s, dy: s.dy + d });
    }
    if (s.ic)
      for (const d of [-0.5, -0.25, 0.25, 0.5]) cand.push({ ...s, sw: +(s.sw + d).toFixed(2) });
    if (!s.ic)
      for (const d of [-1, -0.5, -0.25, 0.25, 0.5, 1])
        cand.push({ ...s, fs: +(s.fs + d).toFixed(2) });
    for (const r of [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]) {
      if (r !== s.rx) cand.push({ ...s, rx: r });
      if (r !== s.ry) cand.push({ ...s, ry: r });
    }
    for (const o of [1, 0.92, 0.85, 0.78, 0.7]) if (o !== s.op) cand.push({ ...s, op: o });
    if (!s.ic) for (let f = 0; f < FAMILIAS.length; f++) if (f !== s.ff) cand.push({ ...s, ff: f });
    const pesos = s.ff ? [350, 400, 450, 500, 550, 600, 650, 700] : [350, 400, 600, 700];
    if (!s.ic) for (const w of pesos) if (w !== s.fw) cand.push({ ...s, fw: w });
    let mudou = false;
    for (const c of cand) {
      if (
        Math.abs(c.dx) > 2.5 ||
        Math.abs(c.dy) > 2.5 ||
        (!c.ic && Math.abs(c.fs - it.fs) > 2) ||
        c.sw < 1 ||
        c.sw > 2.75
      )
        continue;
      await aplicar(it.k, c);
      const v = await avaliar(clip, rbuf);
      if (v < melhor) {
        melhor = v;
        s = c;
        mudou = true;
      }
    }
    await aplicar(it.k, s);
    if (!mudou) break;
  }
  ganhoTotal += inicial - melhor;
  if (process.env.DEPURAR) {
    const t = await total();
    console.log('  ', it.k, inicial - melhor, 'total', t);
  }
  const reg = {};
  if (!s.ic && s.fs !== it.fs) reg.fs = s.fs;
  if (!s.ic && s.fw !== it.fw) reg.fw = s.fw;
  if (s.ic && s.sw !== 1.75) reg.sw = s.sw;
  if (s.dx) reg.dx = s.dx;
  if (s.dy) reg.dy = s.dy;
  if (s.rx) reg.rx = s.rx;
  if (s.ry) reg.ry = s.ry;
  if (s.ff) reg.ff = s.ff;
  if (s.op !== 1) reg.op = s.op;
  if (Object.keys(reg).length) cal[it.k] = reg;
  else delete cal[it.k];
  if (inicial - melhor > 20) console.log(`${it.k}: ${inicial} -> ${melhor}`, JSON.stringify(reg));
}
console.log('diff da página no fim:', await total());
writeFileSync(CAL_ARQ, JSON.stringify(cal, null, 1) + '\n');
console.log('ganho estimado (px):', ganhoTotal, '| itens:', itens.length);
await nav.close();
