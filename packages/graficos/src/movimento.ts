'use client';
import { useEffect, useLayoutEffect } from 'react';
import { gsap } from 'gsap';

/** useLayoutEffect no cliente (evita piscar o estado final antes da animação); useEffect no servidor. */
export const useEfeitoIsomorfico = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** true quando o usuário pediu menos movimento (falso fora do navegador). */
export function preferReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Decide se um componente deve animar. */
export function deveAnimar(semAnimacao?: boolean): boolean {
  return typeof window !== 'undefined' && !semAnimacao && !preferReducedMotion();
}

// ---------------------------------------------------------------------------
// Doutrina de movimento (Hyperframes, só referência): uma curva da casa para entradas
// (out-quart), só transform e opacity (e clip-path em revelações), nada de overshoot em número.

/** Curva de entrada da casa: out-quart, `cubic-bezier(.165,.84,.44,1)`. */
export const CURVA_ENTRADA = 'cubic-bezier(0.165, 0.84, 0.44, 1)';

/** power2.out na definição do pedido: 1 − (1 − t)². Monotônica, sem passar do valor final. */
export function saidaQuad(t: number): number {
  const u = 1 - Math.min(1, Math.max(0, t));
  return 1 - u * u;
}

export interface OpcoesNumero {
  de: number;
  ate: number;
  duracaoMs: number;
  atrasoMs?: number;
  /** Chamado a cada quadro com o valor atual; `fim` é true só no último (valor === ate). */
  aCada: (valor: number, fim: boolean) => void;
}

/**
 * Anima um número com requestAnimationFrame e `saidaQuad`. Escreve o valor inicial na hora (antes
 * do próximo quadro, para não piscar o final) e termina exatamente em `ate`. Devolve a função que
 * cancela; quem cancela é responsável por escrever o estado final.
 */
export function animarNumero({
  de,
  ate,
  duracaoMs,
  atrasoMs = 0,
  aCada,
}: OpcoesNumero): () => void {
  let id = 0;
  let inicio: number | null = null;
  const passo = (agora: number) => {
    if (inicio === null) inicio = agora + atrasoMs;
    const t = duracaoMs > 0 ? (agora - inicio) / duracaoMs : 1;
    if (t >= 1) {
      aCada(ate, true);
      return;
    }
    aCada(de + (ate - de) * saidaQuad(t), false);
    id = requestAnimationFrame(passo);
  };
  aCada(de, false);
  id = requestAnimationFrame(passo);
  return () => cancelAnimationFrame(id);
}

/**
 * Situação da animação CSS de entrada de `el`: quantos ms faltam para ela começar (0 se já começou)
 * ou `null` se o elemento já foi visto no estado final: a animação terminou, não existe, ou já passou
 * de 10% da duração (com a curva out-quart a opacidade já passa de 1/3; voltar o número a 0 nessa hora seria um salto visível). Sem a Web Animations API
 * (jsdom) devolve 0: trata como entrando agora.
 *
 * Serve para os contadores (JS) acompanharem a entrada (CSS), que começa no primeiro paint do HTML do
 * servidor: se a hidratação chega tarde, o número fica no valor final em vez de piscar para 0.
 */
export function esperaDaEntradaCss(el: Element | null | undefined): number | null {
  if (!el || typeof el.getAnimations !== 'function') return 0;
  const a = el.getAnimations().find((x) => x.playState === 'running' || x.pending);
  if (!a) return null;
  const tempo = a.effect?.getTiming();
  const atraso = Number(tempo?.delay ?? 0);
  const duracao = Number(tempo?.duration ?? 0) || 0;
  const decorrido = Number(a.currentTime ?? 0) - atraso;
  if (decorrido > duracao * 0.1) return null;
  return Math.max(0, -decorrido);
}

/**
 * CSS das entradas dos gráficos. Fica todo dentro de `prefers-reduced-motion: no-preference`: com
 * reduce (ou `data-sem-animacao`) nenhuma regra vale e o estado inicial já é o final. As animações
 * usam `fill-mode: backwards` (só o estado inicial é mantido durante o atraso; ao terminar, nada
 * fica aplicado), então o estado final é exatamente o do HTML do servidor. Funcionam sem JS.
 *
 * Funil (momento autoral do painel): cada barra cresce em scaleX a partir do eixo central, de cima
 * para baixo, 70 ms entre etapas; textos e conectores aparecem 180 ms depois da barra. Total da
 * etapa 5: 4 × 70 + 420 = 700 ms (+ o atraso do card).
 * Sparkline: o traço é revelado da esquerda para a direita por clip-path; a área entra em fade.
 */
