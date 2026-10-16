/**
 * Compila uma cena do tutorial numa linha do tempo GSAP, no contrato do Hyperframes (só referência,
 * ver a wiki 18 - Hyperframes, 04-animacao): UMA timeline pausada por cena, `fromTo` com o estado
 * inicial explícito, tempos absolutos (nada de `+=`), só transform e opacidade, nada aleatório e
 * nada em loop. Por isso a cena é seek-safe: `tl.progress(1)` dá o estado final exato (é o que o
 * movimento reduzido mostra) e pausar ou repetir nunca deixa peça no meio do caminho.
 *
 * As peças (tutoriais.tsx) só declaram o movimento: `data-hf` diz a receita e `data-t` o instante
 * em ms dentro da cena. As receitas vêm das regras atômicas da wiki:
 * - surge / janela / pop: spring-pop-entrance (power3.out, sem overshoot; selo com back.out leve);
 * - cascata: waterfall-entry (linha de código sobe e assenta em power4.out);
 * - desenha / desenha-v: svg-path-draw e stat-bars-and-fills (scaleX/scaleY a partir da borda);
 * - pacote: o ponto que viaja pelo conector (entra, atravessa, some);
 * - cursor: cursor-click-ripple + press-release-spring (o alvo afunda junto e volta com mola);
 * - troca: scale-swap-transition (o valor velho encolhe, o novo estoura no mesmo centro);
 * - contar: counting-dynamic-scale (o número conta e cresce junto);
 * - marca: css-marker-patterns em highlight (a faixa varre a linha realçada);
 * - brilho: ambient-glow-bloom (halo atrás do destino, opacidade de pico 0,3).
 */
import { gsap } from 'gsap';

const s = (el: HTMLElement, chave: string, padrao = 0) => {
  const v = el.dataset[chave];
  return v === undefined ? padrao : Number(v) / 1000;
};

/** Número em pt-BR com casas fixas; o mesmo formato serve ao texto inicial e ao contador. */
export function formatarValor(v: number, casas = 0, prefixo = '', sufixo = ''): string {
  const n = v.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
  return `${prefixo}${n}${sufixo}`;
}

const formatar = (v: number, el: HTMLElement) =>
  formatarValor(v, Number(el.dataset.casas ?? 0), el.dataset.prefixo, el.dataset.sufixo);

/** Monta a timeline da cena `raiz` com `duracao` segundos (o resto depois das entradas é leitura). */
export function montarCena(raiz: HTMLElement, duracao: number): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });

  tl.fromTo(raiz, { autoAlpha: 0, scale: 0.985 }, { autoAlpha: 1, scale: 1, duration: 0.35 }, 0);

  raiz.querySelectorAll<HTMLElement>('[data-hf]').forEach((el) => {
    const t = s(el, 't');
    switch (el.dataset.hf) {
      case 'surge':
        tl.fromTo(el, { autoAlpha: 0, y: '0.6em' }, { autoAlpha: 1, y: 0, duration: 0.45 }, t);
        break;
      case 'janela':
        tl.fromTo(
          el,
          { autoAlpha: 0, y: '0.8em', scale: 0.96 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.55 },
          t,
        );
        break;
      case 'pop':
        tl.fromTo(
          el,
          { autoAlpha: 0, scale: 0.6 },
          { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(1.5)' },
          t,
        );
        break;
      case 'cascata':
        tl.fromTo(
          el,
          { autoAlpha: 0, y: '0.9em' },
          { autoAlpha: 1, y: 0, duration: 0.2, ease: 'power4.out' },
          t,
        );
        break;
      case 'desenha':
        tl.fromTo(
          el,
          { scaleX: 0 },
          { scaleX: Number(el.dataset.f ?? 1), duration: el.dataset.f ? 0.9 : 0.5 },
          t,
        );
        break;
      case 'desenha-v':
        tl.fromTo(el, { scaleY: 0 }, { scaleY: 1, duration: 0.42 }, t);
        break;
      case 'pacote':
        tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1, ease: 'none' }, t);
        tl.fromTo(el, { xPercent: 0 }, { xPercent: 100, duration: 0.8, ease: 'power1.inOut' }, t);
        tl.to(el, { autoAlpha: 0, duration: 0.12, ease: 'none' }, t + 0.7);
        break;
      case 'cursor': {
        const alvo = el.closest<HTMLElement>('.tt-alvo');
        const anel = el.previousElementSibling as HTMLElement | null;
        tl.fromTo(
          el,
          { autoAlpha: 0, x: '3.2em', y: '2.4em' },
          { autoAlpha: 1, x: 0, y: 0, duration: 0.6, ease: 'power3.inOut' },
          t,
        );
        // Clique: cursor e alvo afundam juntos e voltam com mola; o anel abre e some.
        const c = t + 0.62;
        tl.to(el, { scale: 0.85, duration: 0.08, ease: 'power1.in' }, c);
        tl.to(el, { scale: 1, duration: 0.35, ease: 'back.out(2)' }, c + 0.08);
        if (alvo) {
          tl.fromTo(
            alvo,
            { scale: 1 },
            { scale: 0.94, duration: 0.08, ease: 'power1.in', immediateRender: false },
            c,
          );
          tl.to(alvo, { scale: 1, duration: 0.45, ease: 'back.out(1.6)' }, c + 0.08);
        }
        if (anel) {
          tl.fromTo(
            anel,
            { autoAlpha: 0, scale: 0.3 },
            { autoAlpha: 0.9, duration: 0.01, ease: 'none' },
            c + 0.04,
          );
          tl.to(anel, { autoAlpha: 0, scale: 2.2, duration: 0.6, ease: 'power2.out' }, c + 0.05);
        }
        break;
      }
      case 'troca': {
        const [velho, novo] = Array.from(el.children) as HTMLElement[];
        if (velho) tl.to(velho, { autoAlpha: 0, scale: 0.8, duration: 0.3, ease: 'power2.in' }, t);
        if (novo)
          tl.fromTo(
            novo,
            { autoAlpha: 0, scale: 0.6 },
            { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(1.7)' },
            t + 0.15,
          );
        break;
      }
      case 'contar': {
        const de = Number(el.dataset.de ?? 0);
        const proxy = { v: de };
        tl.fromTo(
          proxy,
          { v: de },
          {
            v: Number(el.dataset.para ?? 0),
            duration: 1.2,
            ease: 'power2.out',
            onUpdate: () => {
              el.textContent = formatar(proxy.v, el);
            },
          },
          t,
        );
        tl.fromTo(el, { scale: 0.85 }, { scale: 1, duration: 1.2, ease: 'power2.out' }, t);
        break;
      }
      case 'marca':
        tl.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'power2.out' }, t);
        break;
      case 'brilho':
        tl.fromTo(el, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 0.3, scale: 1, duration: 1 }, t);
        break;
    }
    // Saída opcional da mesma peça (linha removida): sobe um pouco e some.
    if (el.dataset.sai !== undefined) {
      tl.to(el, { autoAlpha: 0, y: '-0.35em', duration: 0.32, ease: 'power2.in' }, s(el, 'sai'));
    }
  });

  // A cena dura sempre `duracao`: as entradas acabam antes e o resto é tempo de leitura.
  tl.set({}, {}, duracao);
  return tl;
}
