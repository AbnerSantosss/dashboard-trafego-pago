'use client';
import { useRef } from 'react';
import type { ContadorProps } from './tipos';
import { animarNumero, deveAnimar, esperaDaEntradaCss, useEfeitoIsomorfico } from './movimento';

/**
 * Número que conta de 0 (ou do valor anterior) até `valor`, com `saidaQuad` (1 − (1 − t)²) por
 * requestAnimationFrame. O servidor e o primeiro render mostram `formatar(valor)`; cada quadro usa o
 * mesmo `formatar` (mesma máscara pt-BR) e o último escreve exatamente `formatar(valor)`. A largura
 * é reservada com `min-width` em `ch`.
 */
export function Contador({
  valor,
  formatar,
  duracaoMs = 800,
  atrasoMs = 0,
  sincronizarCom,
  semAnimacao,
  className,
}: ContadorProps) {
  const ref = useRef<HTMLSpanElement>(null);
  /** Valor já mostrado; null antes da montagem. */
  const anterior = useRef<number | null>(null);
  const refFormatar = useRef(formatar);
  refFormatar.current = formatar;
  const final = formatar(valor);
  /** Texto final do render mais recente: é o que a limpeza escreve (nunca um valor antigo). */
  const refFinal = useRef(final);
  refFinal.current = final;

  useEfeitoIsomorfico(() => {
    const el = ref.current;
    const de = anterior.current;
    anterior.current = valor;
    if (!el || !deveAnimar(semAnimacao) || de === valor) return;
    let atraso = atrasoMs;
    const entrada = de === null && sincronizarCom ? el.closest(sincronizarCom) : null;
    if (entrada) {
      const espera = esperaDaEntradaCss(entrada);
      // A entrada já terminou: o número já foi visto no valor final, não volta a 0.
      if (espera === null) return;
      atraso = espera;
    }
    let terminou = false;
    const parar = animarNumero({
      de: de ?? 0,
      ate: valor,
      duracaoMs,
      atrasoMs: atraso,
      aCada: (v, fim) => {
        terminou = fim;
        el.textContent = fim ? refFinal.current : refFormatar.current(v);
      },
    });
    return () => {
      parar();
      el.textContent = refFinal.current;
      // Interrompida antes do fim (ex.: StrictMode desmonta e remonta): a próxima execução recomeça
      // do mesmo ponto de partida, em vez de achar que o valor já foi mostrado.
      if (!terminou) anterior.current = de;
    };
  }, [valor, semAnimacao, duracaoMs, atrasoMs, sincronizarCom]);

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
