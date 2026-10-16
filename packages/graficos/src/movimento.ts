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
