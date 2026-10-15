/**
 * Assinatura HMAC dos webhooks: `X-Signature` = HMAC-SHA256 hex de `timestamp + "." + corpoBruto`,
 * com o segredo da fonte. Mesma função de `@trafego/webhook-sim` (duplicada de propósito para não
 * criar dependência cruzada entre o app e o simulador).
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

/** Chave de idempotência: `X-Event-Id` ou SHA-256 hex do corpo bruto. */
export function chaveEvento(eventId: string | undefined, corpo: string): string {
  const id = eventId?.trim();
  if (id) return id;
  return 'sha256:' + createHash('sha256').update(corpo, 'utf8').digest('hex');
}
