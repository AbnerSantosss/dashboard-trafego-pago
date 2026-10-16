'use client';
import { useId, useRef } from 'react';
import { gsap } from 'gsap';
import type { FunilProps } from './tipos';
import { deveAnimar, useEfeitoIsomorfico } from './movimento';

type Ponto = readonly [number, number];
/** Vértices TL, TR, BR, BL. */
type Trapezio = readonly [Ponto, Ponto, Ponto, Ponto];

/**
 * Geometria medida na referência e aceita no gate G1 (prototype/gerar.mjs), em coordenadas
 * da página de 1315 px. O viewBox abaixo recorta exatamente a área do card do funil, de modo
 * que os vértices são idênticos aos do protótipo.
 */
export const TRAPEZIOS: readonly Trapezio[] = [
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

/** Card do funil no protótipo: left 194, width 444; trapézios de y 332 a 635. */
export const VIEWBOX = { x: 194, y: 322, largura: 444, altura: 322 } as const;

/** Cores medidas: centro e bordas (degradê horizontal 0 → 12% → 88% → 100%). */
export const COR_FUNIL = ['#0068FD', '#0078FD', '#00B0DD', '#00C793', '#00C980'] as const;
export const COR_FUNIL_BORDA = ['#1C82FF', '#2290FF', '#1CC0EA', '#1AD7A6', '#1AD995'] as const;

/** Linhas de base das taxas/legendas e altura dos conectores, por etapa. */
const TAXA_Y = [
  { pct: 352, leg: 370, con: null },
  { pct: 411, leg: 433, con: 419.5 },
  { pct: 475, leg: 496, con: 481.5 },
  { pct: 538, leg: 558, con: 545 },
  { pct: 597, leg: 618, con: 604 },
] as const;

const X_PONTO = 525.5;
const COR_CONECTOR = '#4A5D6E';
const COR_PONTO = '#B4D0F7';
const COR_LEGENDA = '#A0B1C4';

/** Path com cantos arredondados de raio r (mesmo algoritmo do protótipo). */
export function pathArredondado(pts: readonly Ponto[], r: number): string {
  let d = '';
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const v1 = [p0[0] - p1[0], p0[1] - p1[1]] as const;
    const v2 = [p2[0] - p1[0], p2[1] - p1[1]] as const;
    const l1 = Math.hypot(v1[0], v1[1]);
    const l2 = Math.hypot(v2[0], v2[1]);
    const a = [p1[0] + (v1[0] / l1) * r, p1[1] + (v1[1] / l1) * r];
    const b = [p1[0] + (v2[0] / l2) * r, p1[1] + (v2[1] / l2) * r];
    d += `${i === 0 ? 'M' : 'L'}${a[0]!.toFixed(2)},${a[1]!.toFixed(2)} Q${p1[0]},${p1[1]} ${b[0]!.toFixed(2)},${b[1]!.toFixed(2)} `;
  }
  return d + 'Z';
}

/** x da borda direita do trapézio na altura y. */
function bordaDireita(t: Trapezio, y: number): number {
  const [, tr, br] = t;
  const f = (y - tr[1]) / (br[1] - tr[1]);
  return tr[0] + (br[0] - tr[0]) * f;
}

const fmtInteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/**
 * Funil de Aquisição (seção 2.5 da spec): até cinco trapézios com degradê, rótulo e valor
 * centralizados, taxa e legenda à direita ligadas por conector. Etapas além da quinta são
 * ignoradas (a geometria medida só tem cinco).
 */
