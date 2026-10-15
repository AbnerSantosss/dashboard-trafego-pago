/**
 * Dados exatos da imagem de referência (tests/visual/ref-1.png).
 * Números como `number`; strings calculadas pelas funções de formatação e
 * conferidas contra a imagem em referencia.test.ts.
 * Espelho sem build: packages/fixtures/referencia.json (sincronismo testado).
 */
import {
  formatarInteiro,
  formatarMoeda,
  formatarNulo,
  formatarPercentual,
  formatarRoas,
} from './formatacao';
import type { CanalId, EtapaFunil, EtapaFunilId, Kpi, LinhaCanal, Referencia } from './tipos';

export const REFERENCIA_VERSAO = '2026-10-15';

function linha(
  id: CanalId,
  canal: string,
  v: Omit<LinhaCanal, 'id' | 'canal' | 'formatado'>,
): LinhaCanal {
  return {
    id,
    canal,
    ...v,
    formatado: {
      investimento: v.investimento === null ? formatarNulo() : formatarMoeda(v.investimento),
      cliques: formatarInteiro(v.cliques),
      visitas: formatarInteiro(v.visitas),
      cadastros: formatarInteiro(v.cadastros),
      ftdsQtd: formatarInteiro(v.ftdsQtd),
      ftdsValor: formatarMoeda(v.ftdsValor),
      depositos: formatarMoeda(v.depositos),
      cpa: v.cpa === null ? formatarNulo() : formatarMoeda(v.cpa, { centavos: true }),
      roas: v.roas === null ? formatarNulo() : formatarRoas(v.roas),
    },
  };
}

function etapa(id: EtapaFunilId, rotulo: string, valor: number, taxaPct: number): EtapaFunil {
  return {
    id,
    rotulo,
    valor,
    valorFormatado: formatarInteiro(valor),
    taxaPct,
    // A base mostra "100%" sem casa decimal; as demais, uma casa ("12,5%").
    taxaFormatada: formatarPercentual(taxaPct, { casas: id === 'base' ? 0 : 1 }),
  };
}

function kpi(
  id: Kpi['id'],
  rotulo: string,
  valor: number,
  valorFormatado: string,
  variacaoPct: number,
  cor: string,
): Kpi {
  return {
    id,
    rotulo,
    valor,
    valorFormatado,
    variacaoPct,
    // Na imagem a variação vem sem "+" (a seta ▲/▼ indica a direção) e negativos com hífen.
    variacaoFormatada: formatarPercentual(variacaoPct),
    direcao: variacaoPct < 0 ? 'baixa' : 'alta',
    cor,
  };
}

/* Valores da tabela como impressos na imagem. CPA e ROAS por canal são os
 * impressos (2 casas); inconsistências da imagem documentadas em referencia.test.ts. */
const linhas: LinhaCanal[] = [
  linha('meta', 'Meta', {
    investimento: 13260,
    cliques: 19823,
    visitas: 9138,
    cadastros: 1900,
    ftdsQtd: 250,
    ftdsValor: 37690,
    depositos: 58750,
    cpa: 53.04,
    roas: 4.43,
  }),
  linha('email', 'Email', {
    investimento: 10890,
    cliques: 15630,
    visitas: 7082,
    cadastros: 1100,
    ftdsQtd: 210,
    ftdsValor: 29420,
    depositos: 45800,
    cpa: 51.86,
    roas: 4.2,
  }),
  linha('sms', 'SMS', {
    investimento: 8740,
    cliques: 10512,
    visitas: 4921,
    cadastros: 520,
    ftdsQtd: 85,
    ftdsValor: 12580,
    depositos: 18250,
    cpa: 102.82,
    roas: 2.09,
  }),
  linha('afiliados', 'Afiliados', {
    investimento: null,
    cliques: 12631,
    visitas: 10251,
    cadastros: 2800,
    ftdsQtd: 420,
    ftdsValor: 51870,
    depositos: 96280,
    cpa: null,
    roas: null,
  }),
  linha('outros', 'Outros', {
    investimento: 950,
    cliques: 1420,
    visitas: 862,
    cadastros: 48,
    ftdsQtd: 30,
    ftdsValor: 5640,
    depositos: 7110,
    cpa: 31.67,
    roas: 7.48,
  }),
];

