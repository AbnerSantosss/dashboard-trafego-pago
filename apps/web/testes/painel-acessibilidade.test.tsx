// @vitest-environment jsdom
/** Acessibilidade do painel: ordenação com aria-sort, dicas ⓘ, menus fecháveis, carregamento e erro. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ariaSort, Painel } from '@/componentes/Painel';
import type { Filtros } from '@/lib/regras';
import {
  ALVO_INFO,
  geometriaInfo,
  INFOS,
  montarPrincipal,
  slotSoVisual,
  type ConteudoTela,
} from '@/lib/tela';

const roteador = { push: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => roteador,
  usePathname: () => '/',
}));

const filtros: Filtros = { comparar: 'anterior', canal: 'todos', campanha: 'todas' };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('regras puras', () => {
  it('aria-sort segue a ordenação da coluna', () => {
    expect(ariaSort(null, 'cpa')).toBe('none');
    expect(ariaSort({ coluna: 'roas', direcao: 'desc' }, 'cpa')).toBe('none');
    expect(ariaSort({ coluna: 'cpa', direcao: 'desc' }, 'cpa')).toBe('descending');
    expect(ariaSort({ coluna: 'canal', direcao: 'asc' }, 'canal')).toBe('ascending');
  });

  it('só os textos da tabela desenhada saem da árvore de acessibilidade', () => {
    expect(slotSoVisual('th.5.0')).toBe(true);
    expect(slotSoVisual('linha.2.4')).toBe(true);
    expect(slotSoVisual('total.3')).toBe(true);
    expect(slotSoVisual('tabela.titulo')).toBe(false);
    expect(slotSoVisual('kpi.0.valor')).toBe(false);
  });

  it('alvo do ⓘ fica centrado no desenho e a dica não passa da borda direita', () => {
    for (const info of Object.values(INFOS)) {
      const { alvo, dica } = geometriaInfo(info);
      expect(alvo.left + ALVO_INFO / 2).toBeCloseTo(info.x + info.w / 2);
      expect(alvo.top + ALVO_INFO / 2).toBeCloseTo(info.y + info.h / 2);
      expect(dica.left + dica.width).toBeLessThanOrEqual(1300);
      expect(dica.top).toBeGreaterThan(info.y + info.h);
    }
  });

  it('os ícones ⓘ desenhados continuam na geometria do protótipo', () => {
    const conteudo = {
      titulo: '',
      subtitulo: '',
      atualizadoRotulo: '',
      atualizadoValor: '',
      exportar: '',
      limpar: '',
      filtros: [],
      kpis: [],
      legendaVariacao: '',
      funil: { titulo: '', etapas: [] },
      tabela: { titulo: '', cabecalhos: [], linhas: [], total: null },
    } satisfies ConteudoTela;
    const icones = montarPrincipal(conteudo).filter((n) => n.tipo === 'icone' && n.nome === 'info');
    expect(icones.map((n) => (n.tipo === 'icone' ? [n.slot, n.x, n.y, n.w, n.h] : null))).toEqual([
      ['funil.info', 361, 300, 15, 15],
      ['tabela.info', 847, 300, 15, 15],
      ['th.7.info', 1206, 339.5, 14, 14],
      ['th.8.info', 1278, 339.5, 14, 14],
    ]);
  });
});

describe('Painel', () => {
  it('cabeçalhos da tabela: rótulo humano e aria-sort no columnheader', () => {
    render(<Painel dados={null} erro={null} filtros={filtros} />);
    const botao = screen.getByRole('button', { name: 'Ordenar por FTDs Qtd.' });
    const th = botao.closest('[role="columnheader"]')!;
    expect(th.getAttribute('aria-sort')).toBe('none');
    fireEvent.click(botao);
    expect(th.getAttribute('aria-sort')).toBe('descending');
    fireEvent.click(botao);
    expect(th.getAttribute('aria-sort')).toBe('ascending');
    fireEvent.click(botao);
    expect(th.getAttribute('aria-sort')).toBe('none');
    expect(screen.queryByRole('button', { name: /ftdsQtd/ })).toBeNull();
  });

  it('ⓘ abre a dica no foco, liga por aria-describedby e fecha com Esc', () => {
    render(<Painel dados={null} erro={null} filtros={filtros} />);
    const botao = screen.getByRole('button', { name: 'Sobre ROAS' });
    const dica = document.getElementById(botao.getAttribute('aria-describedby')!)!;
    expect(dica.getAttribute('role')).toBe('tooltip');
    expect(dica.hidden).toBe(true);
    act(() => botao.focus());
    expect(dica.hidden).toBe(false);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dica.hidden).toBe(true);
    fireEvent.mouseEnter(botao);
    expect(dica.hidden).toBe(false);
  });

  it('menu Exportar fecha com Esc e devolve o foco ao botão', () => {
    render(<Painel dados={null} erro={null} filtros={filtros} />);
    const botao = screen.getByRole('button', { name: 'Exportar dados' });
    fireEvent.click(botao);
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(botao);
  });

  it('menu Exportar fecha com clique fora', () => {
    render(<Painel dados={null} erro={null} filtros={filtros} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar dados' }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('popover de período fecha com Esc e devolve o foco', () => {
    render(<Painel dados={null} erro={null} filtros={filtros} />);
    const botao = screen.getByRole('button', { name: /^Período/ });
    fireEvent.click(botao);
    expect(screen.getByRole('dialog', { name: 'Escolher período' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(botao);
  });

  it('faixa de erro tem "Tentar de novo" que refaz a busca', () => {
    render(<Painel dados={null} erro="API fora do ar." filtros={filtros} />);
    expect(screen.getByRole('alert').textContent).toContain('API fora do ar.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(roteador.refresh).toHaveBeenCalledTimes(1);
  });

  it('região principal é o alvo do link de pular e começa sem aria-busy ativo', () => {
    render(<Painel dados={null} erro={null} filtros={filtros} />);
    const principal = screen.getByRole('main');
    expect(principal.id).toBe('conteudo');
    expect(principal.getAttribute('aria-busy')).toBe('false');
  });
});
