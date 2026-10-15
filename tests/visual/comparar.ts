/**
 * Harness de fidelidade visual (P1.6).
 *
 * Captura a tela-alvo em Chromium headless a 1315x710 e compara com ref-1.png via pixelmatch.
 * Uso:
 *   node --experimental-strip-types comparar.ts [--alvo <arquivo|url>] [--somente-captura]
 *        [--limite <percentual>] [--relatorio <caminho.json>]
 * Sem --alvo, usa prototype/index.html da raiz do repositório.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const LARGURA = 1315;
const ALTURA = 710;
const LIMITE_PADRAO = 2;
const ESPERA_MS = 300;

const DIR = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(DIR, '..', '..');
const SAIDA = resolve(DIR, 'saida');
const REFERENCIA = resolve(DIR, 'ref-1.png');
const REGIOES = resolve(DIR, 'regioes.json');

interface Regiao {
  nome: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ResultadoRegiao extends Regiao {
  pixelsDiferentes: number;
  total: number;
  percentual: number;
}

interface Argumentos {
  alvo: string;
  somenteCaptura: boolean;
  limite: number;
  relatorio: string;
}

function lerArgumentos(argv: string[]): Argumentos {
  const args: Argumentos = {
    alvo: resolve(RAIZ, 'prototype', 'index.html'),
    somenteCaptura: false,
    limite: LIMITE_PADRAO,
    relatorio: resolve(SAIDA, 'relatorio.json'),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const proximo = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Faltou valor para ${a}`);
      return v;
    };
    if (a === '--alvo') args.alvo = proximo();
    else if (a === '--somente-captura') args.somenteCaptura = true;
    else if (a === '--limite') args.limite = Number(proximo());
    else if (a === '--relatorio') args.relatorio = resolve(process.cwd(), proximo());
    else throw new Error(`Argumento desconhecido: ${a}`);
  }
  if (!Number.isFinite(args.limite)) throw new Error('--limite precisa ser numérico');
  return args;
}

/** Converte o alvo em URL: http(s)/file passam direto; caminho local vira file://. */
function paraUrl(alvo: string): string {
  if (/^(https?|file):\/\//i.test(alvo)) return alvo;
  const caminho = isAbsolute(alvo) ? alvo : resolve(process.cwd(), alvo);
  if (!existsSync(caminho)) throw new Error(`Alvo não encontrado: ${caminho}`);
  return pathToFileURL(caminho).href;
}

async function capturar(url: string): Promise<Buffer> {
  const navegador = await chromium.launch({ headless: true });
  try {
    const contexto = await navegador.newContext({
      viewport: { width: LARGURA, height: ALTURA },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      colorScheme: 'dark',
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    });
    const pagina = await contexto.newPage();
    await pagina.goto(url, { waitUntil: 'load' });
    await pagina.evaluate(async () => {
      await document.fonts.ready;
    });
    await pagina.waitForTimeout(ESPERA_MS);
    return await pagina.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: LARGURA, height: ALTURA },
    });
  } finally {
    await navegador.close();
  }
}

function lerRegioes(): Regiao[] {
  if (!existsSync(REGIOES)) return [];
  const dados = JSON.parse(readFileSync(REGIOES, 'utf8')) as { regioes?: Regiao[] };
  return dados.regioes ?? [];
}

/** Soma a máscara de pixels diferentes dentro da caixa da região. */
function contarRegiao(mascara: Uint8Array, r: Regiao): ResultadoRegiao {
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  const x1 = Math.min(LARGURA, r.x + r.w);
  const y1 = Math.min(ALTURA, r.y + r.h);
  let dif = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) dif += mascara[y * LARGURA + x] ?? 0;
  }
  const total = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  return { ...r, pixelsDiferentes: dif, total, percentual: total ? (dif / total) * 100 : 0 };
}

const arred = (n: number): number => Math.round(n * 1000) / 1000;
const fmt = (n: number): string => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