const total = linha('total', 'Total', {
  investimento: 33840,
  cliques: 70386,
  visitas: 32254,
  cadastros: 6368,
  ftdsQtd: 995,
  ftdsValor: 137780,
  depositos: 226190,
  cpa: 33.97,
  roas: 6.68,
});

export const referencia: Referencia = {
  empresa: 'PASIO',
  titulo: 'Visão Geral de Aquisição',
  subtitulo: 'Acompanhe os resultados do marketing de forma simples e objetiva.',
  atualizadoEm: { rotulo: 'Dados atualizados em:', valor: '24/05/2024 08:30' },
  botoes: { exportar: 'Exportar', limparFiltros: 'Limpar filtros' },
  filtros: [
    // "Período." com ponto final, exatamente como na imagem.
    { id: 'periodo', rotulo: 'Período.', valor: '01/05/2024 - 24/05/2024' },
    { id: 'comparar', rotulo: 'Comparar com', valor: 'Período anterior' },
    { id: 'canal', rotulo: 'Canal', valor: 'Todos' },
    { id: 'campanha', rotulo: 'Campanha', valor: 'Todas' },
  ],
  menu: [
    { id: 'visao-geral', rotulo: 'Visão Geral', ativo: true, posicao: 'topo' },
    { id: 'gestao-custos', rotulo: 'Gestão de Custos', ativo: false, posicao: 'topo' },
    { id: 'relatorios', rotulo: 'Relatórios', ativo: false, posicao: 'topo' },
    { id: 'ajuda', rotulo: 'Ajuda', ativo: false, posicao: 'rodape' },
  ],
  kpis: [
    kpi('investimento', 'Investimento total', 33840, formatarMoeda(33840), 12.5, '#0070F8'),
    kpi('ftds', 'FTDs', 995, formatarInteiro(995), 18.6, '#0070F8'),
    kpi(
      'cpa',
      'Custo por FTD (CPA)',
      33.97,
      formatarMoeda(33.97, { centavos: true }),
      -5.4,
      '#E13C5D',
    ),
    kpi('depositos', 'Depósitos no período', 226190, formatarMoeda(226190), 22.1, '#24CCB6'),
    kpi('roas', 'ROAS (Depósitos)', 6.68, formatarRoas(6.68), 16.8, '#34DFCE'),
  ],
  legendaVariacao: 'vs. período anterior',
  funil: {
    titulo: 'Funil de Aquisição',
    legendaBase: '(base de referência)',
    legendaConversao: 'de conversão',
    etapas: [
      etapa('base', 'Base contatada', 320840, 100),
      etapa('cliques', 'Cliques', 40000, 12.5),
      etapa('visitas', 'Visitas ao site', 30000, 75),
      etapa('cadastro', 'Cadastro', 6000, 20),
      etapa('ftd', 'FTD', 600, 10),
    ],
  },
  tabela: {
    titulo: 'Desempenho por canal',
    cabecalhos: [
      { id: 'canal', rotulo: ['Canal'] },
      { id: 'investimento', rotulo: ['Investimento'], ordenavel: true },
      { id: 'cliques', rotulo: ['Cliques'] },
      { id: 'visitas', rotulo: ['Visitas'] },
      { id: 'cadastros', rotulo: ['Cadastros'] },
      {
        id: 'ftds',
        rotulo: ['FTDs'],
        subcolunas: [
          { id: 'ftdsQtd', rotulo: ['Qtd.'] },
          { id: 'ftdsValor', rotulo: ['Valor (R$)'] },
        ],
      },
      { id: 'depositos', rotulo: ['Depósitos no', 'período', '(R$)'] },
      { id: 'cpa', rotulo: ['CPA', '(R$)'], info: true },
      { id: 'roas', rotulo: ['ROAS', '(Depósitos)'], info: true },
    ],
    linhas,
    total,
  },
};
