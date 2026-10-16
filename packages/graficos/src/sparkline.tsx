'use client';
import { useId, type CSSProperties } from 'react';
import { area, curveMonotoneX, line } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import type { SparklineProps } from './tipos';
import { CSS_MOVIMENTO, ESTILO_MOVIMENTO } from './movimento';

/** Margem vertical (px) para o traço de 1,6 px não ser cortado (protótipo: y de 1 a 22 em 24). */
const MARGEM_TOPO = 1;
const MARGEM_BASE = 2;

/** Calcula os paths da linha e da área (exportado para testes). */
export function calcularSparkline(pontos: number[], largura: number, altura: number) {
  if (pontos.length === 0) {
    const meio = altura / 2;
    return { linha: `M0,${meio}L${largura},${meio}`, area: '' };
  }
  const serie = pontos.length === 1 ? [pontos[0]!, pontos[0]!] : pontos;
  const min = Math.min(...serie);
  const max = Math.max(...serie);
  const x = scaleLinear()
    .domain([0, serie.length - 1])
    .range([0, largura - 1]);
  const escalaY = scaleLinear()
    .domain([min, max])
    .range([altura - MARGEM_BASE, MARGEM_TOPO]);
  const y = (v: number) => (max === min ? altura / 2 : escalaY(v));
  const gLinha = line<number>()
    .x((_, i) => x(i))
    .y(y)
    .curve(curveMonotoneX);
  const gArea = area<number>()
    .x((_, i) => x(i))
    .y0(altura)
    .y1(y)
    .curve(curveMonotoneX);
  return { linha: gLinha(serie) ?? '', area: gArea(serie) ?? '' };
}

export interface SparklineExtraProps {
  /** Cor do degradê da área (padrão: `cor`). No protótipo: #06F6C7. */
  corArea?: string;
  /** Atraso da animação em ms (cascata). */
  atrasoMs?: number;
}

/**
 * Sparkline do KPI: curva monotônica, área translúcida em degradê vertical (32% → 0)
 * e traço de 1,6 px revelado da esquerda para a direita (clip-path, CSS_MOVIMENTO). A animação é
 * só CSS: começa no primeiro paint, não depende de JS e some com prefers-reduced-motion.
 */
export function Sparkline({
  pontos,
  largura,
  altura,
  cor,
  corArea,
  atrasoMs = 0,
  semAnimacao,
  className,
}: SparklineProps & SparklineExtraProps) {
  const id = `spark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { linha, area: dArea } = calcularSparkline(pontos, largura, altura);

  const corDegrade = corArea ?? cor;
  return (
    <>
      <style {...ESTILO_MOVIMENTO}>{CSS_MOVIMENTO}</style>
      <svg
        className={className}
        width={largura}
        height={altura}
        viewBox={`0 0 ${largura} ${altura}`}
        overflow="visible"
        aria-hidden="true"
        data-componente="sparkline"
        data-sem-animacao={semAnimacao || undefined}
        style={{ '--atraso': `${atrasoMs}ms` } as CSSProperties}
      >
        {dArea && (
          <>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={corDegrade} stopOpacity={0.32} />
                <stop offset="1" stopColor={corDegrade} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={dArea} fill={`url(#${id})`} data-parte="area" />
          </>
        )}
        <path
          d={linha}
          pathLength={1}
          fill="none"
          stroke={cor}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          data-parte="linha"
        />
      </svg>
    </>
  );
}
