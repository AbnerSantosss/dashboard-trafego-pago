/**
 * Cliente server-side da API (P4.8). Só roda no servidor do Next: token e segredo nunca vão ao navegador.
 *
 * Autenticação provisória (Fase 4):
 * 1. Preferência: `POST {API_URL}/auth/sessao-dev` com `{ email: WEB_USUARIO_EMAIL }` (rota que só
 *    existe fora de produção) devolve `{ token }`.
 * 2. Fallback, se a rota não existir (404): o próprio servidor assina um JWT HS256 com `AUTH_SECRET`
 *    e claims `sub` = `WEB_USUARIO_ID`, `email` = `WEB_USUARIO_EMAIL` (exige `WEB_USUARIO_ID`).
 * O token fica em memória até 60 s antes de expirar. Toda chamada leva `Authorization: Bearer` e
 * `x-tenant: WEB_EMPRESA`. Em produção esse caminho não existe: sem o cookie `sessao`, a chamada
 * falha como não autenticada (401), para nunca agir como `WEB_USUARIO_ID` no lugar de quem visita.
 *
 * Sessão real: quando o navegador tem o cookie httpOnly `sessao` (login, convite ou redefinição),
 * esse token e o cookie `empresa` valem para a requisição e o caminho provisório acima não é usado. Com `WEB_MOCK_API=1`, devolve dados montados da fixture (só testes visuais).
 */
import type {
  ApresentacaoPatch,
  ApresentacaoResposta,
  ConviteCriado,
  ConvitePublico,
  CustoCriar,
  CustoResumo,
  CustosResposta,
  EventosEtapaQuery,
  EventosEtapaResposta,
  FichaLead,
  InicioDuasEtapas,
  MetaContaAtualizar,
  MetaContaCriada,
  MetaContaCriar,
  MetaContaResumo,
  MetaContasResposta,
  MetaSincronizacao,
  MePatch,
  MeResposta,
  Papel,
  RespostaEntrada,
  Sessao,
  UsuarioConta,
  UsuariosResposta,
  FonteAtualizar,
  FonteComSegredo,
  FonteCriar,
  FonteResumo,
  FontesResposta,
  VisaoGeralQuery,
  VisaoGeralResposta,
} from '@trafego/contratos';
import { decodeJwt, SignJWT } from 'jose';
import type { Entrega } from './instalacao';
import { adminMock, visaoGeralMock } from './mock';
import { lerSessaoDoCookie, type SessaoCookie } from './sessao';

export interface ConfigApi {
  apiUrl: string;
  authSecret: string | undefined;
  empresa: string;
  usuarioEmail: string;
  usuarioId: string | undefined;
  mock: boolean;
  /** NODE_ENV=production: desliga a sessão provisória (sessao-dev e assinatura local). */
  producao: boolean;
}

