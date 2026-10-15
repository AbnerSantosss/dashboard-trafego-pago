/**
 * Simulador de webhooks: assina e envia payloads para `POST /webhooks/:empresa/:fonte`.
 * Contrato em `apps/api/docs/webhooks.md`.
 */
import { createHmac, randomUUID } from 'node:crypto';

/** HMAC-SHA256 hex de `timestamp + "." + corpo` (o mesmo que a API verifica). */
export function assinar(segredo: string, timestamp: string | number, corpo: string): string {
  return createHmac('sha256', segredo).update(`${timestamp}.${corpo}`, 'utf8').digest('hex');
}

export const CANAIS = ['Afiliados', 'Meta', 'Email', 'SMS', 'Outros'] as const;
export type Canal = (typeof CANAIS)[number];

/** Tipo canônico → valor de `$.event` no payload sintético. */
export const EVENTOS = {
  gasto: 'ad_spend',
  clique: 'click',
  visita: 'page_view',
  cadastro: 'signup',
  ftd: 'first_deposit',
  deposito: 'deposit',
} as const;
export type TipoEvento = keyof typeof EVENTOS;
export const TIPOS = Object.keys(EVENTOS) as TipoEvento[];

export interface PayloadSintetico {
  event: string;
  created_at: string;
  amount?: number;
  user: { id: string };
  utm: { source?: string; medium?: string; campaign?: string };
  landing_page: string;
  affiliate_id?: string;
  referrer?: string;
}

/** PRNG determinístico (mulberry32) para lotes reproduzíveis. */
function prng(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Atributos de origem que o classificador de canal da wiki atribui a cada canal. */
function origem(
  canal: Canal,
  i: number,
): Pick<PayloadSintetico, 'utm' | 'affiliate_id' | 'referrer'> {
  switch (canal) {
    case 'Afiliados':
      return {
        utm: { medium: 'affiliate', campaign: 'parceiros' },
        affiliate_id: `af-${(i % 7) + 1}`,
      };
    case 'Meta':
      return {
        utm: {
          source: i % 2 ? 'Instagram' : 'facebook',
          medium: 'cpc',
          campaign: 'meta-conversao',
        },
        referrer: 'https://facebook.com/',
      };
    case 'Email':
      return { utm: { source: 'newsletter', medium: 'email', campaign: 'email-semanal' } };
    case 'SMS':
      return { utm: { source: 'zenvia', medium: 'sms', campaign: 'sms-reativacao' } };
    case 'Outros':
      return { utm: { source: 'google', medium: 'organic' } };
  }
}

/** Valor em centavos por tipo (gasto, ftd e depósito têm valor; os demais não). */
function valor(tipo: TipoEvento, r: () => number): number | undefined {
  if (tipo === 'gasto') return Math.round(5_000 + r() * 95_000);
  if (tipo === 'ftd') return Math.round(2_000 + r() * 48_000);
  if (tipo === 'deposito') return Math.round(1_000 + r() * 99_000);
  return undefined;
}

export interface OpcoesGerar {
  /** Quantidade de payloads (padrão 30 = 5 canais × 6 tipos). */
  quantidade?: number;
  semente?: number;
  /** Data base (ISO); os eventos ficam espalhados nas 24 h anteriores. */
  ate?: Date;
}

/**
 * Gera payloads cobrindo os 5 canais e os 6 tipos: o i-ésimo payload usa o canal `i % 5` e o
 * tipo `floor(i / 5) % 6`, então qualquer lote de 30 ou mais cobre todas as combinações.
 */
export function gerarPayloads(opcoes: OpcoesGerar = {}): PayloadSintetico[] {
  const n = opcoes.quantidade ?? 30;
  const r = prng(opcoes.semente ?? 42);
  const fim = (opcoes.ate ?? new Date()).getTime();
  const lista: PayloadSintetico[] = [];
  for (let i = 0; i < n; i++) {
    const canal = CANAIS[i % CANAIS.length]!;
    const tipo = TIPOS[Math.floor(i / CANAIS.length) % TIPOS.length]!;
    const amount = valor(tipo, r);
    lista.push({
      event: EVENTOS[tipo],
      created_at: new Date(fim - Math.floor(r() * 86_400_000)).toISOString(),
      ...(amount === undefined ? {} : { amount }),
      user: { id: `lead-${Math.floor(r() * 1e6).toString(36)}` },
      landing_page: ['/cadastro', '/promo', '/bonus', '/'][i % 4]!,
      ...origem(canal, i),
    });
  }
  return lista;
}

export type ModoInvalido = 'assinatura' | 'timestamp' | 'duplicado';

export interface Envio {
  url: string;
  headers: Record<string, string>;
  corpo: string;
}

/** Monta URL, cabeçalhos assinados e corpo bruto de um envio. */
export function montarEnvio(o: {
  url: string;
  empresa: string;
  fonte: string;
  segredo: string;
  payload: unknown;
  eventId?: string;
  agora?: number;
  invalido?: ModoInvalido;
}): Envio {
  const corpo = JSON.stringify(o.payload);
  const segundos = Math.floor((o.agora ?? Date.now()) / 1000);
  const ts = String(o.invalido === 'timestamp' ? segundos - 3600 : segundos);
  const segredo = o.invalido === 'assinatura' ? `${o.segredo}-errado` : o.segredo;
  return {
    url: `${o.url.replace(/\/+$/, '')}/webhooks/${encodeURIComponent(o.empresa)}/${encodeURIComponent(o.fonte)}`,
    headers: {
      'content-type': 'application/json',
      'x-timestamp': ts,
      'x-signature': assinar(segredo, ts, corpo),
      'x-event-id': o.eventId ?? `sim-${randomUUID()}`,
    },
    corpo,
  };
}

export interface ResultadoEnvio {
  status: number;
  corpo: string;
}

export async function enviar(e: Envio, f: typeof fetch = fetch): Promise<ResultadoEnvio> {
  const res = await f(e.url, { method: 'POST', headers: e.headers, body: e.corpo });
  return { status: res.status, corpo: await res.text() };
}
