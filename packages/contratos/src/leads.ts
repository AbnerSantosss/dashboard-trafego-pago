/**
 * Contrato da lista por etapa do funil e da ficha do lead (clique no funil do painel).
 *
 * Papéis: as duas rotas exigem `analista` ou acima, porque mostram dados de pessoas (id do usuário,
 * UTMs e o corpo do webhook). Lidas sob RLS: só eventos da empresa ativa.
 * Erros seguem `{ erro: { codigo, mensagem, detalhes?, requestId } }`.
 */

/**
 * Etapas com lista por pessoa. As seis primeiras são os ids de `VisaoGeralResposta.funil`
 * (`redeposito` = depósitos pagos depois do FTD); `depositos` (FTD e depósitos seguintes) vem da
 * coluna Depósitos da tabela de canais.
 */
export const ETAPAS_LISTA = [
  'base',
  'cliques',
  'visitas',
  'cadastro',
  'ftd',
  'redeposito',
  'depositos',
] as const;
export type EtapaLista = (typeof ETAPAS_LISTA)[number];

export type TipoEventoLead = 'clique' | 'visita' | 'cadastro' | 'ftd' | 'deposito' | 'gasto';
/** `webhook`: veio de uma fonte; `tag`: da tag do GTM; `manual`: inserido sem bruto. */
export type OrigemEvento = 'webhook' | 'tag' | 'manual';

export interface EventoLead {
  id: string;
  tipo: TipoEventoLead;
  /** ISO 8601 em UTC. */
  ocorridoEm: string;
  /** Em reais; nulo em cliques e visitas. */
  valor: number | null;
  moeda: string | null;
  canal: string;
  campanha: string | null;
  pagina: string | null;
  /** Id do usuário na plataforma (`user_id`); nulo quando o evento não identifica a pessoa. */
  leadKey: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  origem: OrigemEvento;
}

/** `recentes` (padrão), `antigos` ou `valor` (maior primeiro; sem valor no fim). */
export const ORDENS_LISTA = ['recentes', 'antigos', 'valor'] as const;
export type OrdemLista = (typeof ORDENS_LISTA)[number];

/**
 * `GET /empresas/atual/eventos?etapa=ftd&de=&ate=&canal=&campanha=&busca=&ordem=&offset=&limite=`
 * → 200. Sem `de`/`ate`: o mesmo período padrão do painel. `canal=todos` e `campanha=todas` não
 * filtram. `busca` procura no id do usuário e na campanha (contém, sem diferenciar maiúsculas).
 */
export interface EventosEtapaQuery {
  etapa: EtapaLista;
  de?: string;
  ate?: string;
  canal?: string;
  campanha?: string;
  /** Até 100 caracteres. */
  busca?: string;
  ordem?: OrdemLista;
  /** Quantos pular (paginação); 0 a 100000, padrão 0. */
  offset?: number;
  /** 1 a 500; padrão 200. */
  limite?: number;
}

export interface EventosEtapaResposta {
  etapa: EtapaLista;
  periodo: { de: string; ate: string };
  /** Fuso da empresa (IANA), para mostrar as datas como no painel. */
  fuso: string;
  /** Quantos eventos existem no filtro (a lista traz no máximo `limite`). */
  total: number;
  /** Soma de `valor` no filtro; nulo quando a etapa não tem valor. */
  valorTotal: number | null;
  /** Mais recentes primeiro. */
  eventos: EventoLead[];
  /** Total por canal, do maior para o menor. */
  porCanal: Array<{ canal: string; total: number }>;
  /** Canais e campanhas da etapa no período, sem os filtros de canal, campanha e busca. */
  opcoes: { canais: string[]; campanhas: string[] };
}

/** Toque da tag de atribuição (página vista ou clique) ligado ao lead. */
export interface ToqueLead {
  id: string;
  tipo: string;
  recebidoEm: string;
  url: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  /** Só os ids de clique preenchidos (gclid, fbclid, fbp, ttclid...). */
  clickIds: Record<string, string>;
}

/** Corpo bruto do webhook que gerou eventos do lead. Campos de senha, token e cartão vêm mascarados. */
export interface WebhookLead {
  id: string;
  fonte: string;
  eventKey: string;
  recebidoEm: string;
  status: 'recebido' | 'processado' | 'erro';
  payload: unknown;
}

/** `GET /empresas/atual/leads/:leadKey` → 200. 404 `lead_nao_encontrado` sem eventos nem toques. */
export interface FichaLead {
  leadKey: string;
  /** Canal do primeiro evento (de onde a pessoa veio). */
  canalOrigem: string | null;
  primeiroEvento: string | null;
  ultimoEvento: string | null;
  cadastroEm: string | null;
  ftd: { em: string; valor: number } | null;
  depositos: { quantidade: number; total: number };
  /** Mais recentes primeiro; até 500. */
  eventos: EventoLead[];
  /** Mais recentes primeiro; até 100. */
  toques: ToqueLead[];
  /** Mais recentes primeiro; até 50. */
  webhooks: WebhookLead[];
}