export function lerConfig(env: Record<string, string | undefined> = process.env): ConfigApi {
  return {
    apiUrl: (env.API_URL || 'http://localhost:3001').replace(/\/+$/, ''),
    authSecret: env.AUTH_SECRET || undefined,
    empresa: env.WEB_EMPRESA || 'pasio',
    usuarioEmail: env.WEB_USUARIO_EMAIL || 'admin@pasio.local',
    usuarioId: env.WEB_USUARIO_ID || undefined,
    mock: env.WEB_MOCK_API === '1',
    producao: env.NODE_ENV === 'production',
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

/**
 * Mensagem de quando a API não respondeu. O tempo esgotado sai em português e dizendo o prazo (o
 * fetch só diz "The operation was aborted due to timeout"); numa escrita, avisa que a API pode ter
 * concluído a ação mesmo assim.
 */
export function mensagemSemResposta(e: unknown, metodo: string): string {
  const nome = e instanceof Error ? e.name : '';
  const escrita = metodo !== 'GET';
  if (nome === 'TimeoutError' || nome === 'AbortError') {
    return (
      `A API não respondeu em ${TEMPO_LIMITE_MS / 1000} s (tempo esgotado).` +
      (escrita
        ? ' A ação pode ter sido concluída mesmo assim: recarregue a página para conferir.'
        : '')
    );
  }
  const msg = e instanceof Error ? e.message : String(e);
  return `API indisponível: ${msg}`;
}

/**
 * IP do visitante que a borda da Cloudflare grava em `cf-connecting-ip`. Vai junto nas chamadas à
 * API para o rate-limit contar por visitante, e não pelo IP do servidor web. Fora de uma
 * requisição do Next (testes, build), não há.
 */
async function lerIpDoVisitante(): Promise<string | undefined> {
  try {
    const { headers } = await import('next/headers');
    return (await headers()).get('cf-connecting-ip') ?? undefined;
  } catch {
    return undefined;
  }
}

export function criarClienteApi(
  config: ConfigApi,
  deps: {
    fetch?: Fetch;
    agora?: () => number;
    sessao?: () => Promise<SessaoCookie>;
    ip?: () => Promise<string | undefined>;
  } = {},
) {
  const f = deps.fetch ?? fetch;
  const lerSessao = deps.sessao ?? lerSessaoDoCookie;
  const lerIp = deps.ip ?? lerIpDoVisitante;
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
    if (config.producao) throw new Error('Sessão provisória desligada em produção.');
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
      const sessao = await lerSessao();
      if (!sessao.token && config.producao) {
        return { ok: false, mensagem: 'Sessão ausente. Entre de novo.', status: 401 };
      }
      const ip = await lerIp();
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const token = sessao.token ?? (await obterToken());
        const headers: Record<string, string> = {
          authorization: `Bearer ${token}`,
          'x-tenant': sessao.empresa ?? config.empresa,
        };
        if (corpo !== undefined) headers['content-type'] = 'application/json';
        if (ip) headers['cf-connecting-ip'] = ip;
        const r = await f(`${config.apiUrl}${caminho}`, {
          method: metodo,
          headers,
          ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
          cache: 'no-store',
          signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        });
        if (r.status === 401 && tentativa === 0 && !sessao.token) {
          cache = null; // token recusado: pede outro uma vez
          continue;
        }
        if (!r.ok) return { ok: false, status: r.status, ...(await lerErro(r)) };
        if (r.status === 204) return { ok: true, dados: null as T };
        return { ok: true, dados: (await r.json()) as T };
      }
      return { ok: false, mensagem: 'Sessão recusada pela API.', status: 401 };
    } catch (e) {
      return { ok: false, mensagem: mensagemSemResposta(e, metodo) };
    }
  }

  function get<T>(caminho: string): Promise<Resultado<T>> {
    return chamar<T>('GET', caminho);
  }

  /**
   * Rotas sem login (entrar, recuperar, convite): sem empresa e sem token, a não ser o `token` dado
   * aqui (sair), que nunca cai na sessão provisória.
   */
  async function publico<T>(
    metodo: string,
    caminho: string,
    corpo?: unknown,
    token?: string,
  ): Promise<Resultado<T>> {
    try {
      const headers: Record<string, string> = {};
      if (token) headers.authorization = `Bearer ${token}`;
      if (corpo !== undefined) headers['content-type'] = 'application/json';
      const ip = await lerIp();
      if (ip) headers['cf-connecting-ip'] = ip;
      const r = await f(`${config.apiUrl}${caminho}`, {
        method: metodo,
        headers,
        ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
        cache: 'no-store',
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
      if (!r.ok) return { ok: false, status: r.status, ...(await lerErro(r)) };
      const texto = await r.text();
      return { ok: true, dados: (texto ? JSON.parse(texto) : null) as T };
    } catch (e) {
      return { ok: false, mensagem: mensagemSemResposta(e, metodo) };
    }
  }

  const semMock = <T>(): Resultado<T> => ({
    ok: false,
    mensagem: 'Indisponível com WEB_MOCK_API=1.',
  });
  const id = (v: string) => encodeURIComponent(v);

  return {
    obterToken,
    async visaoGeral(q: VisaoGeralQuery): Promise<Resultado<VisaoGeralResposta>> {
      if (config.mock) return { ok: true, dados: visaoGeralMock(q) };
      const s = new URLSearchParams();
      for (const [k, v] of Object.entries(q)) if (v) s.set(k, v);
      const busca = s.toString();
      return get<VisaoGeralResposta>(`/metricas/visao-geral${busca ? `?${busca}` : ''}`);
    },
    // --- Lista por etapa do funil e ficha do lead (contrato em packages/contratos/src/leads.ts) ---
    async eventosEtapa(q: EventosEtapaQuery): Promise<Resultado<EventosEtapaResposta>> {
      if (config.mock) return semMock();
      const s = new URLSearchParams();
      for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') s.set(k, String(v));
      return get<EventosEtapaResposta>(`/empresas/atual/eventos?${s.toString()}`);
    },
    async lead(leadKey: string): Promise<Resultado<FichaLead>> {
      if (config.mock) return semMock();
      return get<FichaLead>(`/empresas/atual/leads/${id(leadKey)}`);
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
    /** Últimas entregas de uma fonte (analista ou acima); `empresa` é o slug da empresa ativa. */
    async entregas(
      empresa: string,
      fonte: string,
      limite = 20,
    ): Promise<Resultado<{ entregas: Entrega[] }>> {
      if (config.mock) return { ok: true, dados: { entregas: [] } };
      return get<{ entregas: Entrega[] }>(
        `/webhooks/${id(empresa)}/${id(fonte)}/entregas?limite=${limite}`,
      );
    },
    // --- Conta e usuários (contrato em packages/contratos/src/conta.ts) ---
    /**
     * Login, redefinição e aceite de convite devolvem a `Sessao` ou, se o usuário ativou a
     * verificação em duas etapas, `{ segundoFator: true, desafio }` (ver `pedeSegundoFator`).
     */
    entrar: (email: string, senha: string, lembrar = false) =>
      publico<RespostaEntrada>('POST', '/auth/login', { email, senha, lembrar }),
    recuperar: (email: string) => publico<null>('POST', '/auth/recuperar', { email }),
    redefinir: (token: string, senha: string) =>
      publico<RespostaEntrada>('POST', '/auth/redefinir', { token, senha }),
    convite: (token: string) => publico<ConvitePublico>('GET', `/convites/${id(token)}`),
    aceitarConvite: (token: string, p: { nome: string; sobrenome: string; senha: string }) =>
      publico<RespostaEntrada>('POST', `/convites/${id(token)}/aceitar`, p),
    /**
     * Segunda etapa do login: troca o desafio (5 min) e o código do app pela sessão. 401
     * `nao_autenticado` com código errado, 401 `token_invalido` com desafio vencido, 429 no bloqueio.
     */
    confirmarDuasEtapas: (desafio: string, codigo: string) =>
      publico<Sessao>('POST', '/auth/duas-etapas', { desafio, codigo }),
    /**
     * Encerra a sessão na API: ela grava a hora e todo token do usuário emitido antes deixa de
     * valer (204). Recebe o token do cookie para não invalidar o usuário da sessão provisória.
     */
    async sair(token: string): Promise<Resultado<null>> {
      if (config.mock) return { ok: true, dados: null };
      return publico<null>('POST', '/auth/sair', undefined, token);
    },
    /**
     * No mock fica indisponível de propósito: a sidebar lê `me` para o rodapé da conta e, com um
     * usuário fictício, a captura da Visão geral deixaria de bater com a referência.
     */
    async me(): Promise<Resultado<MeResposta>> {
      if (config.mock) return semMock();
      return get<MeResposta>('/me');
    },
    /**
     * Verificação em duas etapas do próprio usuário: `iniciar` (senha) gera o segredo pendente e o
     * `otpauth://` do QR; `ativar` (código) liga; `desativar` (senha e código) desliga. No mock,
     * `iniciar` devolve um segredo fixo de exemplo e os outros dois só respondem ok.
     */
    async iniciarDuasEtapas(senhaAtual: string): Promise<Resultado<InicioDuasEtapas>> {
      if (config.mock) return { ok: true, dados: INICIO_DUAS_ETAPAS_MOCK };
      return chamar<InicioDuasEtapas>('POST', '/me/duas-etapas/iniciar', { senhaAtual });
    },
    async ativarDuasEtapas(codigo: string): Promise<Resultado<null>> {
      if (config.mock) return { ok: true, dados: null };
      return chamar<null>('POST', '/me/duas-etapas/ativar', { codigo });
    },
    async desativarDuasEtapas(senhaAtual: string, codigo: string): Promise<Resultado<null>> {
      if (config.mock) return { ok: true, dados: null };
      return chamar<null>('POST', '/me/duas-etapas/desativar', { senhaAtual, codigo });
    },
    /** Com troca de senha, vem `token` novo: a API invalida o anterior. */
    async atualizarMe(p: MePatch): Promise<Resultado<{ usuario: UsuarioConta; token?: string }>> {
      if (config.mock) return semMock();
      return chamar<{ usuario: UsuarioConta; token?: string }>('PATCH', '/me', p);
    },
    async usuarios(): Promise<Resultado<UsuariosResposta>> {
      if (config.mock) return semMock();
      return get<UsuariosResposta>('/empresas/atual/usuarios');
    },
    async convidar(email: string, papel: Papel): Promise<Resultado<ConviteCriado>> {
      if (config.mock) return semMock();
      return chamar<ConviteCriado>('POST', '/empresas/atual/convites', { email, papel });
    },
    cancelarConvite: (conviteId: string) =>
      chamar<null>('DELETE', `/empresas/atual/convites/${id(conviteId)}`),
    mudarPapel: (usuarioId: string, papel: Papel) =>
      chamar<null>('PATCH', `/empresas/atual/usuarios/${id(usuarioId)}`, { papel }),
    removerMembro: (usuarioId: string) =>
      chamar<null>('DELETE', `/empresas/atual/usuarios/${id(usuarioId)}`),
    // --- Gasto em anúncios (contrato em packages/contratos/src/custos.ts) ---
    async custos(de?: string, ate?: string): Promise<Resultado<CustosResposta>> {
      if (config.mock) return semMock();
      const s = new URLSearchParams();
      if (de) s.set('de', de);
      if (ate) s.set('ate', ate);
      const busca = s.toString();
      return get<CustosResposta>(`/empresas/atual/custos${busca ? `?${busca}` : ''}`);
    },
    lancarCusto: (p: CustoCriar) => chamar<CustoResumo>('POST', '/empresas/atual/custos', p),
    removerCusto: (custoId: string) =>
      chamar<null>('DELETE', `/empresas/atual/custos/${id(custoId)}`),
    async metaContas(): Promise<Resultado<MetaContasResposta>> {
      if (config.mock) return semMock();
      return get<MetaContasResposta>('/empresas/atual/meta/contas');
    },
    conectarMeta: (p: MetaContaCriar) =>
      chamar<MetaContaCriada>('POST', '/empresas/atual/meta/contas', p),
    atualizarMeta: (contaId: string, p: MetaContaAtualizar) =>
      chamar<MetaContaResumo>('PATCH', `/empresas/atual/meta/contas/${id(contaId)}`, p),
    sincronizarMeta: (contaId: string, dias?: number) =>
      chamar<MetaSincronizacao>(
        'POST',
        `/empresas/atual/meta/contas/${id(contaId)}/sincronizar`,
        dias ? { dias } : {},
      ),
    removerMeta: (contaId: string) =>
      chamar<null>('DELETE', `/empresas/atual/meta/contas/${id(contaId)}`),
  };
}

/** Segredo de exemplo do modo mock (nunca é um segredo real; serve só para a tela montar o QR). */
export const INICIO_DUAS_ETAPAS_MOCK: InicioDuasEtapas = {
  segredo: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  uri: 'otpauth://totp/PASIO:admin%40pasio.local?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=PASIO&algorithm=SHA1&digits=6&period=30',
};

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
