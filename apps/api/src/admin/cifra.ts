/**
 * Cifra simétrica dos segredos de webhook (`sources.secret_enc`), AES-256-GCM.
 * Formato gravado: `v1$<iv b64url>$<tag b64url>$<texto cifrado b64url>`.
 * A chave (32 bytes) vem de `WEBHOOK_CHAVE_CIFRA`; fora de produção, sem a variável, é derivada
 * de `sha256(AUTH_SECRET)`. Nenhum valor de chave ou segredo é logado.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSAO = 'v1';

/** Interpreta a chave em base64/base64url ou hex; `null` se não tiver 32 bytes. */
export function lerChaveCifra(valor: string): Buffer | null {
  const v = valor.trim();
  if (/^[0-9a-fA-F]{64}$/.test(v)) return Buffer.from(v, 'hex');
  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(v)) {
    const b = Buffer.from(v.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (b.length === 32) return b;
  }
  return null;
}

/** Chave derivada do AUTH_SECRET (só fora de produção). */
export function derivarChaveDeAuthSecret(authSecret: string): Buffer {
  return createHash('sha256').update(authSecret, 'utf8').digest();
}

export function cifrar(texto: string, chave: Buffer): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chave, iv);
  const ct = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
  const tag = cifra.getAuthTag();
  return [VERSAO, iv, tag, ct]
    .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
    .join('$');
}

/** Decifra; `null` se o formato for desconhecido, a chave errada ou o conteúdo adulterado. */
export function decifrar(enc: string, chave: Buffer): string | null {
  const partes = enc.split('$');
  if (partes.length !== 4 || partes[0] !== VERSAO) return null;
  try {
    const [iv, tag, ct] = partes.slice(1).map((p) => Buffer.from(p, 'base64url'));
    const decifra = createDecipheriv('aes-256-gcm', chave, iv!);
    decifra.setAuthTag(tag!);
    return Buffer.concat([decifra.update(ct!), decifra.final()]).toString('utf8');
  } catch {
    return null;
  }
}
