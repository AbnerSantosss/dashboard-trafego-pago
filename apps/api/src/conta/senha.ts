/**
 * Senhas (scrypt) e tokens de uso único (convite e redefinição de senha).
 * Nada aqui loga ou devolve senha ou token em claro além do próprio retorno da função.
 */
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 16384;
const TAMANHO = 32;
export const SENHA_MINIMA = 8;

function derivar(senha: string, sal: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, sal, TAMANHO, { N, r: 8, p: 1 }, (erro, chave) =>
      erro ? reject(erro) : resolve(chave),
    );
  });
}

/** Formato `s1$<sal>$<hash>` em base64url. */
export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await derivar(senha, sal);
  return `s1$${sal.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function conferirSenha(senha: string, armazenado: string | null): Promise<boolean> {
  const partes = armazenado?.split('$');
  if (!partes || partes.length !== 3 || partes[0] !== 's1') {
    // Mesmo custo de uma conferência real, para não revelar se o usuário tem senha.
    await derivar(senha, randomBytes(16));
    return false;
  }
  const esperado = Buffer.from(partes[2]!, 'base64url');
  const obtido = await derivar(senha, Buffer.from(partes[1]!, 'base64url'));
  return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
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
