/**
 * Cookies da sessão real (só servidor): `sessao` guarda o JWT devolvido pela API e `empresa` o slug
 * da empresa ativa. httpOnly, SameSite=Lax e Secure em produção; o navegador nunca lê o token.
 */
export const COOKIE_SESSAO = 'sessao';
export const COOKIE_EMPRESA = 'empresa';
/**
 * Marca de que este navegador já entrou alguma vez: o login diz "Bem-vindo de volta" em vez de
 * "Faça seu login". Só um "1", sem dado pessoal; sobrevive ao Sair.
 */
export const COOKIE_JA_ENTROU = 'ja_entrou';
/** Validade padrão do JWT emitido pela API (12 h); com "lembrar de mim" ele vale 30 dias. */
export const VALIDADE_SESSAO_S = 12 * 60 * 60;

/** Segundos até o `exp` do JWT (sem conferir a assinatura: só define a vida do cookie). */
export function segundosAteVencer(token: string, agoraMs = Date.now()): number {
  try {
    const corpo = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return typeof corpo.exp === 'number' ? corpo.exp - Math.floor(agoraMs / 1000) : 0;
  } catch {
    return 0;
  }
}

export interface SessaoCookie {
  token?: string;
  empresa?: string;
}

/** Lê os cookies da requisição atual; fora de uma requisição do Next (testes, build) volta vazio. */
export async function lerSessaoDoCookie(): Promise<SessaoCookie> {
  try {
    const { cookies } = await import('next/headers');
    const c = await cookies();
    const token = c.get(COOKIE_SESSAO)?.value;
    const empresa = c.get(COOKIE_EMPRESA)?.value;
    return { ...(token ? { token } : {}), ...(empresa ? { empresa } : {}) };
  } catch {
    return {};
  }
}

/**
 * Grava a sessão (só em server action ou route handler). Token de "lembrar de mim" (vence em mais
 * de 12 h) vira cookie persistente até o vencimento; o normal é cookie de sessão, que some ao
 * fechar o navegador (e o JWT vence em 12 h de todo jeito).
 */
export async function gravarSessao(token: string, empresa: string | undefined): Promise<void> {
  const { cookies } = await import('next/headers');
  const c = await cookies();
  const restante = segundosAteVencer(token);
  const base = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(restante > VALIDADE_SESSAO_S + 60 ? { maxAge: restante } : {}),
  };
  c.set(COOKIE_SESSAO, token, base);
  if (empresa) c.set(COOKIE_EMPRESA, empresa, base);
  else c.delete(COOKIE_EMPRESA);
  c.set(COOKIE_JA_ENTROU, '1', { ...base, maxAge: 400 * 24 * 60 * 60 });
}

/** O navegador já entrou alguma vez (ver `COOKIE_JA_ENTROU`). */
export async function jaEntrouAntes(): Promise<boolean> {
  try {
    const { cookies } = await import('next/headers');
    return (await cookies()).get(COOKIE_JA_ENTROU)?.value === '1';
  } catch {
    return false;
  }
}

export async function apagarSessao(): Promise<void> {
  const { cookies } = await import('next/headers');
  const c = await cookies();
  c.delete(COOKIE_SESSAO);
  c.delete(COOKIE_EMPRESA);
}

/** Login obrigatório em produção (fora do modo mock) ou quando `WEB_EXIGIR_LOGIN=1`. */
export function loginObrigatorio(env: Record<string, string | undefined> = process.env): boolean {
  if (env.WEB_EXIGIR_LOGIN === '1') return true;
  return env.NODE_ENV === 'production' && env.WEB_MOCK_API !== '1';
}