async function main(): Promise<void> {
  const args = lerArgumentos(process.argv.slice(2));
  const url = paraUrl(args.alvo);
  mkdirSync(SAIDA, { recursive: true });

  console.log(`Capturando ${url} a ${LARGURA}x${ALTURA}...`);
  const captura = await capturar(url);
  writeFileSync(resolve(SAIDA, 'atual.png'), captura);
  if (args.somenteCaptura) {
    console.log(`Captura gravada em ${resolve(SAIDA, 'atual.png')} (sem comparação).`);
    return;
  }

  const atual = PNG.sync.read(captura);
  const ref = PNG.sync.read(readFileSync(REFERENCIA));
  if (ref.width !== LARGURA || ref.height !== ALTURA) {
    throw new Error(`ref-1.png tem ${ref.width}x${ref.height}; esperado ${LARGURA}x${ALTURA}`);
  }
  if (atual.width !== LARGURA || atual.height !== ALTURA) {
    throw new Error(`Captura saiu ${atual.width}x${atual.height}; esperado ${LARGURA}x${ALTURA}`);
  }

  // Máscara 1/0 de pixels diferentes, preenchida pela saída "diffMask" de uma segunda imagem
  // (fundo transparente) para não confundir vermelho do conteúdo com marcação de diferença.
  const diff = new PNG({ width: LARGURA, height: ALTURA });
  const pixelsDiferentes = pixelmatch(atual.data, ref.data, diff.data, LARGURA, ALTURA, {
    threshold: 0.1,
    includeAA: false,
    alpha: 0.2,
    diffColor: [255, 0, 0],
    aaColor: [255, 255, 0],
  });
  writeFileSync(resolve(SAIDA, 'diff.png'), PNG.sync.write(diff));

  const mascaraPng = new PNG({ width: LARGURA, height: ALTURA });
  pixelmatch(atual.data, ref.data, mascaraPng.data, LARGURA, ALTURA, {
    threshold: 0.1,
    includeAA: false,
    diffMask: true,
    diffColor: [255, 0, 0],
    aaColor: [0, 0, 0],
  });
  const mascara = new Uint8Array(LARGURA * ALTURA);
  for (let i = 0; i < mascara.length; i++) {
    const o = i * 4;
    const marcado =
      mascaraPng.data[o] === 255 &&
      mascaraPng.data[o + 1] === 0 &&
      mascaraPng.data[o + 2] === 0 &&
      mascaraPng.data[o + 3] === 255;
    mascara[i] = marcado ? 1 : 0;
  }

  const total = LARGURA * ALTURA;
  const percentual = (pixelsDiferentes / total) * 100;
  const aprovado = percentual <= args.limite;
  const regioes = lerRegioes().map((r) => contarRegiao(mascara, r));

  const relatorio = {
    pixelsDiferentes,
    total,
    percentual: arred(percentual),
    limite: args.limite,
    aprovado,
    alvo: url,
    data: new Date().toISOString(),
    regioes: regioes.map((r) => ({
      nome: r.nome,
      caixa: { x: r.x, y: r.y, w: r.w, h: r.h },
      pixelsDiferentes: r.pixelsDiferentes,
      total: r.total,
      percentual: arred(r.percentual),
      participacaoNoTotal: arred(
        pixelsDiferentes ? (r.pixelsDiferentes / pixelsDiferentes) * 100 : 0,
      ),
    })),
  };
  mkdirSync(dirname(args.relatorio), { recursive: true });
  writeFileSync(args.relatorio, JSON.stringify(relatorio, null, 2) + '\n');

  console.log('');
  console.log(`Pixels diferentes: ${fmt(pixelsDiferentes)} de ${fmt(total)}`);
  console.log(`Percentual: ${fmt(percentual)}% (limite ${fmt(args.limite)}%)`);
  if (regioes.length) {
    console.log('Por região (percentual da região | fatia do total de diferenças):');
    for (const r of [...regioes].sort((a, b) => b.pixelsDiferentes - a.pixelsDiferentes)) {
      const fatia = pixelsDiferentes ? (r.pixelsDiferentes / pixelsDiferentes) * 100 : 0;
      console.log(`  ${r.nome.padEnd(10)} ${fmt(r.percentual).padStart(7)}% | ${fmt(fatia)}%`);
    }
  }
  console.log(`Saída: ${SAIDA} (atual.png, diff.png); relatório em ${args.relatorio}`);
  console.log(aprovado ? 'APROVADO: dentro do limite.' : 'REPROVADO: acima do limite.');
  if (!aprovado) process.exitCode = 1;
}

main().catch((erro: unknown) => {
  console.error('Erro no comparador visual:', erro instanceof Error ? erro.message : erro);
  process.exitCode = 2;
});
