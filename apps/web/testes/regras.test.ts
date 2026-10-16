import type { LinhaCanalMetrica } from '@trafego/contratos';
import { describe, expect, it } from 'vitest';
import {
  formatarCelula,
  gerarCsv,
  lerFiltros,
  montarBusca,
  nomeArquivoCsv,
  ordenarLinhas,
  proximaOrdenacao,
  textoAtualizacao,
  tomDelta,
} from '@/lib/regras';

function linha(canal: string, p: Partial<LinhaCanalMetrica> = {}): LinhaCanalMetrica {
  return {
    canal,
    cor: null,
    investimento: 1000,
    cliques: 10,
    visitas: 5,
    cadastros: 2,
    ftdsQtd: 1,
    ftdsValor: 100,
    depositos: 200,
    cpa: 1000,
    roas: 0.2,
    ...p,
  } as LinhaCanalMetrica;
}

describe('cor do delta', () => {
  it('CPA caindo é positivo; demais, subir é positivo', () => {
    expect(tomDelta('cpa', -5.4)).toBe('positivo');
    expect(tomDelta('cpa', 3)).toBe('negativo');
    expect(tomDelta('investimento', 12.5)).toBe('positivo');
    expect(tomDelta('roas', -1)).toBe('negativo');
    expect(tomDelta('ftds', null)).toBe('neutro');
  });
});

describe('tabela', () => {
  it('nulo vira travessão', () => {
    expect(formatarCelula('investimento', linha('X', { investimento: null }))).toBe('–');
  });
  it('ordena com nulos no fim e sem ordem mantém a da API', () => {
    const ls = [
      linha('A', { investimento: 5 }),
      linha('B', { investimento: null }),
      linha('C', { investimento: 9 }),
    ];
    expect(ordenarLinhas(ls, null).map((l) => l.canal)).toEqual(['A', 'B', 'C']);
    expect(
      ordenarLinhas(ls, { coluna: 'investimento', direcao: 'desc' }).map((l) => l.canal),
    ).toEqual(['C', 'A', 'B']);
    expect(
      ordenarLinhas(ls, { coluna: 'investimento', direcao: 'asc' }).map((l) => l.canal),
    ).toEqual(['A', 'C', 'B']);
  });
  it('clique alterna e volta à ordem da API', () => {
    const a = proximaOrdenacao(null, 'cliques');
    const b = proximaOrdenacao(a, 'cliques');
    expect(a?.coluna).toBe('cliques');
    expect(b?.direcao).not.toBe(a?.direcao);
    expect(proximaOrdenacao(b, 'cliques')).toBeNull();
  });
});

describe('filtros na URL', () => {
  it('padrões somem da URL e ida e volta preserva', () => {
    expect(montarBusca(lerFiltros({}))).toBe('');
    const f = lerFiltros({
      de: '2024-05-01',
      ate: '2024-05-24',
      comparar: 'nenhum',
      canal: 'Meta',
    });
    const volta = lerFiltros(Object.fromEntries(new URLSearchParams(montarBusca(f))));
    expect(volta).toEqual(f);
  });
});

describe('datas e CSV', () => {
  it('sem atualizadoEm mostra só a data final', () => {
    expect(textoAtualizacao(null, '2024-05-24', 'America/Sao_Paulo')).toBe('24/05/2024');
  });
  it('CSV com BOM, ponto e vírgula, vírgula decimal e total', () => {
    const csv = gerarCsv([linha('Meta', { investimento: 13260.5, cpa: null })], linha('t'));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const linhas = csv.slice(1).trim().split(/\r?\n/);
    expect(linhas).toHaveLength(3);
    expect(linhas[0]!.split(';')).toHaveLength(10);
    expect(linhas[1]).toContain('13260,5');
    expect(linhas[2]!.startsWith('Total;')).toBe(true);
    expect(nomeArquivoCsv('2024-05-01', '2024-05-24')).toBe(
      'desempenho-por-canal_2024-05-01_2024-05-24.csv',
    );
  });
});
