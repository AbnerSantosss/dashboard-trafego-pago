import { eq, sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { buscarMembership, emitirToken, listarEmpresas } from '../auth/plugin.js';
import { presentation, ROLES, tenants, users } from '../db/client.js';
import { ErroApi, schemaRespostaErro } from '../erros.js';

const schemaEmpresa = z.object({
  id: z.uuid(),
  slug: z.string(),
  nome: z.string(),
  papel: z.enum(ROLES),
});

export const schemaMe = z.object({
  usuario: z.object({
    id: z.uuid(),
    email: z.string(),
    nome: z.string(),
    sobrenome: z.string(),
  }),
  empresas: z.array(schemaEmpresa),
  empresaAtiva: z.uuid().nullable().describe('Claim tenant do token, se houver'),
});

export const schemaTrocaEmpresa = z.object({
  token: z.string().describe('Novo JWT com a claim tenant trocada'),
  empresa: schemaEmpresa,
});

export const schemaEmpresaAtual = z.object({
  empresa: schemaEmpresa.extend({ moeda: z.string(), fuso: z.string() }),
  apresentacao: z.object({ nomeExibicao: z.string(), logoUrl: z.string().nullable() }).nullable(),
});

const seguranca = [{ bearerAuth: [] }];
const erros401 = { 401: schemaRespostaErro };

export const rotasAuth: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/me',
    {
      preHandler: app.autenticar,
      schema: {
        tags: ['auth'],
        summary: 'Usuário autenticado e suas empresas',
        security: seguranca,
        response: { 200: schemaMe, ...erros401 },
      },
    },
    async (request) => {
      const { id } = request.usuario!;
      const [linha] = await app.db
        .select({ id: users.id, email: users.email, nome: users.nome, sobrenome: users.sobrenome })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      if (!linha) throw ErroApi.de('token_invalido', 'Usuário do token não existe.');
      return {
        usuario: linha,
        empresas: await listarEmpresas(app.db, id),
        empresaAtiva: request.user.tenant ?? null,
      };
    },
  );

  app.post(
    '/me/empresa',
    {
      preHandler: app.autenticar,
      schema: {
        tags: ['auth'],
        summary: 'Troca a empresa ativa',
        description:
          'Devolve um novo token com a claim tenant apontando para a empresa informada (slug ou id).',
        security: seguranca,
        body: z.object({ empresa: z.string().min(1).describe('Slug ou id da empresa') }),
        response: {
          200: schemaTrocaEmpresa,
          400: schemaRespostaErro,
          ...erros401,
          403: schemaRespostaErro,
        },
      },
    },
    async (request) => {
      const usuario = request.usuario!;
      const empresa = await buscarMembership(app.db, usuario.id, request.body.empresa);
      if (!empresa) throw ErroApi.de('acesso_negado', 'Você não tem acesso a esta empresa.');
      const token = emitirToken(app, { sub: usuario.id, email: usuario.email, tenant: empresa.id });
      return { token, empresa };
    },
  );

  app.get(
    '/empresas/atual',
    {
      preHandler: app.exigirEmpresa,
      schema: {
        tags: ['auth'],
        summary: 'Empresa ativa e papel do usuário',
        description: 'Lido sob RLS (request.comTenant). Aceita o cabeçalho x-tenant (slug ou id).',
        security: seguranca,
        headers: z.object({ 'x-tenant': z.string().optional() }),
        response: {
          200: schemaEmpresaAtual,
          400: schemaRespostaErro,
          ...erros401,
          403: schemaRespostaErro,
        },
      },
    },
    async (request) => {
      const empresa = request.empresa!;
      const { tenant, apres } = await request.comTenant(async (tx) => {
        const [t] = await tx
          .select({ moeda: tenants.moeda, fuso: tenants.fuso })
          .from(tenants)
          .where(eq(tenants.id, empresa.id));
        const [p] = await tx
          .select({ nomeExibicao: presentation.nomeExibicao, logoUrl: presentation.logoUrl })
          .from(presentation);
        return { tenant: t, apres: p };
      });
      if (!tenant) throw ErroApi.de('nao_encontrado', 'Empresa não encontrada.');
      return { empresa: { ...empresa, ...tenant }, apresentacao: apres ?? null };
    },
  );
};

export const schemaSessaoDev = z.object({
  token: z.string().describe('JWT de 12 h, sem claim tenant'),
  usuario: z.object({ id: z.uuid(), email: z.string(), nome: z.string() }),
  empresas: z.array(schemaEmpresa),
});

/**
 * Login de desenvolvimento, SEM SENHA: basta o e-mail de um usuário existente.
 * Temporário até o Auth.js (Fase 5). O `buildApp` só registra este plugin quando
 * `NODE_ENV !== 'production'`; em produção a rota não existe (404).
 */
export const rotasSessaoDev: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/auth/sessao-dev',
    {
      schema: {
        tags: ['auth'],
        summary: 'Login de desenvolvimento sem senha (não existe em produção)',
        description:
          'Somente desenvolvimento local: emite um token de 12 h para o e-mail informado, sem ' +
          'senha. Não é registrada quando NODE_ENV=production. Será substituída pelo Auth.js.',
        body: z.object({ email: z.string().min(3).max(320) }),
        response: { 200: schemaSessaoDev, 400: schemaRespostaErro, 404: schemaRespostaErro },
      },
    },
    async (request) => {
      const email = request.body.email.trim().toLowerCase();
      const [usuario] = await app.db
        .select({ id: users.id, email: users.email, nome: users.nome })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
      if (!usuario) throw ErroApi.de('nao_encontrado', 'Usuário não encontrado.');
      const token = emitirToken(app, { sub: usuario.id, email: usuario.email });
      return { token, usuario, empresas: await listarEmpresas(app.db, usuario.id) };
    },
  );
};