export function Funil({ etapas, largura, semAnimacao, className }: FunilProps) {
  const base = `funil-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const ref = useRef<SVGSVGElement>(null);
  const visiveis = etapas.slice(0, TRAPEZIOS.length);

  useEfeitoIsomorfico(() => {
    const svg = ref.current;
    if (!svg || !deveAnimar(semAnimacao)) return;
    const tl = gsap.timeline();
    visiveis.forEach((e, i) => {
      const grupo = svg.querySelector(`[data-etapa="${CSS.escape(e.id)}"]`);
      if (!grupo) return;
      const pos = i * 0.1;
      const trap = grupo.querySelector('[data-parte="trapezio"]');
      const textos = grupo.querySelectorAll('[data-parte="texto"]');
      const valor = grupo.querySelector('[data-parte="valor"]');
      if (trap) {
        tl.fromTo(
          trap,
          { opacity: 0, scaleY: 0.6, transformOrigin: '50% 0%' },
          { opacity: 1, scaleY: 1, duration: 0.45, ease: 'power2.out', clearProps: 'all' },
          pos,
        );
      }
      tl.fromTo(
        textos,
        { opacity: 0 },
        { opacity: 1, duration: 0.35, ease: 'power1.out', clearProps: 'opacity' },
        pos + 0.15,
      );
      if (valor && Number.isFinite(e.valor) && e.valor > 0) {
        const estado = { v: 0 };
        tl.to(
          estado,
          {
            v: e.valor,
            duration: 0.9,
            ease: 'power2.out',
            onStart: () => {
              valor.textContent = '0';
            },
            onUpdate: () => {
              valor.textContent = fmtInteiro.format(estado.v);
            },
            onComplete: () => {
              valor.textContent = e.valorFormatado;
            },
          },
          pos + 0.1,
        );
        valor.textContent = '0';
      }
    });
    return () => {
      tl.progress(1).kill();
      visiveis.forEach((e) => {
        const v = svg.querySelector(`[data-etapa="${CSS.escape(e.id)}"] [data-parte="valor"]`);
        if (v) v.textContent = e.valorFormatado;
      });
    };
  }, [visiveis.map((e) => `${e.id}:${e.valor}`).join('|'), semAnimacao]);

  return (
    <svg
      ref={ref}
      className={className}
      data-componente="funil"
      viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.largura} ${VIEWBOX.altura}`}
      preserveAspectRatio="xMinYMin meet"
      width={largura ?? '100%'}
      style={{ display: 'block', height: 'auto', overflow: 'visible', fontFamily: 'inherit' }}
      role="img"
      aria-label={visiveis
        .map((e) => `${e.rotulo}: ${e.valorFormatado} (${e.taxaFormatada})`)
        .join('; ')}
    >
      <defs>
        {visiveis.map((_, i) => (
          <linearGradient key={i} id={`${base}-g${i}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={COR_FUNIL_BORDA[i]} />
            <stop offset=".12" stopColor={COR_FUNIL[i]} />
            <stop offset=".88" stopColor={COR_FUNIL[i]} />
            <stop offset="1" stopColor={COR_FUNIL_BORDA[i]} />
          </linearGradient>
        ))}
      </defs>
      {visiveis.map((e, i) => {
        const t = TRAPEZIOS[i]!;
        const ty = TAXA_Y[i]!;
        const topo = t[0][1];
        const xb = ty.con === null ? 0 : bordaDireita(t, ty.con);
        return (
          <g key={e.id} data-etapa={e.id}>
            <path
              data-parte="trapezio"
              d={pathArredondado(t, 5)}
              fill={`url(#${base}-g${i})`}
              style={{ filter: 'blur(0.8px)' }}
            />
            {ty.con !== null && (
              <g data-parte="texto">
                <line
                  x1={(xb - 24).toFixed(1)}
                  y1={ty.con}
                  x2={xb.toFixed(1)}
                  y2={ty.con}
                  stroke="#FFFFFF"
                  strokeOpacity={0.28}
                  strokeWidth={1}
                />
                <line
                  x1={xb.toFixed(1)}
                  y1={ty.con}
                  x2={X_PONTO}
                  y2={ty.con}
                  stroke={COR_CONECTOR}
                  strokeWidth={1}
                />
                <circle cx={X_PONTO} cy={ty.con} r={3.5} fill={COR_PONTO} />
              </g>
            )}
            <text
              data-parte="texto"
              x={370}
              y={topo + 21.5}
              textAnchor="middle"
              fontSize={13}
              fill="currentColor"
              fillOpacity={0.9}
            >
              {e.rotulo}
            </text>
            <text
              data-parte="valor"
              x={369}
              y={topo + 45}
              textAnchor="middle"
              fontSize={19}
              fontWeight={700}
              fill="currentColor"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {e.valorFormatado}
            </text>
            <text
              data-parte="texto"
              x={543}
              y={ty.pct + 11}
              fontSize={15.5}
              fontWeight={600}
              fill="currentColor"
            >
              {e.taxaFormatada}
            </text>
            <text
              data-parte="texto"
              x={540.5}
              y={ty.leg + 9}
              fontSize={i === 0 ? 9.5 : 11}
              fill={COR_LEGENDA}
            >
              {e.legenda}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
