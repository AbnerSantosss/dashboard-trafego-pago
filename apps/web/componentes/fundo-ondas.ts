/**
 * Geometria do fundo de ondas das telas internas (como Relatórios), no estilo das imagens de
 * referência do login: fitas de fios finos que se torcem num ponto, com uma grade de pontos sobre a
 * fita principal. Tudo é calculado aqui, sem nada aleatório (o "acaso" de brilho e tamanho vem de um
 * hash do índice, como pede o contrato do Hyperframes), então servidor e navegador desenham igual.
 *
 * Coordenadas na área de conteúdo da tela fixa: 1134 × 710 (1315 menos a sidebar e o divisor). As
 * curvas passam um pouco das bordas para o balanço da animação não mostrar ponta solta.
 */

export const LARGURA = 1134;
export const ALTURA = 710;

type Ponto = readonly [number, number];
/** Caminho de dois trechos cúbicos: P0, C P1 P2 P3, C P4 P5 P6. */
type Curva = readonly [Ponto, Ponto, Ponto, Ponto, Ponto, Ponto, Ponto];

interface Fita {
  topo: Curva;
  base: Curva;
  fios: number;
}

/** Fita principal: sobe da base à esquerda, torce perto de x 520 e sai subindo pela direita. */
const PRINCIPAL: Fita = {
  topo: [
    [-30, 520],
    [150, 380],
    [330, 330],
    [520, 470],
    [700, 600],
    [880, 420],
    [1170, 170],
  ],
  base: [
    [-30, 760],
    [180, 700],
    [360, 600],
    [520, 490],
    [680, 380],
    [900, 560],
    [1170, 500],
  ],
  fios: 40,
};

/** Fita de trás, violeta e mais fina, num arco mais alto que cruza a principal. */
const FUNDO: Fita = {
  topo: [
    [-30, 330],
    [220, 250],
    [420, 330],
    [600, 400],
    [800, 470],
    [980, 300],
    [1170, 120],
  ],
  base: [
    [-30, 450],
    [240, 420],
    [430, 400],
    [600, 420],
    [780, 440],
    [990, 420],
    [1170, 300],
  ],
  fios: 22,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Hash determinístico em [0, 1) a partir de inteiros (substitui o Math.random). */
export function hash(...ns: number[]): number {
  let h = 2166136261;
  for (const n of ns) {
    h ^= n + 0x9e3779b9;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return ((h >>> 0) % 10000) / 10000;
}

function curvaEntre(a: Curva, b: Curva, t: number): Curva {
  return a.map((p, i) => [lerp(p[0], b[i]![0], t), lerp(p[1], b[i]![1], t)]) as unknown as Curva;
}

function caminho(c: Curva): string {
  const [p0, p1, p2, p3, p4, p5, p6] = c.map(([x, y]) => `${r1(x)} ${r1(y)}`);
  return `M${p0}C${p1} ${p2} ${p3}C${p4} ${p5} ${p6}`;
}

/** Ponto da curva no parâmetro u ∈ [0, 1] (metade para cada trecho cúbico). */
export function pontoNa(c: Curva, u: number): Ponto {
  const trecho = u < 0.5 ? 0 : 1;
  const t = trecho === 0 ? u * 2 : (u - 0.5) * 2;
  const [a, b, d, e] = trecho === 0 ? [c[0], c[1], c[2], c[3]] : [c[3], c[4], c[5], c[6]];
  const m = 1 - t;
  const x = m * m * m * a[0] + 3 * m * m * t * b[0] + 3 * m * t * t * d[0] + t * t * t * e[0];
  const y = m * m * m * a[1] + 3 * m * m * t * b[1] + 3 * m * t * t * d[1] + t * t * t * e[1];
  return [x, y];
}

export interface Fio {
  d: string;
  /** Opacidade: os fios do meio da fita brilham mais, com variação pelo hash. */
  o: number;
}

/** Pontos de um mesmo tamanho e brilho, num só caminho: cada ponto é um traço de comprimento quase
 * zero com ponta redonda. Três caminhos no lugar de centenas de `<circle>` deixam o HTML e o DOM leves. */
export interface Pontos {
  d: string;
  /** Diâmetro (largura do traço). */
  r: number;
  o: number;
}

function fiosDe(f: Fita, semente: number): Fio[] {
  return Array.from({ length: f.fios }, (_, i) => {
    const t = i / (f.fios - 1);
    const meio = 1 - Math.abs(t - 0.5) * 2;
    return {
      d: caminho(curvaEntre(f.topo, f.base, t)),
      o: r1((0.18 + 0.5 * meio + 0.22 * hash(semente, i)) * 100) / 100,
    };
  });
}

/** Níveis de tamanho e brilho dos pontos; cada ponto cai num deles pelo hash. */
const NIVEIS_PONTO = [
  { r: 1.8, o: 0.4 },
  { r: 2.4, o: 0.65 },
  { r: 3, o: 0.9 },
] as const;

/** Grade de pontos sobre a fita principal, cheia à esquerda e rarefeita no fim (como no #8). */
function pontosDe(f: Fita): Pontos[] {
  const linhas = 12;
  const colunas = 48;
  const grupos = NIVEIS_PONTO.map(() => [] as string[]);
  for (let l = 0; l < linhas; l++) {
    const t = 0.12 + (l / (linhas - 1)) * 0.84;
    const c = curvaEntre(f.topo, f.base, t);
    for (let k = 0; k < colunas; k++) {
      const h = hash(l, k, 7);
      // Rarefaz ao longo da fita, com buracos pelo hash.
      const u = (k + 0.5 * hash(k, l)) / colunas;
      if (h < u * 0.62) continue;
      const [x, y] = pontoNa(c, u);
      if (x < 0 || x > LARGURA || y < 0 || y > ALTURA) continue;
      const nivel = Math.min(
        NIVEIS_PONTO.length - 1,
        Math.floor(hash(k, l, 3) * NIVEIS_PONTO.length),
      );
      grupos[nivel]!.push(`M${r1(x)} ${r1(y)}h.01`);
    }
  }
  return NIVEIS_PONTO.map((n, i) => ({ d: grupos[i]!.join(''), ...n }));
}

export interface Ondas {
  principal: Fio[];
  fundo: Fio[];
  /** Fio de crista: a borda brilhante da fita principal, desenhado com brilho por cima. */
  crista: string;
  pontos: Pontos[];
}

export function gerarOndas(): Ondas {
  return {
    principal: fiosDe(PRINCIPAL, 1),
    fundo: fiosDe(FUNDO, 2),
    crista: caminho(curvaEntre(PRINCIPAL.topo, PRINCIPAL.base, 0.06)),
    pontos: pontosDe(PRINCIPAL),
  };
}
