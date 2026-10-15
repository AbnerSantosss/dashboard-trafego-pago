import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { referencia } from './referencia';
import * as indice from './index';
import type { LinhaCanal } from './tipos';

const { kpis, funil, tabela } = referencia;

function canal(id: LinhaCanal['id']): LinhaCanal {
  const l = id === 'total' ? tabela.total : tabela.linhas.find((x) => x.id === id);
  if (!l) throw new Error(`canal ${id} ausente`);
  return l;
}

describe('textos da tela', () => {
  it('cabeçalho, data e botões', () => {
    expect(referencia.titulo).toBe('Visão Geral de Aquisição');
    expect(referencia.subtitulo).toBe(
      'Acompanhe os resultados do marketing de forma simples e objetiva.',
    );
    expect(referencia.atualizadoEm).toEqual({
      rotulo: 'Dados atualizados em:',
      valor: '24/05/2024 08:30',
    });
    expect(referencia.botoes).toEqual({ exportar: 'Exportar', limparFiltros: 'Limpar filtros' });
  });
  it('filtros (rótulo "Período." com ponto, como na imagem)', () => {
    expect(referencia.filtros.map((f) => [f.rotulo, f.valor])).toEqual([
      ['Período.', '01/05/2024 - 24/05/2024'],
      ['Comparar com', 'Período anterior'],
      ['Canal', 'Todos'],
      ['Campanha', 'Todas'],
    ]);
  });
  it('menu lateral', () => {
    expect(referencia.menu.map((m) => m.rotulo)).toEqual([
      'Visão Geral',
      'Gestão de Custos',
      'Relatórios',
      'Ajuda',
    ]);
    expect(referencia.menu.filter((m) => m.ativo).map((m) => m.id)).toEqual(['visao-geral']);
  });
  it('títulos de seção e legendas', () => {
    expect(funil.titulo).toBe('Funil de Aquisição');
    expect(tabela.titulo).toBe('Desempenho por canal');
    expect(referencia.legendaVariacao).toBe('vs. período anterior');
    expect(funil.legendaBase).toBe('(base de referência)');
    expect(funil.legendaConversao).toBe('de conversão');
  });
  it('cabeçalho da tabela em dois níveis (FTDs → Qtd. / Valor (R$))', () => {
    const ftds = tabela.cabecalhos.find((c) => c.id === 'ftds');
    expect(ftds?.subcolunas?.map((s) => s.rotulo.join(' '))).toEqual(['Qtd.', 'Valor (R$)']);
    expect(tabela.cabecalhos.map((c) => c.rotulo.join(' '))).toEqual([
      'Canal',
      'Investimento',
      'Cliques',
      'Visitas',
      'Cadastros',
      'FTDs',
      'Depósitos no período (R$)',
      'CPA (R$)',
      'ROAS (Depósitos)',
    ]);
  });
});

describe('KPIs batem com a imagem', () => {
  it('rótulos, valores e variações', () => {
    expect(
      kpis.map((k) => [k.rotulo, k.valorFormatado, k.variacaoFormatada, k.direcao, k.cor]),
    ).toEqual([
      ['Investimento total', 'R$ 33.840', '12,5%', 'alta', '#0070F8'],
      ['FTDs', '995', '18,6%', 'alta', '#0070F8'],
      ['Custo por FTD (CPA)', 'R$ 33,97', '-5,4%', 'baixa', '#E13C5D'],
      ['Depósitos no período', 'R$ 226.190', '22,1%', 'alta', '#24CCB6'],
      ['ROAS (Depósitos)', '6,68x', '16,8%', 'alta', '#34DFCE'],
    ]);
  });
  it('KPIs coincidem com a linha Total da tabela', () => {
    const t = tabela.total;
    expect(kpis.map((k) => k.valor)).toEqual([
      t.investimento,
      t.ftdsQtd,
      t.cpa,
      t.depositos,
      t.roas,
    ]);
  });
});

describe('funil', () => {
  it('etapas, valores e taxas da imagem', () => {
    expect(funil.etapas.map((e) => [e.rotulo, e.valorFormatado, e.taxaFormatada])).toEqual([
      ['Base contatada', '320.840', '100%'],
      ['Cliques', '40.000', '12,5%'],
      ['Visitas ao site', '30.000', '75,0%'],
      ['Cadastro', '6.000', '20,0%'],
      ['FTD', '600', '10,0%'],
    ]);
  });
  it('taxa = etapa / etapa anterior (arredondada a 1 casa)', () => {
    funil.etapas.forEach((e, i) => {
      const anterior = funil.etapas[i - 1];
      const esperado = anterior ? (e.valor / anterior.valor) * 100 : 100;
      expect(e.taxaPct).toBeCloseTo(esperado, 1);
    });
  });
  it('funil NÃO concilia com a tabela (dados ilustrativos; imagem reproduzida como está)', () => {
    // Funil: 40.000 cliques / 30.000 visitas / 6.000 cadastros / 600 FTDs.
    // Tabela: 70.386 / 32.254 / 6.368 / 995. Fica registrado para ninguém "corrigir".
    const [, cliques, visitas, cadastro, ftd] = funil.etapas.map((e) => e.valor);
    expect([cliques, visitas, cadastro, ftd]).toEqual([40000, 30000, 6000, 600]);
    expect(ftd).not.toBe(tabela.total.ftdsQtd);
  });
});

