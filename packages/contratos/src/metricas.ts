/**
 * Contrato da API de métricas (Fase 4, P4.6/P4.8).
 * Rota: GET /metricas/visao-geral  (Bearer JWT + cabeçalho x-tenant)
 * Query: de=AAAA-MM-DD&ate=AAAA-MM-DD (inclusivos, no fuso da empresa)
 *        &comparar=anterior|nenhum (padrão anterior: período imediatamente anterior, mesma duração)
 *        &canal=<nome do canal>|todos (padrão todos)
 *        &campanha=<nome>|todas (padrão todas)
 * Canais que começam com `__` nunca aparecem em `canais`, `kpis` nem `opcoes` (D11); só alimentam `funil`.
 * Números são `number` crus (reais em BRL para dinheiro); a formatação é do web (@trafego/fixtures/formatacao).
 * `null` = indefinido (ex.: CPA sem FTD, ROAS sem investimento). Nunca 0 no lugar de null.
 */

export type KpiId = 'investimento' | 'ftds' | 'cpa' | 'depositos' | 'roas';
export type EtapaFunilId = 'base' | 'cliques' | 'visitas' | 'cadastro' | 'ftd' | 'redeposito';

export interface Periodo {
  /** AAAA-MM-DD */
  de: string;
  /** AAAA-MM-DD, inclusivo */
  ate: string;
}

export interface KpiMetrica {
  id: KpiId;
  valor: number | null;
  /** Valor no período de comparação; null sem comparação ou indefinido. */
  valorAnterior: number | null;
  /** (valor - anterior) / anterior * 100; null se não calculável. */
  variacaoPct: number | null;
  /** Um ponto por dia do período (ordem cronológica); vazio se não houver dados. */
  sparkline: number[];
}

export interface EtapaFunilMetrica {
  id: EtapaFunilId;
  valor: number;
  /** Taxa sobre a etapa anterior em %; a primeira é 100; null se a anterior for 0. */
  taxaPct: number | null;
}

export interface LinhaCanalMetrica {
  /** Nome do canal como gravado em metrics_daily.channel (ex.: "Meta"). */
  canal: string;
  /** Cor hex vinda de presentation.channels; null se não configurada. */
  cor: string | null;
  investimento: number | null;
  cliques: number;
  visitas: number;
  cadastros: number;
  ftdsQtd: number;
  ftdsValor: number;
  depositos: number;
  cpa: number | null;
  roas: number | null;
}

export interface CanalApresentacao {
  canal: string;
  cor: string;
  ordem: number;
}

export interface Apresentacao {
  nomeExibicao: string;
  logoUrl: string | null;
  subtitulo: string | null;
  /** Ids de KPI visíveis, na ordem; vazio = todos na ordem padrão. */
  kpis: KpiId[];
  /** Ids de coluna visíveis, na ordem; vazio = todas. */
  columns: string[];
  channels: CanalApresentacao[];
  palette: Record<string, string>;
  currency: string;
  timezone: string;
}

export interface VisaoGeralResposta {
  periodo: Periodo;
  comparacao: Periodo | null;
  /** Instante ISO do último webhook processado da empresa; null se nunca houve. */
  atualizadoEm: string | null;
  apresentacao: Apresentacao;
  kpis: KpiMetrica[];
  /**
   * Base → Cliques → Visitas → Cadastro → FTD e, se a empresa já teve depósito depois do FTD,
   * Redepósito (quantidade de eventos `deposito`; taxa sobre FTD, pode passar de 100%).
   */
  funil: EtapaFunilMetrica[];
  canais: LinhaCanalMetrica[];
  /** Soma dos canais visíveis; cpa/roas recalculados sobre as somas. */
  total: LinhaCanalMetrica;
  opcoes: {
    canais: string[];
    campanhas: string[];
  };
}

export interface VisaoGeralQuery {
  de?: string;
  ate?: string;
  comparar?: 'anterior' | 'nenhum';
  canal?: string;
  campanha?: string;
}
