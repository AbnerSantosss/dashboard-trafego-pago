'use client';
/**
 * Tutorial animado em balão: o botão abre um popover (top layer, fecha com Esc ou clique fora)
 * com a seta apontando para o play. Dentro, cenas curtas montam uma mini-interface e mostram,
 * passo a passo, o que acontece em cada ligação (gastos, tag, webhooks, Meta Ads).
 *
 * Contrato Hyperframes (ver linha-do-tempo.ts): cada cena é UMA timeline GSAP pausada e
 * determinística, remontada do zero a cada troca ou repetição. A barra da cena atual é o relógio
 * da mesma timeline, então pausar congela tudo junto. Com movimento reduzido a cena vai direto ao
 * estado final (`progress(1)`) e a navegação é manual.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Icone } from '@/componentes/Nos';
import { montarCena } from './linha-do-tempo';
import { TUTORIAIS, type IdTutorial } from './tutoriais';
import './tutorial.css';

const DURACAO = 5.6;
const MARGEM = 16;
/** Altura aproximada do balão (px sem zoom): abaixo disso não cabe sob o botão. */
const ESPACO_MINIMO = 560;

export function Tutorial({ id }: { id: IdTutorial }) {
  const t = TUTORIAIS[id];
  const balao = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const pontos = useRef<HTMLOListElement>(null);
  const [aberto, setAberto] = useState(false);
  const [cena, setCena] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [fim, setFim] = useState(false);
  // Muda a cada troca ou repetição: remonta a cena (o contador reescreve o texto) e a timeline.
  const [rodada, setRodada] = useState(0);
  const linha = useRef<gsap.core.Timeline | null>(null);
  const total = t.cenas.length;
  const atual = t.cenas[cena] ?? t.cenas[0]!;
  const balaoId = `tt-${id}`;

  function ir(i: number) {
    setCena(Math.max(0, Math.min(total - 1, i)));
    setFim(false);
    setRodada((r) => r + 1);
  }
  const proxima = useRef(() => {});
  proxima.current = () => {
    if (cena < total - 1) ir(cena + 1);
    else setFim(true);
  };

  // Posiciona o balão abaixo do botão (ou acima, se faltar espaço) com a seta no play.
  useEffect(() => {
    const el = balao.current;
    const alvo = botao.current;
    if (!el || !alvo) return;

    function posicionar() {
      if (!el || !alvo) return;
      // As contas são em px da janela; a tela de Configurações aplica `zoom` (--cfg-escala), que
      // o balão herda, então cada valor escrito é dividido pelo zoom efetivo.
      const z = (el as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
      const px = (v: number) => `${v / z}px`;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const r = alvo.getBoundingClientRect();
      const largura = Math.min((el.offsetWidth || 544) * z, vw - MARGEM * 2);
      const esquerda = Math.max(MARGEM, Math.min(r.left, vw - MARGEM - largura));
      const play = alvo.querySelector('.tt-abrir-play')?.getBoundingClientRect() ?? r;
      const abaixo = vh - r.bottom;
      const cima = abaixo < ESPACO_MINIMO * z && r.top > abaixo;
      el.dataset.lado = cima ? 'cima' : 'baixo';
      el.style.left = px(esquerda);
      el.style.setProperty('--seta-x', px(play.left + play.width / 2 - esquerda));
      if (cima) {
        el.style.top = 'auto';
        el.style.bottom = px(vh - r.top + 12 * z);
        el.style.maxHeight = px(r.top - (12 + MARGEM) * z);
      } else {
        el.style.bottom = 'auto';
        el.style.top = px(r.bottom + 12 * z);
        el.style.maxHeight = px(abaixo - (12 + MARGEM) * z);
      }
    }

    function antes(e: Event) {
      if ((e as ToggleEvent).newState !== 'open') return;
      setPausado(false);
      ir(0);
      // Sem espaço para o balão inteiro abaixo do botão, a página rola até o botão ficar no topo.
      const z = (el as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
      if (alvo && window.innerHeight - alvo.getBoundingClientRect().bottom < ESPACO_MINIMO * z)
        alvo.scrollIntoView({ block: 'start', behavior: 'instant' });
      posicionar();
    }
    function depois(e: Event) {
      const abriu = (e as ToggleEvent).newState === 'open';
      setAberto(abriu);
      if (abriu) {
        posicionar();
        window.addEventListener('scroll', posicionar, true);
        window.addEventListener('resize', posicionar);
      } else {
        window.removeEventListener('scroll', posicionar, true);
        window.removeEventListener('resize', posicionar);
      }
    }
    el.addEventListener('beforetoggle', antes);
    el.addEventListener('toggle', depois);
    return () => {
      el.removeEventListener('beforetoggle', antes);
      el.removeEventListener('toggle', depois);
      window.removeEventListener('scroll', posicionar, true);
      window.removeEventListener('resize', posicionar);
    };
    // Monta uma vez: `ir` só usa setters estáveis.
  }, []);

  // Uma timeline por cena: as peças e o relógio (barra do ponto atual) andam juntos.
  useLayoutEffect(() => {
    const raiz = palco.current?.querySelector<HTMLElement>('.tt-cena');
    if (!aberto || !raiz) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      const tl = montarCena(raiz, DURACAO);
      const relogio = pontos.current?.querySelector('[data-estado="atual"]');
      if (relogio)
        tl.fromTo(relogio, { scaleX: 0 }, { scaleX: 1, duration: DURACAO, ease: 'none' }, 0);
      if (reduzido) {
        tl.progress(1);
        return;
      }
      tl.eventCallback('onComplete', () => proxima.current());
      linha.current = tl;
      tl.play();
    });
    return () => {
      linha.current = null;
      ctx.revert();
    };
  }, [aberto, cena, rodada]);

  useEffect(() => {
    const tl = linha.current;
    if (tl) tl.paused(pausado);
  }, [pausado, rodada]);

  function tocarOuPausar() {
    if (fim) {
      setPausado(false);
      ir(0);
    } else setPausado((p) => !p);
  }

  const rotuloTocar = fim ? 'Ver de novo' : pausado ? 'Continuar' : 'Pausar';

  return (
    <>
      <button
        ref={botao}
        type="button"
        className="tt-abrir"
        popoverTarget={balaoId}
        aria-expanded={aberto}
      >
        <span className="tt-abrir-play" aria-hidden="true">
          <Icone nome="tocar" className="tt-abrir-ic" />
        </span>
        <span className="tt-abrir-texto">
          <span className="tt-abrir-titulo">{t.botao}</span>
          <span className="tt-abrir-sub">
            {t.resumo} · {total} cenas, cerca de {Math.round(total * DURACAO)} s
          </span>
        </span>
      </button>

      <div
        ref={balao}
        id={balaoId}
        popover="auto"
        role="dialog"
        aria-labelledby={`${balaoId}-t`}
        className="tt-balao"
        data-pausado={pausado || fim || undefined}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') ir(cena + 1);
          else if (e.key === 'ArrowLeft') ir(cena - 1);
        }}
      >
        <div className="tt-corpo">
          <header className="tt-cabeca">
            <div>
              <p className="tt-kicker">Tutorial</p>
              <h2 id={`${balaoId}-t`} className="tt-titulo">
                {t.titulo}
              </h2>
            </div>
            <button
              type="button"
              className="tt-icone-botao"
              popoverTarget={balaoId}
              popoverTargetAction="hide"
            >
              <Icone nome="fechar" className="tt-ic" />
              <span className="so-leitor">Fechar tutorial</span>
            </button>
          </header>

          <div ref={palco} className="tt-palco" aria-hidden="true">
            {aberto && (
              <div key={rodada} className="tt-cena">
                {atual.visual}
              </div>
            )}
          </div>

          <div className="tt-legenda" aria-live="polite">
            <p className="tt-legenda-num">
              Cena {cena + 1} de {total}
            </p>
            <h3 className="tt-legenda-titulo">{atual.titulo}</h3>
            <p className="tt-legenda-texto">{atual.texto}</p>
          </div>

          <div className="tt-controles">
            <ol ref={pontos} className="tt-pontos">
              {t.cenas.map((c, i) => (
                <li key={c.titulo}>
                  <button
                    type="button"
                    className="tt-ponto"
                    aria-current={i === cena ? 'step' : undefined}
                    onClick={() => ir(i)}
                  >
                    <span
                      key={i === cena ? rodada : 'fixo'}
                      className="tt-ponto-cheio"
                      data-estado={
                        i < cena || (i === cena && fim) ? 'feito' : i === cena ? 'atual' : 'futuro'
                      }
                    />
                    <span className="so-leitor">
                      Cena {i + 1}: {c.titulo}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="tt-botoes">
              <button
                type="button"
                className="tt-icone-botao"
                onClick={() => ir(cena - 1)}
                disabled={cena === 0}
              >
                <Icone nome="anterior" className="tt-ic" />
                <span className="so-leitor">Cena anterior</span>
              </button>
              <button
                type="button"
                className="tt-icone-botao tt-tocar"
                onClick={tocarOuPausar}
                title={rotuloTocar}
              >
                <Icone nome={fim ? 'repetir' : pausado ? 'tocar' : 'pausar'} className="tt-ic" />
                <span className="so-leitor">{rotuloTocar}</span>
              </button>
              <button
                type="button"
                className="tt-icone-botao"
                onClick={() => ir(cena + 1)}
                disabled={cena === total - 1}
              >
                <Icone nome="proximo" className="tt-ic" />
                <span className="so-leitor">Próxima cena</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
