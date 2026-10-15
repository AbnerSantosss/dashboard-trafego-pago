/**
 * Tipos dos dados de referência (imagem tests/visual/ref-1.png).
 * Fonte humana: wiki/design-system/dados-de-referencia.md
 */

export type Direcao = 'alta' | 'baixa';

export type KpiId = 'investimento' | 'ftds' | 'cpa' | 'depositos' | 'roas';

export interface Kpi {
  id: KpiId;
  rotulo: string;
  valor: number;
  valorFormatado: string;
  /** Variação percentual contra o período de comparação (ex.: 12.5 = +12,5%). */
  variacaoPct: number;
  /** Texto exibido ao lado da seta (a seta é um ícone separado). */
  variacaoFormatada: string;
  direcao: Direcao;
  /** Cor do tile do ícone (hex). */
  cor: string;
}

export type EtapaFunilId = 'base' | 'cliques' | 'visitas' | 'cadastro' | 'ftd';

export interface EtapaFunil {
  id: EtapaFunilId;
  rotulo: string;
  valor: number;
  valorFormatado: string;
  /** Taxa sobre a etapa anterior (a primeira é 100). */
  taxaPct: number;
  taxaFormatada: string;
}

export type CanalId = 'meta' | 'email' | 'sms' | 'afiliados' | 'outros' | 'total';

/** Strings exibidas em cada célula, já formatadas. */
export interface LinhaCanalFormatada {
  investimento: string;
  cliques: string;
  visitas: string;
  cadastros: string;
  ftdsQtd: string;
  ftdsValor: string;
  depositos: string;
  cpa: string;
  roas: string;
}

export interface LinhaCanal {
  id: CanalId;
  canal: string;
  /** `null` = canal sem gasto (exibe "–"). */
  investimento: number | null;
  cliques: number;
  visitas: number;
  cadastros: number;
  ftdsQtd: number;
  ftdsValor: number;
  depositos: number;
  cpa: number | null;
  roas: number | null;
  formatado: LinhaCanalFormatada;
}

export type ColunaId =
  | 'canal'
  | 'investimento'
  | 'cliques'
  | 'visitas'
  | 'cadastros'
  | 'ftds'
  | 'ftdsQtd'
  | 'ftdsValor'
  | 'depositos'
  | 'cpa'
  | 'roas';

export interface CabecalhoColuna {
  id: ColunaId;
  /** Linhas do rótulo como quebradas na imagem. */
  rotulo: string[];
  /** Ícone de ordenação (Investimento). */
  ordenavel?: boolean;
  /** Ícone "i" de informação (CPA e ROAS). */
  info?: boolean;
  /** Segundo nível do cabeçalho (FTDs → Qtd. / Valor (R$)). */
  subcolunas?: CabecalhoColuna[];
}

export interface Filtro {
  id: 'periodo' | 'comparar' | 'canal' | 'campanha';
  rotulo: string;
  valor: string;
}

export interface ItemMenu {
  id: 'visao-geral' | 'gestao-custos' | 'relatorios' | 'ajuda';
  rotulo: string;
  ativo: boolean;
  posicao: 'topo' | 'rodape';
}

export interface Referencia {
  empresa: string;
  titulo: string;
  subtitulo: string;
  atualizadoEm: { rotulo: string; valor: string };
  botoes: { exportar: string; limparFiltros: string };
  filtros: Filtro[];
  menu: ItemMenu[];
  kpis: Kpi[];
  /** Texto abaixo de cada variação de KPI. */
  legendaVariacao: string;
  funil: {
    titulo: string;
    /** Legenda sob o 100% da primeira etapa. */
    legendaBase: string;
    /** Legenda sob a taxa das demais etapas. */
    legendaConversao: string;
    etapas: EtapaFunil[];
  };
  tabela: {
    titulo: string;
    cabecalhos: CabecalhoColuna[];
    linhas: LinhaCanal[];
    total: LinhaCanal;
  };
}
