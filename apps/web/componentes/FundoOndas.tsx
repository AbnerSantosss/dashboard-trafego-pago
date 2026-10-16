'use client';

/**
 * Fundo animado das telas internas (Relatórios, Ajuda): fitas de fios em SVG no estilo das ondas
 * do login, sem imagem. O painel `/` não usa, para não mexer no diff com a referência.
 *
 * Movimento no contrato do Hyperframes (só referência, wiki 18 - Hyperframes, 04-animacao):
 * UMA timeline pausada, `fromTo` com estado inicial explícito, tempos absolutos, nada aleatório
 * (a geometria vem de `fundo-ondas.ts`, com hash do índice) e repetição finita. Receitas:
 * - svg-path-draw: os fios se desenham por `stroke-dashoffset` (com `pathLength=1`, sem medir);
 * - ambient-glow-bloom: halo atrás da torção da fita, opacidade de pico 0,3;
 * - sine-wave-loop: cada camada respira em `sine.inOut` com período próprio, só transform.
 *   O número de voltas é ímpar, então o yoyo termina na pose de repouso (a mesma do SSR).
 *
 * Leveza: o GSAP só carrega depois da pintura; os pontos são três caminhos, não centenas de
 * nós; sem filtro de desfoque; o halo não anima depois da entrada. A respiração dura cerca de um
 * minuto e meio e para; aí as camadas saem do compositor (`data-fo='pronto'`) e o fundo não gasta
 * mais nada. Aba escondida pausa a timeline.
 * Movimento reduzido: o estado final, parado. Sem JS: o mesmo estado final aparece em 3 s (CSS).
 */
import type { gsap as GsapApi } from 'gsap';
import { useEffect, useRef } from 'react';
import { ALTURA, gerarOndas, LARGURA } from './fundo-ondas';

const ONDAS = gerarOndas();
const CAIXA = `0 0 ${LARGURA} ${ALTURA}`;
/** Fim da entrada; dali em diante só a respiração das camadas. */
const ENTRADA = 2;
/** Repetições do yoyo: ímpar termina na pose inicial. 11 dá 12 meias-voltas; a camada mais lenta
 * (14 s) para em 2 + 12 × 7 = 86 s. */
const VOLTAS = 11;

function montarFundo(gsap: typeof GsapApi, raiz: HTMLElement): gsap.core.Timeline {
  const q = (s: string) => Array.from(raiz.querySelectorAll(s));
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });

  tl.fromTo(q('.fo-brilho'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4 }, 0);
  const desenha = (alvos: Element[], t: number, total: number, duracao = 1.6) =>
    tl.fromTo(
      alvos,
      { strokeDashoffset: 1 },
      {
        strokeDashoffset: 0,
        duration: duracao,
        ease: 'power2.inOut',
        stagger: { amount: total },
      },
      t,
    );
  desenha(q('.fo-fundo path'), 0.1, 0.4);
  desenha(q('.fo-principal path.fo-fio'), 0.3, 0.45);
  desenha(q('.fo-principal .fo-crista'), 0.6, 0, 1.4);
  tl.fromTo(
    q('.fo-pontos'),
    { autoAlpha: 0, x: -24 },
    { autoAlpha: 1, x: 0, duration: 1.2, ease: 'power1.out' },
    0.9,
  );

  const respira = (s: string, para: gsap.TweenVars, periodo: number) =>
    tl.fromTo(
      q(s),
      { x: 0, y: 0 },
      { ...para, duration: periodo / 2, ease: 'sine.inOut', yoyo: true, repeat: VOLTAS },
      ENTRADA,
    );
  respira('.fo-fundo', { x: 10, y: -12 }, 14);
  respira('.fo-principal', { x: -8, y: 10 }, 11);
  respira('.fo-pontos', { x: -12, y: 13 }, 12);

  return tl;
}

export function FundoOndas() {
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.dataset.fo = 'pronto';
      return;
    }
    let tl: gsap.core.Timeline | undefined;
    let vivo = true;
    const aoMudarAba = () => (document.hidden ? tl?.pause() : tl?.resume());
    void import('gsap').then(({ gsap }) => {
      if (!vivo) return;
      tl = montarFundo(gsap, el);
      tl.eventCallback('onComplete', () => {
        el.dataset.fo = 'pronto';
      });
      el.dataset.fo = 'anima';
      tl.play();
      document.addEventListener('visibilitychange', aoMudarAba);
    });
    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', aoMudarAba);
      tl?.kill();
    };
  }, []);

  return (
    <div ref={raiz} className="fo" data-fo="espera" aria-hidden="true">
      <div className="fo-brilho" />

      <svg className="fo-camada fo-fundo" viewBox={CAIXA} focusable="false">
        <defs>
          <linearGradient
            id="fo-g-fundo"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2={LARGURA}
            y2="0"
          >
            <stop offset="0" stopColor="#8a3dff" />
            <stop offset="0.5" stopColor="#4b45ff" />
            <stop offset="1" stopColor="#2a5bff" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#fo-g-fundo)" strokeWidth="0.7">
          {ONDAS.fundo.map((f, i) => (
            <path
              key={i}
              d={f.d}
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset="0"
              strokeOpacity={f.o * 0.7}
            />
          ))}
        </g>
      </svg>

      <svg className="fo-camada fo-principal" viewBox={CAIXA} focusable="false">
        <defs>
          <linearGradient
            id="fo-g-principal"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2={LARGURA}
            y2="0"
          >
            <stop offset="0" stopColor="#6a3df5" />
            <stop offset="0.3" stopColor="#2f6bff" />
            <stop offset="0.48" stopColor="#3cc4ff" />
            <stop offset="0.75" stopColor="#2f6bff" />
            <stop offset="1" stopColor="#2a3dff" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#fo-g-principal)" strokeWidth="0.8">
          {ONDAS.principal.map((f, i) => (
            <path
              key={i}
              className="fo-fio"
              d={f.d}
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset="0"
              strokeOpacity={f.o}
            />
          ))}
        </g>
        {/* Crista: um traço largo e fraco por baixo faz o brilho, sem filtro de desfoque. */}
        <g fill="none" stroke="#6fd3ff" strokeLinecap="round">
          {[
            { w: 7, o: 0.12 },
            { w: 2, o: 0.85 },
          ].map((c) => (
            <path
              key={c.w}
              className="fo-crista"
              d={ONDAS.crista}
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset="0"
              strokeWidth={c.w}
              strokeOpacity={c.o}
            />
          ))}
        </g>
      </svg>

      <svg className="fo-camada fo-pontos" viewBox={CAIXA} focusable="false">
        <defs>
          <linearGradient
            id="fo-g-pontos"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2={LARGURA}
            y2="0"
          >
            <stop offset="0" stopColor="#b06bff" />
            <stop offset="0.35" stopColor="#5fd0ff" />
            <stop offset="0.7" stopColor="#7d8bff" />
            <stop offset="1" stopColor="#b06bff" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#fo-g-pontos)" strokeLinecap="round">
          {ONDAS.pontos.map((p) => (
            <path key={p.r} d={p.d} strokeWidth={p.r} strokeOpacity={p.o} />
          ))}
        </g>
      </svg>
    </div>
  );
}
