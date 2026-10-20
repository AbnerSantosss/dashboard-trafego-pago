/** Tipos públicos do motor de regras. Fonte humana: wiki/regras-de-tratamento/motor-de-regras.md. */

/** Tipos canônicos de evento. */
export const EVENT_TYPES = ['gasto', 'clique', 'visita', 'cadastro', 'ftd', 'deposito'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const DEFAULT_CHANNELS = ['Meta', 'Email', 'SMS', 'Afiliados', 'Outros'] as const;
export type Channel = (typeof DEFAULT_CHANNELS)[number];

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

/** Erro de regra (dado ruim ou regra mal escrita): não adianta tentar de novo. */
export class ErroDeRegra extends Error {
  override readonly name = 'ErroDeRegra';
}

export const FORMATOS_DATA = ['iso', 'epoch_s', 'epoch_ms', 'dd/mm/yyyy'] as const;
export type FormatoData = (typeof FORMATOS_DATA)[number];

/** Condição de casamento de um bloco. Um array exige que todas casem (E). */
export interface CondicaoMatch {
  path: string;
  /** Caminhos alternativos, tentados em ordem quando `path` vem vazio (ex.: `$.evento`). */
  coalesce?: string[];
  equals?: unknown;
  in?: unknown[];
  /** O valor não pode estar na lista (valor ausente passa). */
  not_in?: unknown[];
  exists?: boolean;
  regex?: string;
}

/** Um `match`: uma condição ou uma lista delas (E). */
export type Match = CondicaoMatch | CondicaoMatch[];

/**
 * Como extrair um campo do payload. Ordem: path/const → coalesce → default → regex → trim →
 * lower → map → multiply/divide → format.
 */
export interface MapeamentoCampo {
  path?: string;
  /** Caminhos alternativos, tentados em ordem quando `path` vem vazio (ex.: `$.created_at`). */
  coalesce?: string[];
  const?: unknown;
  format?: FormatoData;
  divide?: number;
  multiply?: number;
  lower?: boolean;
  trim?: boolean;
  default?: unknown;
  /** Expressão regular; o grupo 1 vira o valor (sem grupo, o casamento inteiro). */
  regex?: string;
  /** Tabela de troca (ex.: `{ "R$": "BRL" }`); valor fora da tabela passa como veio. */
  map?: Record<string, unknown>;
}

/** Um bloco de regra: quando `match` casa, gera um evento do `type` com os `fields`. */
export interface Regra {
  match: Match;
  type: EventType;
  fields: Record<string, MapeamentoCampo>;
}

/** Condições de uma regra de canal: basta uma casar (OU). */
export interface CondicoesCanal {
  utm_medium_in?: string[];
  utm_source_in?: string[];
  referrer_contem?: string[];
  campo_presente?: string[];
}

export interface RegraDeCanal {
  canal: string;
  se: CondicoesCanal;
}

export interface ConjuntoDeRegras {
  version: number;
  regras: Regra[];
  /** Classificador ordenado; ausente = `CANAIS_PADRAO`. */
  canais?: RegraDeCanal[];
  /**
   * Payloads conhecidos que não geram evento canônico (ex.: depósito ainda pendente). Se algum
   * `match` daqui casar, o resultado é vazio e não é erro; os blocos de `regras` nem são testados.
   */
  ignorar?: Match[];
  moeda_padrao: string;
  /** Fuso IANA da empresa (ex.: America/Sao_Paulo). */
  fuso: string;
}

export interface EventoCanonico {
  type: EventType;
  occurred_at: Date;
  value?: number;
  currency: string;
  channel: string;
  campaign?: string;
  page?: string;
  lead_key?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  /** Clique que representa envio para a base (1ª etapa do funil). */
  base?: boolean;
  /** Campos mapeados fora do conjunto canônico (ex.: `affiliate_id`); usados pelo classificador. */
  extras?: Record<string, string>;
}

export interface ResultadoRegras {
  eventos: EventoCanonico[];
  avisos: string[];
}
