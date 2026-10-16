/**
 * Senhas (Argon2id) e tokens de uso único (convite e redefinição de senha).
 * Nada aqui loga ou devolve senha ou token em claro além do próprio retorno da função.
 */
import * as cripto from 'node:crypto';
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export const SENHA_MINIMA = 8;

/**
 * Argon2id (RFC 9106, recomendação nº 1 da OWASP) nativo do Node ≥ 24.7, com os parâmetros mínimos
 * da OWASP: 19 MiB de memória, 2 passadas, paralelismo 1. Para subir o custo, troque aqui: hashes
 * antigos guardam os próprios parâmetros e são refeitos no próximo login (`precisaRefazerHash`).
 */
const ARGON = { memory: 19456, passes: 2, parallelism: 1 } as const;
const TAMANHO = 32;

type Argon2 = (
  algoritmo: 'argon2id',
  parametros: {
    message: string;
    nonce: Buffer;
    parallelism: number;
    tagLength: number;
    memory: number;
    passes: number;
  },
  callback: (erro: Error | null, chave: Buffer) => void,
) => void;
// @types/node 22 ainda não tipa `crypto.argon2` (existe em runtime desde o Node 24.7).
const argon2 = (cripto as unknown as { argon2: Argon2 }).argon2;

function derivarArgon(
  senha: string,
  sal: Buffer,
  p: { memory: number; passes: number; parallelism: number },
  tamanho = TAMANHO,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2('argon2id', { message: senha, nonce: sal, tagLength: tamanho, ...p }, (erro, chave) =>
      erro ? reject(erro) : resolve(chave),
    );
  });
}

/** scrypt legado (`s1$<sal>$<hash>`): só conferido, nunca gerado; vira Argon2id no próximo login. */
function derivarScrypt(senha: string, sal: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, sal, TAMANHO, { N: 16384, r: 8, p: 1 }, (erro, chave) =>
      erro ? reject(erro) : resolve(chave),
    );
  });
}

const b64 = (b: Buffer) => b.toString('base64').replace(/=+$/, '');

/** Formato PHC: `$argon2id$v=19$m=19456,t=2,p=1$<sal>$<hash>` (base64 sem padding). */
export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await derivarArgon(senha, sal, ARGON);
  const { memory: m, passes: t, parallelism: p } = ARGON;
  return `$argon2id$v=19$m=${m},t=${t},p=${p}$${b64(sal)}$${b64(hash)}`;
}

function lerArgon(armazenado: string) {
  const c = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(
    armazenado,
  );
  if (!c) return null;
  const [m, t, p] = [Number(c[1]), Number(c[2]), Number(c[3])];
  // Limites contra hash adulterado no banco pedindo memória absurda.
  if (m < 8 || m > 1_048_576 || t < 1 || t > 10 || p < 1 || p > 16) return null;
  return {
    parametros: { memory: m, passes: t, parallelism: p },
    sal: Buffer.from(c[4]!, 'base64'),
    hash: Buffer.from(c[5]!, 'base64'),
  };
}

export async function conferirSenha(senha: string, armazenado: string | null): Promise<boolean> {
  const argon = armazenado ? lerArgon(armazenado) : null;
  if (argon) {
    const obtido = await derivarArgon(senha, argon.sal, argon.parametros, argon.hash.length);
    return obtido.length === argon.hash.length && timingSafeEqual(obtido, argon.hash);
  }
  const partes = armazenado?.split('$');
  if (partes?.length === 3 && partes[0] === 's1') {
    const esperado = Buffer.from(partes[2]!, 'base64url');
    const obtido = await derivarScrypt(senha, Buffer.from(partes[1]!, 'base64url'));
    return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
  }
  // Mesmo custo de uma conferência real, para não revelar se o usuário existe ou tem senha.
  await derivarArgon(senha, randomBytes(16), ARGON);
  return false;
}

/** O hash é legado (scrypt) ou tem parâmetros abaixo dos atuais: refazer após um login certo. */
export function precisaRefazerHash(armazenado: string | null): boolean {
  if (!armazenado) return false;
  const argon = lerArgon(armazenado);
  if (!argon) return true;
  const p = argon.parametros;
  return p.memory < ARGON.memory || p.passes < ARGON.passes;
}

export const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex');

/** Token aleatório de convite: `<tenantId>.<aleatório>` (o tenant permite abrir a transação sob RLS). */
export function gerarTokenConvite(tenantId: string): string {
  return `${tenantId}.${randomBytes(24).toString('base64url')}`;
}

export function tenantDoTokenConvite(token: string): string | null {
  const [tenant] = token.split('.');
  return tenant && /^[0-9a-f-]{36}$/i.test(tenant) ? tenant : null;
}

/**
 * Token de redefinição sem tabela: HMAC de `{u, v, exp}` com uma chave derivada de AUTH_SECRET.
 * `v` é um resumo do hash de senha atual, então o link deixa de valer assim que a senha muda.
 */
export function criarTokenRedefinicao(
  segredo: string,
  dados: { userId: string; senhaHash: string | null },
  validadeMs = 60 * 60 * 1000,
): string {
  const corpo = Buffer.from(
    JSON.stringify({
      u: dados.userId,
      v: sha256(dados.senhaHash ?? 'sem-senha').slice(0, 16),
      exp: Date.now() + validadeMs,
    }),
  ).toString('base64url');
  return `${corpo}.${assinar(segredo, corpo)}`;
}

export function lerTokenRedefinicao(
  segredo: string,
  token: string,
): { userId: string; versao: string } | null {
  const [corpo, assinatura] = token.split('.');
  if (!corpo || !assinatura) return null;
  const esperada = Buffer.from(assinar(segredo, corpo));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
  try {
    const d = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as {
      u?: string;
      v?: string;
      exp?: number;
    };
    if (!d.u || !d.v || typeof d.exp !== 'number' || d.exp < Date.now()) return null;
    return { userId: d.u, versao: d.v };
  } catch {
    return null;
  }
}

export const versaoSenha = (senhaHash: string | null) =>
  sha256(senhaHash ?? 'sem-senha').slice(0, 16);

function assinar(segredo: string, corpo: string): string {
  return createHmac('sha256', `redefinir-senha:${segredo}`).update(corpo).digest('base64url');
}
