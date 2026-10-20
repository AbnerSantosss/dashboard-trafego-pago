/**
 * Preset de regras da GTech (Globaltech), plataforma de cassino que envia um webhook por evento.
 * Vale o formato observado nos webhooks reais; a documentação pública antiga é aceita como
 * sinônimo (chave `evento`, `DEPÓSITO_CRIADO`, `PAGAMENTO_DEPÓSITO`, status `PAGO`).
 *
 * | Webhook                                        | Evento canônico        |
 * |------------------------------------------------|------------------------|
 * | `USER_CREATED`                                 | `cadastro`             |
 * | `DEPOSIT_PAYMENT` pago, `approved_deposits` 1  | `ftd`                  |
 * | `DEPOSIT_PAYMENT` pago, outro/sem contador     | `deposito`             |
 * | `DEPOSIT_CREATED` (pendente)                   | nenhum (`ignorar`)     |
 *
 * O primeiro depósito gera só `ftd`, não `ftd` + `deposito`: a agregação já soma o valor dos FTDs
 * em "Depósitos" (`agregarEventos` e `apps/api/src/rules/agregar.ts`); os dois juntos contariam o
 * mesmo dinheiro duas vezes. `DEPOSIT_CREATED` é só a intenção (PIX gerado, status `PENDENT`): não
 * é dinheiro e o pagamento traz de novo o mesmo `deposit_id`, valor, lead e UTMs.
 *
 * `amount` já vem em reais (número ou texto "0.10"): sem `divide`. Nunca mapeia `user_token`,
 * `qrcode`, `user_document`, `document`, `user_birth_date`, nome, e-mail ou telefone.
 */
import type { CondicaoMatch, ConjuntoDeRegras, MapeamentoCampo, Match, Regra } from '../tipos.js';

/** Nome com e sem acento, em NFC e NFD (o "Ó" pode chegar decomposto). */
function variantes(...nomes: string[]): string[] {
  const todas = nomes.flatMap((n) => [
    n.normalize('NFC'),
    n.normalize('NFD'),
    n.normalize('NFD').replace(/\p{M}/gu, ''),
  ]);
  return [...new Set(todas)];
}

export const EVENTOS_GTECH = {
  cadastro: ['USER_CREATED'],
  depositoCriado: variantes('DEPOSIT_CREATED', 'DEPÓSITO_CRIADO'),
  depositoPago: variantes('DEPOSIT_PAYMENT', 'PAGAMENTO_DEPÓSITO'),
  statusPago: ['PAID', 'PAGO'],
  /** `approved_deposits` do primeiro depósito pago (número ou texto). */
  primeiroDeposito: [1, '1'],
};

/** Tipo do webhook: `event` (formato atual) ou `evento` (documentação antiga). */
const TIPO = { path: '$.event', coalesce: ['$.evento'] };

const PAGO: CondicaoMatch[] = [
  { ...TIPO, in: EVENTOS_GTECH.depositoPago },
  { path: '$.status', in: EVENTOS_GTECH.statusPago },
];

/** Lead, UTMs e afiliado (`affiliate_id` vai para `extras` e alimenta o canal Afiliados). */
const ATRIBUICAO: Record<string, MapeamentoCampo> = {
  lead_key: { path: '$.user_id', trim: true },
  utm_source: { path: '$.tracker.utm_source', trim: true, lower: true },
  utm_medium: { path: '$.tracker.utm_medium', trim: true, lower: true },
  utm_campaign: { path: '$.tracker.utm_campaign', trim: true },
  campaign: { path: '$.tracker.utm_campaign', trim: true },
  affiliate_id: { path: '$.tracker.afp', trim: true },
};

const CAMPOS_PAGAMENTO: Record<string, MapeamentoCampo> = {
  // Instante em que o dinheiro entrou; a documentação antiga às vezes só traz `created_at`.
  occurred_at: { path: '$.paid_at', coalesce: ['$.created_at'], format: 'iso' },
  value: { path: '$.amount' },
  // Sem `currency` no payload, vale a moeda padrão da empresa.
  currency: { path: '$.currency', trim: true, map: { R$: 'BRL' } },
  ...ATRIBUICAO,
};

export const REGRAS_GTECH: Regra[] = [
  {
    match: { ...TIPO, in: EVENTOS_GTECH.cadastro },
    type: 'cadastro',
    fields: { occurred_at: { path: '$.created_at', format: 'iso' }, ...ATRIBUICAO },
  },
  {
    match: [...PAGO, { path: '$.approved_deposits', in: EVENTOS_GTECH.primeiroDeposito }],
    type: 'ftd',
    fields: CAMPOS_PAGAMENTO,
  },
  {
    // Redepósito, ou payload sem o contador (documentação antiga): depósito comum.
    match: [...PAGO, { path: '$.approved_deposits', not_in: EVENTOS_GTECH.primeiroDeposito }],
    type: 'deposito',
    fields: CAMPOS_PAGAMENTO,
  },
];

export const IGNORAR_GTECH: Match[] = [{ ...TIPO, in: EVENTOS_GTECH.depositoCriado }];

/**
 * Conteúdo de `rules.mapping` da fonte. Sem `version`, `fuso` e `moeda_padrao`: a versão vem da
 * linha de `rules` e o fuso e a moeda, da empresa (`carregarContextoFonte`).
 */
export function mapeamentoGtech(): { regras: Regra[]; ignorar: Match[] } {
  // Cópia via JSON: é o que vai para o jsonb, e ninguém altera as constantes do módulo.
  return JSON.parse(JSON.stringify({ regras: REGRAS_GTECH, ignorar: IGNORAR_GTECH }));
}

/** Conjunto pronto para `aplicarRegras` (testes e simulação). */
export function conjuntoGtech(
  opcoes: { version?: number; fuso?: string; moeda_padrao?: string } = {},
): ConjuntoDeRegras {
  return {
    version: opcoes.version ?? 1,
    fuso: opcoes.fuso ?? 'America/Sao_Paulo',
    moeda_padrao: opcoes.moeda_padrao ?? 'BRL',
    ...mapeamentoGtech(),
  };
}
