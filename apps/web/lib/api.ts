/**
 * Cliente server-side da API (P4.8). Só roda no servidor do Next: token e segredo nunca vão ao navegador.
 *
 * Autenticação provisória (Fase 4):
 * 1. Preferência: `POST {API_URL}/auth/sessao-dev` com `{ email: WEB_USUARIO_EMAIL }` (rota que só
 *    existe fora de produção) devolve `{ token }`.
 * 2. Fallback, se a rota não existir (404): o próprio servidor assina um JWT HS256 com `AUTH_SECRET`
 *    e claims `sub` = `WEB_USUARIO_ID`, `email` = `WEB_USUARIO_EMAIL` (exige `WEB_USUARIO_ID`).
 * O token fica em memória até 60 s antes de expirar. Toda chamada leva `Authorization: Bearer` e
 * `x-tenant: WEB_EMPRESA`. Com `WEB_MOCK_API=1`, devolve dados montados da fixture (só testes visuais).
 */
import type {
  ApresentacaoPatch,
  ApresentacaoResposta,
  FonteAtualizar,
  FonteComSegredo,
  FonteCriar,
  FonteResumo,
  FontesResposta,
  VisaoGeralQuery,
  VisaoGeralResposta,
} from '@trafego/contratos';
import { decodeJwt, SignJWT } from 'jose';
import { adminMock, visaoGeralMock } from './mock';

export interface ConfigApi {
  apiUrl: string;
  authSecret: string | undefined;
  empresa: string;
  usuarioEmail: string;
  usuarioId: string | undefined;
  mock: boolean;
}

export function lerConfig(env: Record<string, string | undefined> = process.env): ConfigApi {
  return {
    apiUrl: (env.API_URL || 'http://localhost:3001').replace(/\/+$/, ''),
    authSecret: env.AUTH_SECRET || undefined,
    empresa: env.WEB_EMPRESA || 'pasio',
    usuarioEmail: env.WEB_USUARIO_EMAIL || 'admin@pasio.local',
    usuarioId: env.WEB_USUARIO_ID || undefined,
    mock: env.WEB_MOCK_API === '1',
  };
}

/** Em falha, `codigo` vem de `erro.codigo` da API (quando houver) e `status` do HTTP. */
export type Resultado<T> =
  { ok: true; dados: T } | { ok: false; mensagem: string; codigo?: string; status?: number };

/** Margem antes do vencimento para renovar o token. */
const MARGEM_MS = 60_000;
/** Tempo máximo de cada chamada (a primeira pintura precisa ficar abaixo de 1,5 s). */
const TEMPO_LIMITE_MS = 4_000;

type Fetch = typeof fetch;