export const CSS_MOVIMENTO = `@media (prefers-reduced-motion: no-preference) {
[data-componente='funil']:not([data-sem-animacao]) [data-parte='trapezio'] {
  transform-box: fill-box;
  transform-origin: 50% 50%;
  animation: trafego-funil-barra 420ms ${CURVA_ENTRADA} calc(var(--atraso, 0ms) + var(--i, 0) * 70ms) backwards;
}
[data-componente='funil']:not([data-sem-animacao]) [data-parte='texto'],
[data-componente='funil']:not([data-sem-animacao]) [data-parte='valor'] {
  animation: trafego-opacidade 280ms ${CURVA_ENTRADA} calc(var(--atraso, 0ms) + var(--i, 0) * 70ms + 180ms) backwards;
}
[data-componente='sparkline']:not([data-sem-animacao]) {
  animation: trafego-spark-traco 600ms ${CURVA_ENTRADA} var(--atraso, 0ms) backwards;
}
[data-componente='sparkline']:not([data-sem-animacao]) [data-parte='area'] {
  animation: trafego-opacidade 400ms ${CURVA_ENTRADA} calc(var(--atraso, 0ms) + 250ms) backwards;
}
}
/*
 * Hover do funil: a etapa sob o ponteiro (ou com foco, ou aberta) acende: brilho branco por cima,
 * contorno neon e 2% de escala. As outras ficam como estão. Só transform e opacity; em repouso
 * brilho e neon ficam em opacidade 0, então o desenho parado é o mesmo da imagem.
 */
[data-componente='funil'] [data-parte='forma'] {
  transform-box: fill-box;
  transform-origin: 50% 50%;
}
[data-componente='funil'] [data-parte='brilho'],
[data-componente='funil'] [data-parte='neon'] {
  opacity: 0;
  pointer-events: none;
}
[data-componente='funil'] [data-etapa]:is(:hover, :focus-visible, [data-ativa]) [data-parte='brilho'],
[data-componente='funil'] [data-etapa]:is(:hover, :focus-visible, [data-ativa]) [data-parte='neon'] {
  opacity: 1;
}
[data-componente='funil'] [data-etapa]:is(:hover, :focus-visible, [data-ativa]) [data-parte='forma'] {
  transform: scale(1.02);
}
[data-componente='funil'] [data-etapa][role='button'] {
  cursor: pointer;
  outline: none;
}
@media (prefers-reduced-motion: no-preference) {
[data-componente='funil'] [data-parte='forma'],
[data-componente='funil'] [data-parte='brilho'],
[data-componente='funil'] [data-parte='neon'] {
  transition: opacity 220ms ${CURVA_ENTRADA}, transform 220ms ${CURVA_ENTRADA};
}
}
@keyframes trafego-funil-barra {
  from { transform: scaleX(0); opacity: 0; }
  35% { opacity: 1; }
}
@keyframes trafego-opacidade {
  from { opacity: 0; }
}
@keyframes trafego-spark-traco {
  from { clip-path: inset(-2px 100% -2px -2px); }
  to { clip-path: inset(-2px -2px -2px -2px); }
}`;

/** Folha de estilo única dos gráficos: React 19 a sobe para o <head> e remove duplicatas. */
export const ESTILO_MOVIMENTO = { href: 'trafego-graficos-movimento', precedence: 'trafego' };

export interface OpcoesCascata {
  /** Atraso entre itens em ms (padrão 100, faixa recomendada 80–120). */
  passoMs?: number;
  /** Duração de cada item em ms (padrão 450). */
  duracaoMs?: number;
  /** Atraso inicial em ms. */
  atrasoMs?: number;
  /** Deslocamento vertical inicial em px (padrão 8). */
  deslocamentoY?: number;
}

/**
 * Timeline GSAP de entrada em cascata (opacity + leve subida) para cartões do painel.
 * Seek-safe: devolve a timeline (pausável/reposicionável). Com reduced-motion devolve
 * uma timeline vazia já concluída e não toca nos elementos.
 */
export function criarTimelineCascata(
  alvos: Element[],
  { passoMs = 100, duracaoMs = 450, atrasoMs = 0, deslocamentoY = 8 }: OpcoesCascata = {},
): gsap.core.Timeline {
  const tl = gsap.timeline({ delay: atrasoMs / 1000 });
  if (!deveAnimar() || alvos.length === 0) return tl.progress(1);
  tl.from(alvos, {
    opacity: 0,
    y: deslocamentoY,
    duration: duracaoMs / 1000,
    ease: 'power2.out',
    stagger: passoMs / 1000,
    clearProps: 'opacity,transform',
  });
  return tl;
}
