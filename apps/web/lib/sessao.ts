/**
 * Cookies da sessão real (só servidor): `sessao` guarda o JWT devolvido pela API e `empresa` o slug
 * da empresa ativa. httpOnly, SameSite=Lax e Secure em produção; o navegador nunca lê o token.
 */
export const COOKIE_SESSAO = 'sessao';
export const COOKIE_EMPRESA = 'empresa';
/** Mesma validade do JWT emitido pela API (12 h). */
export const VALIDADE_SESSAO_S = 12 * 60 * 60;

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

/** Grava a sessão (só em server action ou route handler). */
export async function gravarSessao(token: string, empresa: string | undefined): Promise<void> {
  const { cookies } = await import('next/headers');
  const c = await cookies();
  const base = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: VALIDADE_SESSAO_S,
  };
  c.set(COOKIE_SESSAO, token, base);
  if (empresa) c.set(COOKIE_EMPRESA, empresa, base);
  else c.delete(COOKIE_EMPRESA);
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