export function criarClienteApi(
  config: ConfigApi,
  deps: { fetch?: Fetch; agora?: () => number } = {},
) {
  const f = deps.fetch ?? fetch;
  const agora = deps.agora ?? Date.now;
  let cache: { token: string; expiraEm: number } | null = null;

  function guardar(token: string): string {
    let expiraEm = agora() + 10 * 60_000;
    try {
      const { exp } = decodeJwt(token);
      if (typeof exp === 'number') expiraEm = exp * 1000;
    } catch {
      // token opaco: usa a validade padrão acima
    }
    cache = { token, expiraEm };
    return token;
  }

  async function assinarLocal(): Promise<string> {
    if (!config.authSecret || !config.usuarioId) {
      throw new Error(
        'A rota /auth/sessao-dev não existe e falta AUTH_SECRET ou WEB_USUARIO_ID para assinar o token.',
      );
    }
    return new SignJWT({ email: config.usuarioEmail })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(config.usuarioId)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(config.authSecret));
  }

  async function obterToken(): Promise<string> {
    if (cache && cache.expiraEm - MARGEM_MS > agora()) return cache.token;
    const r = await f(`${config.apiUrl}/auth/sessao-dev`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: config.usuarioEmail }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    if (r.ok) {
      const corpo = (await r.json()) as { token?: unknown };
      if (typeof corpo.token !== 'string') throw new Error('Resposta de sessao-dev sem token.');
      return guardar(corpo.token);
    }
    if (r.status === 404) return guardar(await assinarLocal());
    throw new Error(`Falha ao obter sessão (HTTP ${r.status}).`);
  }

  async function chamar<T>(
    metodo: string,
    caminho: string,
    corpo?: unknown,
  ): Promise<Resultado<T>> {
    try {
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const token = await obterToken();
        const headers: Record<string, string> = {
          authorization: `Bearer ${token}`,
          'x-tenant': config.empresa,
        };
        if (corpo !== undefined) headers['content-type'] = 'application/json';
        const r = await f(`${config.apiUrl}${caminho}`, {
          method: metodo,
          headers,
          ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
          cache: 'no-store',
          signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        });
        if (r.status === 401 && tentativa === 0) {
          cache = null; // token recusado: pede outro uma vez
          continue;
        }
        if (!r.ok) return { ok: false, status: r.status, ...(await lerErro(r)) };
        return { ok: true, dados: (await r.json()) as T };
      }
      return { ok: false, mensagem: 'Sessão recusada pela API.', status: 401 };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, mensagem: `API indisponível: ${msg}` };
    }
  }

  function get<T>(caminho: string): Promise<Resultado<T>> {
    return chamar<T>('GET', caminho);
  }

  return {
    obterToken,
    async visaoGeral(q: VisaoGeralQuery): Promise<Resultado<VisaoGeralResposta>> {
      if (config.mock) return { ok: true, dados: visaoGeralMock(q) };
      const s = new URLSearchParams();
      for (const [k, v] of Object.entries(q)) if (v) s.set(k, v);
      const busca = s.toString();
      return get<VisaoGeralResposta>(`/metricas/visao-geral${busca ? `?${busca}` : ''}`);
    },
    // --- Administração (contrato em packages/contratos/src/admin.ts) ---
    async apresentacao(): Promise<Resultado<ApresentacaoResposta>> {
      if (config.mock) return adminMock.apresentacao();
      return get<ApresentacaoResposta>('/empresas/atual/apresentacao');
    },
    async salvarApresentacao(p: ApresentacaoPatch): Promise<Resultado<ApresentacaoResposta>> {
      if (config.mock) return adminMock.salvarApresentacao(p);
      return chamar<ApresentacaoResposta>('PATCH', '/empresas/atual/apresentacao', p);
    },
    async fontes(): Promise<Resultado<FontesResposta>> {
      if (config.mock) return adminMock.fontes();
      return get<FontesResposta>('/empresas/atual/fontes');
    },
    async criarFonte(p: FonteCriar): Promise<Resultado<FonteComSegredo>> {
      if (config.mock) return adminMock.criarFonte(p);
      return chamar<FonteComSegredo>('POST', '/empresas/atual/fontes', p);
    },
    async atualizarFonte(id: string, p: FonteAtualizar): Promise<Resultado<FonteResumo>> {
      if (config.mock) return adminMock.atualizarFonte(id, p);
      return chamar<FonteResumo>('PATCH', `/empresas/atual/fontes/${encodeURIComponent(id)}`, p);
    },
    async rotacionarSegredo(id: string): Promise<Resultado<FonteComSegredo>> {
      if (config.mock) return adminMock.rotacionarSegredo(id);
      return chamar<FonteComSegredo>(
        'POST',
        `/empresas/atual/fontes/${encodeURIComponent(id)}/segredo`,
        {},
      );
    },
  };
}

async function lerErro(r: Response): Promise<{ mensagem: string; codigo?: string }> {
  try {
    const corpo = (await r.json()) as { erro?: { mensagem?: string; codigo?: string } };
    const codigo = typeof corpo.erro?.codigo === 'string' ? corpo.erro.codigo : undefined;
    const extra = codigo ? { codigo } : {};
    if (corpo.erro?.mensagem)
      return { mensagem: `${corpo.erro.mensagem} (HTTP ${r.status})`, ...extra };
    return { mensagem: `A API respondeu HTTP ${r.status}.`, ...extra };
  } catch {
    // corpo não é JSON
  }
  return { mensagem: `A API respondeu HTTP ${r.status}.` };
}

let padrao: ReturnType<typeof criarClienteApi> | null = null;

/** Cliente único por processo do servidor (reaproveita o token entre requisições). */
export function api() {
  padrao ??= criarClienteApi(lerConfig());
  return padrao;
}
