/**
 * Autenticação e papéis por empresa.
 *
 * A API confia num JWT HS256 assinado com `AUTH_SECRET` (o mesmo segredo do web/Auth.js).
 * Claims: `sub` (uuid do usuário), `email` e, opcionalmente, `tenant` (uuid da empresa ativa).
 *
 * Decora:
 * - `app.db`: Drizzle conectado como `app_user` (sem BYPASSRLS), fechado no `onClose`.
 * - `app.autenticar`: preHandler que valida o token e preenche `request.usuario`.
 * - `app.exigirEmpresa`: resolve a empresa ativa (cabeçalho `x-tenant` > claim `tenant`) e o
 *   papel do usuário nela; preenche `request.empresa`.
 * - `app.exigirPapel(p)`: exige papel mínimo na empresa ativa (admin > analista > leitor).
 * - `request.comTenant(fn)`: roda `fn` numa transação com `app.tenant_id`/`app.user_id` fixados,
 *   para que toda consulta de rota passe pelo RLS.
 */
import { and, eq, or, type SQL } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  comTenant,
  comUsuario,
  criarDb,
  memberships,
  tenants,
  type Db,
  type Role,
  type Tx,
} from '../db/client.js';
import { ErroApi } from '../erros.js';

/** Claims aceitas no token. */
export const schemaClaims = z.object({
  sub: z.uuid(),
  email: z.email(),
  tenant: z.uuid().optional(),
});

export type ClaimsToken = z.infer<typeof schemaClaims>;

export interface UsuarioAutenticado {
  id: string;
  email: string;
}

export interface EmpresaAtiva {
  id: string;
  slug: string;
  nome: string;
  papel: Role;
}

export type GanchoPre = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: ClaimsToken;
    user: ClaimsToken;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    autenticar: GanchoPre;
    exigirEmpresa: GanchoPre;
    exigirPapel: (papel: Role) => GanchoPre;
  }
  interface FastifyRequest {
    usuario: UsuarioAutenticado | null;
    empresa: EmpresaAtiva | null;
    comTenant<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  }
}

/** Validade padrão do token emitido pela API (troca de empresa e testes). */
export const VALIDADE_TOKEN = '12h';

/** Peso de cada papel: quem tem peso maior pode tudo que os menores podem. */
export const PESO_PAPEL: Record<Role, number> = { leitor: 1, analista: 2, admin: 3 };

export function papelAtende(papel: Role, minimo: Role): boolean {
  return PESO_PAPEL[papel] >= PESO_PAPEL[minimo];
}

/** Assina um token no formato que a API aceita. Usado pela troca de empresa, testes e web. */
export function emitirToken(
  app: FastifyInstance,
  claims: ClaimsToken,
  opcoes: { expiresIn?: string | number } = {},
): string {
  const validas = schemaClaims.parse(claims);
  return app.jwt.sign(validas, { expiresIn: opcoes.expiresIn ?? VALIDADE_TOKEN });
}

const uuid = z.uuid();

/** Filtro de empresa por slug ou id (só compara id se a referência for um UUID). */
function filtroEmpresa(ref: string): SQL | undefined {
  return uuid.safeParse(ref).success
    ? or(eq(tenants.slug, ref), eq(tenants.id, ref))
    : eq(tenants.slug, ref);
}

/**
 * Busca a membership do usuário numa empresa (slug ou id). Roda sob `comUsuario`, então o
 * RLS de `memberships` só deixa ver as linhas do próprio usuário.
 */
export async function buscarMembership(
  db: Db,
  userId: string,
  refEmpresa: string,
): Promise<EmpresaAtiva | null> {
  const linhas = await comUsuario(db, userId, (tx) =>
    tx
      .select({ id: tenants.id, slug: tenants.slug, nome: tenants.nome, papel: memberships.role })
      .from(memberships)
      .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
      .where(and(eq(memberships.userId, userId), filtroEmpresa(refEmpresa)))
      .limit(1),
  );
  return linhas[0] ?? null;
}

