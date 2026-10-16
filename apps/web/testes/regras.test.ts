import type { LinhaCanalMetrica } from '@trafego/contratos';
import { describe, expect, it } from 'vitest';
import {
  consolidarKpi,
  ETAPA_DO_KPI,
  atalhoAtivo,
  formatarCelula,
  gerarCsv,
  lerFiltros,
  montarBusca,
  nomeArquivoCsv,
  ordenarLinhas,
  periodoDoAtalho,
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

describe('atalhos de período', () => {
  // 02:30 UTC de 16/10 ainda é 15/10 em São Paulo (UTC-3): o dia vem do fuso da empresa.
  const agora = new Date('2026-10-16T02:30:00Z');
  const fuso = 'America/Sao_Paulo';
  it('hoje, ontem e últimos 7 dias contam a partir do dia no fuso', () => {
    expect(periodoDoAtalho('hoje', agora, fuso)).toEqual({ de: '2026-10-15', ate: '2026-10-15' });
    expect(periodoDoAtalho('ontem', agora, fuso)).toEqual({ de: '2026-10-14', ate: '2026-10-14' });
    expect(periodoDoAtalho('7dias', agora, fuso)).toEqual({ de: '2026-10-09', ate: '2026-10-15' });
    expect(periodoDoAtalho('hoje', agora, 'UTC')).toEqual({ de: '2026-10-16', ate: '2026-10-16' });
  });
  it('ontem atravessa a virada do mês', () => {
    expect(periodoDoAtalho('ontem', new Date('2026-03-01T15:00:00Z'), fuso)).toEqual({
      de: '2026-02-28',
      ate: '2026-02-28',
    });
  });
  it('reconhece o atalho aberto; outro período é data personalizada', () => {
    expect(atalhoAtivo('2026-10-09', '2026-10-15', agora, fuso)).toBe('7dias');
    expect(atalhoAtivo('2026-10-14', '2026-10-14', agora, fuso)).toBe('ontem');
    expect(atalhoAtivo('2026-10-01', '2026-10-15', agora, fuso)).toBeNull();
  });
});

describe('consolidado de KPI por canal', () => {
  const linha = (canal: string, p: Partial<LinhaCanalMetrica>): LinhaCanalMetrica => ({
    canal,
    cor: null,
    investimento: null,
    cliques: 0,
    visitas: 0,
    cadastros: 0,
    ftdsQtd: 0,
    ftdsValor: 0,
    depositos: 0,
    cpa: null,
    roas: null,
    ...p,
  });
  const linhas = [
    linha('Meta', {
      investimento: 300,
      ftdsQtd: 6,
      ftdsValor: 600,
      depositos: 900,
      cpa: 50,
      roas: 3,
    }),
    linha('Email', {
      investimento: 100,
      ftdsQtd: 4,
      ftdsValor: 200,
      depositos: 100,
      cpa: 25,
      roas: 1,
    }),
    linha('Outros', { ftdsQtd: 0 }),
  ];

  it('somas mostram a fatia do total, do maior para o menor', () => {
    const r = consolidarKpi('investimento', linhas);
    expect(r.map((l) => l.canal)).toEqual(['Meta', 'Email', 'Outros']);
    expect(r[0]!.fracao).toBe(0.75);
    expect(r[0]!.detalhe).toBe('75,0% do total');
    expect(r[2]!.texto).toBe('–');
    expect(r[2]!.detalhe).toBe('Sem gasto lançado');
    expect(r.every((l) => !l.temPessoas)).toBe(true);
  });

  it('CPA vai do menor para o maior e explica a conta; sem FTD fica no fim', () => {
    const r = consolidarKpi('cpa', linhas);
    expect(r.map((l) => l.canal)).toEqual(['Email', 'Meta', 'Outros']);
    expect(r[1]!.fracao).toBe(1);
    expect(r[0]!.detalhe).toContain('÷ 4 FTDs');
    expect(r[2]!.detalhe).toBe('Sem FTD no período');
    expect(r.map((l) => l.temPessoas)).toEqual([true, true, false]);
  });

  it('FTDs leva à etapa ftd e mostra o valor do 1º depósito', () => {
    const r = consolidarKpi('ftds', linhas);
    expect(ETAPA_DO_KPI.ftds).toBe('ftd');
    expect(ETAPA_DO_KPI.investimento).toBeNull();
    expect(r[0]!.detalhe).toContain('60,0% do total');
    expect(r[0]!.detalhe).toContain('no 1º depósito');
  });

  it('sem linhas não quebra', () => {
    expect(consolidarKpi('roas', [])).toEqual([]);
  });
});
