/**
 * Sem o cookie `sessao`, manda para /login quando o login é obrigatório (produção ou
 * WEB_EXIGIR_LOGIN=1). Em desenvolvimento, sem cookie, o painel segue com a sessão provisória.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_SESSAO, loginObrigatorio } from './lib/sessao';

const PUBLICAS = ['/login', '/redefinir', '/convite'];

export function middleware(req: NextRequest) {
  if (!loginObrigatorio()) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (req.cookies.get(COOKIE_SESSAO)?.value) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Tudo menos arquivos internos do Next e estáticos com extensão.
  matcher: ['/((?!_next/|favicon\\.ico|.*\\.[a-z0-9]+$).*)'],
};
