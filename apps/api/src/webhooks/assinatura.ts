/**
 * Autenticação dos webhooks. Dois modos:
 * - HMAC: `X-Signature` = HMAC-SHA256 hex de `timestamp + "." + corpoBruto`, com o segredo da fonte.
 *   Mesma função de `@trafego/webhook-sim` (duplicada de propósito para não criar dependência
 *   cruzada entre o app e o simulador).
 * - Basic: `Authorization: Basic base64(usuario:senha)`, senha = segredo da fonte (plataformas que
 *   só oferecem credencial BASIC, como a GTech). O usuário é livre.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function assinar(segredo: string, timestamp: string | number, corpo: string): string {
  return createHmac('sha256', segredo).update(`${timestamp}.${corpo}`, 'utf8').digest('hex');
}

/** Compara em tempo constante. Assinatura malformada (não hex de 64) é sempre inválida. */
export function assinaturaConfere(
  segredo: string,
  timestamp: string,
  corpo: string,
  recebida: string,
): boolean {
  if (!/^[0-9a-fA-F]{64}$/.test(recebida)) return false;
  const esperada = Buffer.from(assinar(segredo, timestamp, corpo), 'hex');
  return timingSafeEqual(esperada, Buffer.from(recebida, 'hex'));
}

/** `X-Timestamp` em segundos dentro de ±janela do relógio do servidor. */
export function timestampNaJanela(
  timestamp: string,
  janelaSegundos: number,
  agoraMs = Date.now(),
): boolean {
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  return Math.abs(Math.floor(agoraMs / 1000) - Number(timestamp)) <= janelaSegundos;
}

/** Esquema `Basic` no `Authorization` (sem diferenciar maiúsculas), com ou sem credencial. */
export function ehBasic(authorization: string | undefined): authorization is string {
  return authorization !== undefined && /^basic(\s|$)/i.test(authorization);
}

/**
 * Decodifica `Basic base64(usuario:senha)` (RFC 7617). `null` se malformado: base64 inválido,
 * sem `:` ou senha vazia. A senha pode conter `:` (só o primeiro separa o usuário).
 */
export function decodificarBasic(authorization: string): { usuario: string; senha: string } | null {
  const m = /^basic\s+([A-Za-z0-9+/]+={0,2})\s*$/i.exec(authorization);
  if (!m || m[1]!.length % 4 !== 0) return null;
  const texto = Buffer.from(m[1]!, 'base64').toString('utf8');
  const i = texto.indexOf(':');
  if (i < 0 || i === texto.length - 1) return null;
  return { usuario: texto.slice(0, i), senha: texto.slice(i + 1) };
}

/**
 * Senha do Basic contra o segredo da fonte, em tempo constante. Compara os SHA-256 dos dois
 * (mesmo tamanho), então o tempo não revela o comprimento do segredo.
 */
export function senhaConfere(segredo: string, senha: string): boolean {
  const esperada = createHash('sha256').update(segredo, 'utf8').digest();
  const recebida = createHash('sha256').update(senha, 'utf8').digest();
  return timingSafeEqual(esperada, recebida);
}

/** Chave de idempotência: `X-Event-Id` ou SHA-256 hex do corpo bruto. */
export function chaveEvento(eventId: string | undefined, corpo: string): string {
  const id = eventId?.trim();
  if (id) return id;
  return 'sha256:' + createHash('sha256').update(corpo, 'utf8').digest('hex');
}