/** Lista as empresas do usuário com o papel em cada uma. */
export async function listarEmpresas(db: Db, userId: string): Promise<EmpresaAtiva[]> {
  return comUsuario(db, userId, (tx) =>
    tx
      .select({ id: tenants.id, slug: tenants.slug, nome: tenants.nome, papel: memberships.role })
      .from(memberships)
      .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
      .where(eq(memberships.userId, userId))
      .orderBy(tenants.nome),
  );
}

export interface OpcoesAuth {
  databaseUrl: string;
  /** Db pronto (testes); se omitido, é criado a partir de `databaseUrl` e fechado no onClose. */
  db?: Db;
}

async function pluginAuth(app: FastifyInstance, opcoes: OpcoesAuth): Promise<void> {
  const db = opcoes.db ?? criarDb(opcoes.databaseUrl);
  app.decorate('db', db);
  if (!opcoes.db) {
    app.addHook('onClose', async () => {
      await db.$client.end({ timeout: 5 });
    });
  }

  app.decorateRequest('usuario', null);
  app.decorateRequest('empresa', null);
  app.decorateRequest('comTenant', function <
    T,
  >(this: FastifyRequest, fn: (tx: Tx) => Promise<T>): Promise<T> {
    if (!this.empresa || !this.usuario) {
      throw ErroApi.de('erro_interno', 'comTenant chamado sem empresa ativa resolvida.');
    }
    return comTenant(db, this.empresa.id, this.usuario.id, fn);
  });

  const autenticar: GanchoPre = async (request) => {
    if (request.usuario) return;
    if (!request.headers.authorization) {
      throw ErroApi.de('nao_autenticado', 'Envie o token no cabeçalho Authorization: Bearer.');
    }
    let bruto: unknown;
    try {
      bruto = await request.jwtVerify();
    } catch (erro) {
      const codigo = (erro as { code?: string }).code;
      if (codigo === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
        throw ErroApi.de('nao_autenticado', 'Envie o token no cabeçalho Authorization: Bearer.');
      }
      const expirado = codigo === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED';
      throw ErroApi.de('token_invalido', expirado ? 'Token expirado.' : 'Token inválido.');
    }
    const claims = schemaClaims.safeParse(bruto);
    if (!claims.success) throw ErroApi.de('token_invalido', 'Token com claims inválidas.');
    request.usuario = { id: claims.data.sub, email: claims.data.email };
  };

  const exigirEmpresa: GanchoPre = async (request, reply) => {
    await autenticar(request, reply);
    if (request.empresa) return;
    const cabecalho = request.headers['x-tenant'];
    const ref =
      (typeof cabecalho === 'string' && cabecalho.trim()) ||
      (request.user as ClaimsToken | undefined)?.tenant;
    if (!ref) {
      throw ErroApi.de(
        'empresa_nao_informada',
        'Informe a empresa ativa (claim tenant no token ou cabeçalho x-tenant).',
      );
    }
    const empresa = await buscarMembership(db, request.usuario!.id, ref);
    if (!empresa) throw ErroApi.de('acesso_negado', 'Você não tem acesso a esta empresa.');
    request.empresa = empresa;
  };

  app.decorate('autenticar', autenticar);
  app.decorate('exigirEmpresa', exigirEmpresa);
  app.decorate('exigirPapel', (minimo: Role): GanchoPre => {
    return async (request, reply) => {
      await exigirEmpresa(request, reply);
      if (!papelAtende(request.empresa!.papel, minimo)) {
        throw ErroApi.de('acesso_negado', `Esta ação exige papel ${minimo} ou superior.`, {
          papel: request.empresa!.papel,
          exigido: minimo,
        });
      }
    };
  });
}

// Equivalente ao fastify-plugin: as decorações valem fora do escopo do plugin.
(pluginAuth as unknown as Record<symbol, boolean>)[Symbol.for('skip-override')] = true;
(pluginAuth as unknown as Record<symbol, string>)[Symbol.for('fastify.display-name')] = 'auth';

export const authPlugin = pluginAuth;
