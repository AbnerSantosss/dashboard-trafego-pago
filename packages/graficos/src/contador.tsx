'use client';
import { useRef } from 'react';
import { gsap } from 'gsap';
import type { ContadorProps } from './tipos';
import { deveAnimar, useEfeitoIsomorfico } from './movimento';

/**
 * Número que conta de 0 (ou do valor anterior) até `valor`. O servidor e o primeiro
 * render mostram `formatar(valor)`; a largura é reservada com `min-width` em `ch`.
 */
export function Contador({
  valor,
  formatar,
  duracaoMs = 900,
  atrasoMs = 0,
  semAnimacao,
  className,
}: ContadorProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const anterior = useRef(0);
  const refFormatar = useRef(formatar);
  refFormatar.current = formatar;
  const final = formatar(valor);

  useEfeitoIsomorfico(() => {
    const el = ref.current;
    const de = anterior.current;
    anterior.current = valor;
    if (!el || !deveAnimar(semAnimacao) || de === valor) return;
    const fmt = (n: number) => refFormatar.current(n);
    const estado = { v: de };
    el.textContent = fmt(de);
    const tween = gsap.to(estado, {
      v: valor,
      duration: duracaoMs / 1000,
      delay: atrasoMs / 1000,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = fmt(estado.v);
      },
      onComplete: () => {
        el.textContent = fmt(valor);
      },
    });
    return () => {
      tween.kill();
      el.textContent = fmt(valor);
    };
  }, [valor, semAnimacao, duracaoMs, atrasoMs]);

  return (
    <span
      ref={ref}
      className={className}
      data-componente="contador"
      style={{
        fontVariantNumeric: 'tabular-nums',
        display: 'inline-block',
        minWidth: `${final.length}ch`,
      }}
    >
      {final}
    </span>
  );
}
