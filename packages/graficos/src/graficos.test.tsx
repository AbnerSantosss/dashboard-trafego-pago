import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { Contador, Funil, Sparkline, TRAPEZIOS, calcularSparkline } from './index';
import { CSS_MOVIMENTO, animarNumero, esperaDaEntradaCss, saidaQuad } from './movimento';
import type { EtapaFunilProps } from './tipos';

const etapas: EtapaFunilProps[] = [
  ['impressoes', 'Impressões', 320840, '100%', 'base de referência'],
  ['cliques', 'Cliques', 40105, '12,5%', 'de conversão'],
  ['cadastros', 'Cadastros', 8021, '20,0%', 'de conversão'],
  ['ftds', 'FTDs', 1604, '20,0%', 'de conversão'],
  ['depositos', 'Depósitos', 802, '50,0%', 'de conversão'],
].map(([id, rotulo, valor, taxa, legenda]) => ({
  id: id as string,
  rotulo: rotulo as string,
  valor: valor as number,
  valorFormatado: new Intl.NumberFormat('pt-BR').format(valor as number),
  taxaFormatada: taxa as string,
  legenda: legenda as string,
}));

function mockReducedMotion(reduz: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((q: string) => ({
      matches: reduz && q.includes('reduce'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SSR', () => {
  it('renderiza o estado final sem erro', () => {
    const html = renderToString(
      <>
        <Funil etapas={etapas} />
        <Sparkline pontos={[1, 3, 2]} largura={52} altura={24} cor="#3FCDBC" />
        <Contador valor={1234} formatar={(n) => `R$ ${Math.round(n)}`} />
      </>,
    );
    expect(html).toContain('320.840');
    expect(html).toContain('data-etapa="depositos"');
    expect(html).toContain('R$ 1234');
    expect(html).not.toContain('stroke-dashoffset');
  });
});

describe('Funil', () => {
  it('desenha cinco trapézios com os vértices do protótipo', () => {
    const { container } = render(<Funil etapas={etapas} semAnimacao />);
    const paths = container.querySelectorAll('[data-parte="trapezio"]');
    expect(paths).toHaveLength(5);
    paths.forEach((p, i) => {
      const d = p.getAttribute('d')!;
      for (const [x, y] of TRAPEZIOS[i]!) expect(d).toContain(`Q${x},${y}`);
    });
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('194 322 444 322');
  });

  it('recua cada etapa lateralmente e mantém alturas de 54–58 px', () => {
    for (let i = 1; i < TRAPEZIOS.length; i++) {
      const [tl, tr] = TRAPEZIOS[i]!;
      const [ptl, ptr] = TRAPEZIOS[i - 1]!;
      expect(tl[0] - ptl[0]).toBeGreaterThan(20);
      expect(ptr[0] - tr[0]).toBeGreaterThan(20);
    }
    for (const t of TRAPEZIOS) {
      const h = t[2][1] - t[1][1];
      expect(h).toBeGreaterThanOrEqual(54);
      expect(h).toBeLessThanOrEqual(58);
    }
  });

  it('quatro conectores (todas as etapas exceto a primeira)', () => {
    const { container } = render(<Funil etapas={etapas} semAnimacao />);
    expect(container.querySelectorAll('circle')).toHaveLength(4);
  });

  it('sem onEtapa é imagem; com onEtapa cada etapa é botão (clique, Enter e Espaço)', () => {
    const { container, rerender } = render(<Funil etapas={etapas} semAnimacao />);
    expect(container.querySelector('svg')!.getAttribute('role')).toBe('img');
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);

    const onEtapa = vi.fn();
    rerender(<Funil etapas={etapas} semAnimacao onEtapa={onEtapa} etapaAtiva="ftds" />);
    expect(container.querySelector('svg')!.getAttribute('role')).toBe('group');
    const botoes = container.querySelectorAll<SVGGElement>('[data-etapa][role="button"]');
    expect(botoes).toHaveLength(5);
    expect(botoes[0]!.getAttribute('tabindex')).toBe('0');
    expect(botoes[0]!.getAttribute('aria-label')).toContain('Ver a lista');

    act(() => {
      botoes[3]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      botoes[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      botoes[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      botoes[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    });
    expect(onEtapa.mock.calls.map((c) => c[0])).toEqual(['ftds', 'cliques', 'cadastros']);
    expect(container.querySelector('[data-ativa]')!.getAttribute('data-etapa')).toBe('ftds');
  });

  it('brilho e neon existem em cada etapa e começam apagados (o CSS acende no hover)', () => {
    const { container } = render(<Funil etapas={etapas} semAnimacao />);
    expect(container.querySelectorAll('[data-parte="brilho"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-parte="neon"]')).toHaveLength(5);
    expect(container.querySelector('filter[id$="-neon"]')).not.toBeNull();
    expect(CSS_MOVIMENTO).toMatch(/\[data-parte='neon'\]\s*\{\s*opacity: 0;/);
    expect(CSS_MOVIMENTO).not.toContain('opacity: 0.45');
  });
});

describe('Sparkline', () => {
  it('N pontos geram M + (N-1) curvas', () => {
    const { linha } = calcularSparkline([5, 3, 8, 6, 9, 12], 52, 24);
    const comandos = linha.match(/[MC]/g)!;
    expect(comandos).toHaveLength(6);
    expect(comandos[0]).toBe('M');
  });

  it('vazio gera traço plano no meio', () => {
    expect(calcularSparkline([], 52, 24)).toEqual({ linha: 'M0,12L52,12', area: '' });
  });

  it('não corta o traço (y dentro de [1, altura-2])', () => {
    const { linha } = calcularSparkline([0, 10], 52, 24);
    const ys = [...linha.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(22);
  });
});

describe('Contador e reduced-motion', () => {
  it('semAnimacao mostra formatar(valor)', () => {
    const { container } = render(
      <Contador valor={900} formatar={(n) => `${Math.round(n)} un`} semAnimacao />,
    );
    expect(container.textContent).toBe('900 un');
  });

  it('com prefers-reduced-motion nenhuma animação é criada', () => {
    mockReducedMotion(true);
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const { container } = render(
      <>
        <Contador valor={500} formatar={(n) => String(Math.round(n))} />
        <Funil etapas={etapas} />
        <Sparkline pontos={[1, 2]} largura={52} altura={24} cor="#fff" />
      </>,
    );
    expect(raf).not.toHaveBeenCalled();
    expect(container.textContent).toContain('500');
    expect(container.textContent).toContain('320.840');
  });

  it('sem reduced-motion o contador anima a partir de 0', () => {
    mockReducedMotion(false);
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const { container } = render(<Contador valor={500} formatar={(n) => String(Math.round(n))} />);
    expect(raf).toHaveBeenCalled();
    expect(container.textContent).toBe('0');
  });
});

describe('Movimento (rAF + CSS)', () => {
  /** Relógio de quadros manual: cada `quadro(ms)` chama os callbacks pendentes com esse tempo. */
  function relogio() {
    let fila: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => fila.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {
      fila = [];
    });
    return (ms: number) =>
      act(() => {
        const agora = fila;
        fila = [];
        agora.forEach((cb) => cb(ms));
      });
  }

  it('saidaQuad é 1 − (1 − t)², limitada a [0, 1]', () => {
    expect(saidaQuad(0)).toBe(0);
    expect(saidaQuad(0.5)).toBeCloseTo(0.75);
    expect(saidaQuad(1)).toBe(1);
    expect(saidaQuad(2)).toBe(1);
    expect(saidaQuad(-1)).toBe(0);
  });

  it('animarNumero escreve o inicial na hora, sobe monotônico e termina exato', () => {
    const quadro = relogio();
    const vistos: [number, boolean][] = [];
    animarNumero({ de: 0, ate: 1000, duracaoMs: 800, aCada: (v, f) => vistos.push([v, f]) });
    expect(vistos[0]).toEqual([0, false]);
    [0, 200, 400, 600, 799, 800].forEach((t) => quadro(1000 + t));
    const valores = vistos.map(([v]) => v);
    for (let i = 1; i < valores.length; i++)
      expect(valores[i]!).toBeGreaterThanOrEqual(valores[i - 1]!);
    expect(vistos[2]![0]).toBeCloseTo(1000 * (1 - 0.75 * 0.75));
    expect(vistos.at(-1)).toEqual([1000, true]);
  });

  it('contador termina exatamente no texto final, com a mesma máscara nos quadros', () => {
    mockReducedMotion(false);
    const quadro = relogio();
    const fmt = (n: number) => `R$ ${new Intl.NumberFormat('pt-BR').format(Math.round(n))}`;
    const { container } = render(<Contador valor={226190} formatar={fmt} />);
    expect(container.textContent).toBe('R$ 0');
    quadro(0);
    quadro(400);
    expect(container.textContent).toMatch(/^R\$ \d{1,3}(\.\d{3})*$/);
    quadro(800);
    expect(container.textContent).toBe('R$ 226.190');
  });

  it('valores do funil contam e terminam no valorFormatado', () => {
    mockReducedMotion(false);
    const quadro = relogio();
    const { container } = render(<Funil etapas={etapas} />);
    const valores = () =>
      [...container.querySelectorAll('[data-parte="valor"]')].map((e) => e.textContent);
    expect(valores()).toEqual(['0', '0', '0', '0', '0']);
    quadro(0);
    quadro(440);
    expect(valores()).toEqual(etapas.map((e) => e.valorFormatado));
  });

  it('em StrictMode (monta, desmonta, remonta) ainda conta a partir de 0', () => {
    mockReducedMotion(false);
    const quadro = relogio();
    const fmt = (n: number) => String(Math.round(n));
    const { container } = render(
      <StrictMode>
        <Contador valor={500} formatar={fmt} />
        <Funil etapas={etapas} />
      </StrictMode>,
    );
    const valores = () =>
      [...container.querySelectorAll('[data-parte="valor"]')].map((e) => e.textContent);
    expect(container.querySelector('[data-componente="contador"]')!.textContent).toBe('0');
    expect(valores()).toEqual(['0', '0', '0', '0', '0']);
    quadro(0);
    quadro(800);
    expect(container.querySelector('[data-componente="contador"]')!.textContent).toBe('500');
    expect(valores()).toEqual(etapas.map((e) => e.valorFormatado));
  });

  it('na troca de dados conta do valor anterior ao novo', () => {
    mockReducedMotion(false);
    const quadro = relogio();
    const fmt = (n: number) => String(Math.round(n));
    const { container, rerender } = render(<Contador valor={100} formatar={fmt} />);
    quadro(0);
    quadro(800);
    rerender(<Contador valor={200} formatar={fmt} />);
    expect(container.textContent).toBe('100');
    quadro(1000);
    quadro(1800);
    expect(container.textContent).toBe('200');
  });

  it('não reconta se a entrada CSS já terminou (hidratação tardia)', () => {
    mockReducedMotion(false);
    const fmt = (n: number) => String(Math.round(n));
    const proto = HTMLElement.prototype as unknown as { getAnimations?: () => Animation[] };
    proto.getAnimations = () => [];
    try {
      const { container } = render(
        <div className="entrada">
          <Contador valor={321} formatar={fmt} sincronizarCom=".entrada" />
        </div>,
      );
      expect(container.textContent).toBe('321');
    } finally {
      delete proto.getAnimations;
    }
  });

  it('esperaDaEntradaCss: falta, começou há pouco, já visível demais', () => {
    const el = (currentTime: number) =>
      ({
        getAnimations: () => [
          {
            playState: 'running',
            pending: false,
            currentTime,
            effect: { getTiming: () => ({ delay: 100, duration: 300 }) },
          },
        ],
      }) as unknown as Element;
    expect(esperaDaEntradaCss(el(40))).toBe(60);
    expect(esperaDaEntradaCss(el(120))).toBe(0);
    expect(esperaDaEntradaCss(el(300))).toBeNull();
    expect(esperaDaEntradaCss(null)).toBe(0);
  });

  it('o CSS só anima sob no-preference e só transform/opacity/clip-path', () => {
    const fora = CSS_MOVIMENTO.slice(0, CSS_MOVIMENTO.indexOf('@keyframes'));
    expect(fora.trim().startsWith('@media (prefers-reduced-motion: no-preference)')).toBe(true);
    const props = [...CSS_MOVIMENTO.matchAll(/(?:from|to|\d+%) \{([^}]*)\}/g)].flatMap((m) =>
      [...m[1]!.matchAll(/([a-z-]+):/g)].map((p) => p[1]),
    );
    expect(new Set(props)).toEqual(new Set(['transform', 'opacity', 'clip-path']));
    expect(CSS_MOVIMENTO).toContain('backwards');
  });
});
