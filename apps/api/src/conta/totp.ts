/**
 * Verificação em duas etapas por app autenticador (TOTP, RFC 6238): HMAC-SHA1, passo de 30 s,
 * 6 dígitos, o formato que Google Authenticator, Microsoft Authenticator e 1Password leem.
 * O segredo fica cifrado em `users.totp_segredo_enc` (mesma chave dos segredos de webhook) e o
 * último passo aceito em `users.totp_ultimo_passo`, para o mesmo código não valer duas vezes.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const PASSO_SEGUNDOS = 30;
const DIGITOS = 6;
/** Aceita o passo anterior e o seguinte: tolera 30 s de relógio torto no celular. */
const JANELA = 1;

export function base32(bytes: Buffer): string {
  let bits = 0;
  let valor = 0;
  let saida = '';
  for (const b of bytes) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      saida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31];
  return saida;
}

export function deBase32(texto: string): Buffer {
  const limpo = texto.toUpperCase().replace(/[\s=]/g, '');
  let bits = 0;
  let valor = 0;
  const saida: number[] = [];
  for (const c of limpo) {
    const i = ALFABETO.indexOf(c);
    if (i < 0) throw new Error('base32 inválido');
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      saida.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(saida);
}

/** Segredo novo de 160 bits, em base32. */
export function gerarSegredoTotp(): string {
  return base32(randomBytes(20));
}

export function passoAtual(agoraMs = Date.now()): number {
  return Math.floor(agoraMs / 1000 / PASSO_SEGUNDOS);
}

export function codigoTotp(segredo: string, passo: number): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(passo));
  const h = createHmac('sha1', deBase32(segredo)).update(contador).digest();
  const deslocamento = h[h.length - 1]! & 0xf;
  const numero = (h.readUInt32BE(deslocamento) & 0x7fffffff) % 10 ** DIGITOS;
  return String(numero).padStart(DIGITOS, '0');
}

/**
 * Confere o código e devolve o passo que bateu, ou null. Passos até `ultimoPasso` (inclusive)
 * não valem mais: o código usado num login não serve para outro.
 */
export function conferirTotp(
  segredo: string,
  codigo: string,
  opcoes: { agoraMs?: number; ultimoPasso?: number | null } = {},
): number | null {
  const digitos = codigo.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(digitos)) return null;
  const atual = passoAtual(opcoes.agoraMs);
  for (let d = -JANELA; d <= JANELA; d++) {
    const passo = atual + d;
    if (opcoes.ultimoPasso != null && passo <= opcoes.ultimoPasso) continue;
    if (timingSafeEqual(Buffer.from(codigoTotp(segredo, passo)), Buffer.from(digitos))) {
      return passo;
    }
  }
  return null;
}

/** Conteúdo do QR code (`otpauth://totp/Emissor:email?...`). */
export function uriTotp(segredo: string, email: string, emissor = 'Painel de Tráfego'): string {
  const rotulo = encodeURIComponent(`${emissor}:${email}`);
  const params = new URLSearchParams({
    secret: segredo,
    issuer: emissor,
    algorithm: 'SHA1',
    digits: String(DIGITOS),
    period: String(PASSO_SEGUNDOS),
  });
  return `otpauth://totp/${rotulo}?${params.toString()}`;
}