describe('tabela por canal', () => {
  it('células formatadas como na imagem', () => {
    const celulas = [...tabela.linhas, tabela.total].map((l) => [
      l.canal,
      l.formatado.investimento,
      l.formatado.cliques,
      l.formatado.visitas,
      l.formatado.cadastros,
      l.formatado.ftdsQtd,
      l.formatado.ftdsValor,
      l.formatado.depositos,
      l.formatado.cpa,
      l.formatado.roas,
    ]);
    // A imagem imprime "1,900" (Meta/Cadastros) e "1,420" (Outros/Cliques) com vírgula:
    // erro tipográfico da imagem. O dado é 1900 / 1420 e o padrão pt-BR é "1.900" / "1.420".
    expect(celulas).toEqual([
      [
        'Meta',
        'R$ 13.260',
        '19.823',
        '9.138',
        '1.900',
        '250',
        'R$ 37.690',
        'R$ 58.750',
        'R$ 53,04',
        '4,43x',
      ],
      [
        'Email',
        'R$ 10.890',
        '15.630',
        '7.082',
        '1.100',
        '210',
        'R$ 29.420',
        'R$ 45.800',
        'R$ 51,86',
        '4,20x',
      ],
      [
        'SMS',
        'R$ 8.740',
        '10.512',
        '4.921',
        '520',
        '85',
        'R$ 12.580',
        'R$ 18.250',
        'R$ 102,82',
        '2,09x',
      ],
      ['Afiliados', '–', '12.631', '10.251', '2.800', '420', 'R$ 51.870', 'R$ 96.280', '–', '–'],
      ['Outros', 'R$ 950', '1.420', '862', '48', '30', 'R$ 5.640', 'R$ 7.110', 'R$ 31,67', '7,48x'],
      [
        'Total',
        'R$ 33.840',
        '70.386',
        '32.254',
        '6.368',
        '995',
        'R$ 137.780',
        'R$ 226.190',
        'R$ 33,97',
        '6,68x',
      ],
    ]);
  });

  const soma = (
    campo:
      'investimento' | 'cliques' | 'visitas' | 'cadastros' | 'ftdsQtd' | 'ftdsValor' | 'depositos',
  ) => tabela.linhas.reduce((acc, l) => acc + (l[campo] ?? 0), 0);

  it('Total = soma das colunas onde a imagem é consistente', () => {
    expect(soma('investimento')).toBe(canal('total').investimento);
    expect(soma('visitas')).toBe(canal('total').visitas);
    expect(soma('cadastros')).toBe(canal('total').cadastros);
    expect(soma('ftdsQtd')).toBe(canal('total').ftdsQtd);
    expect(soma('depositos')).toBe(canal('total').depositos);
  });

  it('Total inconsistente na imagem: Cliques e FTDs Valor (vale o valor impresso)', () => {
    // Cliques: 19.823 + 15.630 + 10.512 + 12.631 + 1.420 = 60.016, mas a imagem mostra 70.386.
    expect(soma('cliques')).toBe(60016);
    expect(canal('total').cliques).toBe(70386);
    // FTDs Valor: 37.690 + 29.420 + 12.580 + 51.870 + 5.640 = 137.200, mas a imagem mostra 137.780.
    expect(soma('ftdsValor')).toBe(137200);
    expect(canal('total').ftdsValor).toBe(137780);
  });

  it.each(['meta', 'email', 'sms', 'outros'] as const)(
    'CPA = investimento / FTDs e ROAS = depósitos / investimento (%s, tolerância 0,01)',
    (id) => {
      const l = canal(id);
      if (l.investimento === null || l.cpa === null || l.roas === null) throw new Error('nulo');
      expect(Math.abs(l.cpa - l.investimento / l.ftdsQtd)).toBeLessThanOrEqual(0.01);
      // Email: 45.800 / 10.890 = 4,2057 (arredondaria a 4,21); a imagem mostra 4,20 — dentro da tolerância.
      expect(Math.abs(l.roas - l.depositos / l.investimento)).toBeLessThanOrEqual(0.01);
    },
  );

  it('Total: ROAS consistente; CPA inconsistente na imagem (vale 33,97 impresso)', () => {
    const t = canal('total');
    if (t.investimento === null || t.cpa === null || t.roas === null) throw new Error('nulo');
    expect(Math.abs(t.roas - t.depositos / t.investimento)).toBeLessThanOrEqual(0.01);
    // 33.840 / 995 = 34,01; a imagem (KPI e tabela) mostra 33,97.
    expect(t.investimento / t.ftdsQtd).toBeCloseTo(34.01, 2);
    expect(t.cpa).toBe(33.97);
  });

  it('canal sem gasto tem CPA e ROAS nulos', () => {
    const a = canal('afiliados');
    expect([a.investimento, a.cpa, a.roas]).toEqual([null, null, null]);
  });
});

describe('referencia.json sincronizado com referencia.ts', () => {
  it('deep equal', () => {
    const json: unknown = JSON.parse(
      readFileSync(new URL('../referencia.json', import.meta.url), 'utf-8'),
    );
    expect(json).toEqual(referencia);
  });
});

describe('index', () => {
  it('reexporta referência e formatadores', () => {
    expect(indice.referencia).toBe(referencia);
    expect(typeof indice.formatarMoeda).toBe('function');
    expect(indice.REFERENCIA_VERSAO).toBe('2026-10-15');
  });
});
