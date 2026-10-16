/**
 * Obtenção do segredo HMAC de uma fonte.
 *
 * HMAC exige o segredo em claro. Desde a P5.2 ele vem primeiro de `sources.secret_enc`
 * (AES-256-GCM, chave de `WEBHOOK_CHAVE_CIFRA`); se a fonte não tiver segredo cifrado, cai para
 * `WEBHOOK_SEGREDOS`, JSON `{ "<empresa>/<fonte>": "<segredo>" }` que nunca é commitado
 * (compatibilidade, D13). O valor do env só é aceito se bater com o `secret_hash` da fonte (o
 * resultado fica em cache por `sourceId|hash`, então uma rotação invalida a entrada sozinha).
 */
import { scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { decifrar } from '../admin/cifra.js';

const scrypt = promisify(scryptCb) as (s: string, sal: Buffer, n: number) => Promise<Buffer>;

export interface FonteResolvida {
  tenantId: string;
  tenantSlug: string;
  sourceId: string;
  fonteSlug: string;
  secretHash: string;
  /** `sources.secret_enc` (cifrado) ou `null` se a fonte ainda não tem segredo no banco. */
  secretEnc: string | null;
}

/** Devolve o segredo em claro da fonte, ou `null` se não houver segredo utilizável. */
export type ObterSegredo = (fonte: FonteResolvida) => Promise<string | null>;

/** Confere um segredo contra o formato `scrypt$<sal hex>$<hash hex>` do seed. */
export async function segredoConfereComHash(segredo: string, hash: string): Promise<boolean> {
  const partes = hash.split('$');
  if (partes.length !== 3 || partes[0] !== 'scrypt') return false;
  const esperado = Buffer.from(partes[2]!, 'hex');
  if (esperado.length === 0) return false;
  const calculado = await scrypt(segredo, Buffer.from(partes[1]!, 'hex'), esperado.length);
  return timingSafeEqual(calculado, esperado);
}

export function lerMapaSegredos(json: string | undefined): Record<string, string> {
  if (!json?.trim()) return {};
  try {
    const obj = JSON.parse(json) as unknown;
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).filter(
        (e): e is [string, string] => typeof e[1] === 'string' && e[1].length > 0,
      ),
    );
  } catch {
    return {};
  }
}

/** `obterSegredo` a partir de um mapa `empresa/fonte → segredo`, validado contra o hash. */
export function obterSegredoDeMapa(mapa: Record<string, string>): ObterSegredo {
  const cache = new Map<string, string | null>();
  return async (fonte) => {
    const segredo = mapa[`${fonte.tenantSlug}/${fonte.fonteSlug}`];
    if (!segredo) return null;
    const chave = `${fonte.sourceId}|${fonte.secretHash}`;
    if (!cache.has(chave)) {
      cache.set(chave, (await segredoConfereComHash(segredo, fonte.secretHash)) ? segredo : null);
    }
    return cache.get(chave) ?? null;
  };
}

/** `obterSegredo` que decifra `sources.secret_enc` com a chave informada. */
export function obterSegredoDoBanco(chave: Buffer): ObterSegredo {
  return async (fonte) => (fonte.secretEnc ? decifrar(fonte.secretEnc, chave) : null);
}

/** Tenta cada fonte de segredo em ordem e devolve o primeiro encontrado. */
export function combinarSegredos(...fontes: ObterSegredo[]): ObterSegredo {
  return async (fonte) => {
    for (const obter of fontes) {
      const segredo = await obter(fonte);
      if (segredo) return segredo;
    }
    return null;
  };
}
