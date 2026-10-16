import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { cleanup, render } from '@testing-library/react';
import { gsap } from 'gsap';
import { Contador, Funil, Sparkline, TRAPEZIOS, calcularSparkline } from './index';
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
    const to = vi.spyOn(gsap, 'to');
    const timeline = vi.spyOn(gsap, 'timeline');
    const { container } = render(
      <>
        <Contador valor={500} formatar={(n) => String(Math.round(n))} />
        <Funil etapas={etapas} />
        <Sparkline pontos={[1, 2]} largura={52} altura={24} cor="#fff" />
      </>,
    );
    expect(to).not.toHaveBeenCalled();
    expect(timeline).not.toHaveBeenCalled();
    expect(container.textContent).toContain('500');
    expect(container.textContent).toContain('320.840');
  });

  it('sem reduced-motion o contador anima a partir de 0', () => {
    mockReducedMotion(false);
    const to = vi.spyOn(gsap, 'to');
    const { container } = render(<Contador valor={500} formatar={(n) => String(Math.round(n))} />);
    expect(to).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('0');
  });
});
