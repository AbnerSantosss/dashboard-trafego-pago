/**
 * @trafego/graficos — funil (d3/SVG), sparklines e contadores (GSAP).
 * Só reexporta: os componentes marcados com 'use client' ficam nos próprios módulos.
 */
export * from './tipos';
export { Funil, TRAPEZIOS, TRAPEZIOS_6, VIEWBOX, COR_FUNIL, COR_FUNIL_BORDA } from './funil';
export { Sparkline, calcularSparkline, type SparklineExtraProps } from './sparkline';
export { Contador } from './contador';
export { preferReducedMotion, criarTimelineCascata, type OpcoesCascata } from './movimento';
