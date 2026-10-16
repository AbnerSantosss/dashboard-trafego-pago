/**
 * Usuários da empresa ativa (papel admin): membros, convites pendentes, envio de convite por
 * e-mail, troca de papel e remoção. Tudo sob RLS (`request.comTenant`).
 */
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { invites, memberships, ROLES, users } from '../db/client.js';
import { ErroApi, schemaRespostaErro } from '../erros.js';
import { htmlComBotao, type EnviadorEmail } from './email.js';
import { gerarTokenConvite, sha256 } from './senha.js';

/** Validade do convite: 7 dias. */
export const VALIDADE_CONVITE_MS = 7 * 24 * 60 * 60 * 1000;

const schemaMembro = z.object({
  id: z.uuid().describe('id do usuário'),
  email: z.string(),
  nome: z.string(),
  sobrenome: z.string(),
  papel: z.enum(ROLES),
  desde: z.string(),
  temSenha: z.boolean(),
});
const schemaConvite = z.object({
  id: z.uuid(),
  email: z.string(),
  papel: z.enum(ROLES),
  expiraEm: z.string(),
  criadoEm: z.string(),
});

export interface OpcoesUsuarios {
  email: EnviadorEmail;
  webUrl: string;
}

const seguranca = [{ bearerAuth: [] }];
const cabecalhos = z.object({ 'x-tenant': z.string().optional() });

export const rotasUsuarios: FastifyPluginAsyncZod<OpcoesUsuarios> = async (app, opcoes) => {
  const pre = [app.exigirEmpresa, app.exigirPapel('admin')];
  const erros = {
    400: schemaRespostaErro,
    401: schemaRespostaErro,
    403: schemaRespostaErro,
    404: schemaRespostaErro,
    409: schemaRespostaErro,
  };

  app.get(
    '/empresas/atual/usuarios',
    {
      preHandler: pre,
      schema: {
        tags: ['admin'],
        summary: 'Membros e convites pendentes da empresa ativa',
        security: seguranca,
        headers: cabecalhos,
        response: {
          200: z.object({ membros: z.array(schemaMembro), convites: z.array(schemaConvite) }),
          ...erros,
        },
      },
    },
    async (request) =>
      request.comTenant(async (tx) => {
        const membros = await tx
          .select({
            id: users.id,
            email: users.email,
            nome: users.nome,
            sobrenome: users.sobrenome,
            papel: memberships.role,
            desde: memberships.createdAt,
            temSenha: sql<boolean>`${users.senhaHash} is not null`,
          })
          .from(memberships)
          .innerJoin(users, eq(users.id, memberships.userId))
          // A política de RLS também mostra as memberships do próprio usuário em outras empresas.
          .where(eq(memberships.tenantId, request.empresa!.id))
          .orderBy(users.nome);
        const convites = await tx
          .select({
            id: invites.id,
            email: invites.email,
            papel: invites.role,
            expiraEm: invites.expiraEm,
            criadoEm: invites.createdAt,
          })
          .from(invites)
          .where(and(isNull(invites.aceitoEm), gt(invites.expiraEm, new Date())))
          .orderBy(desc(invites.createdAt));
        return {
          membros: membros.map((m) => ({ ...m, desde: m.desde.toISOString() })),
          convites: convites.map((c) => ({
            ...c,
            expiraEm: c.expiraEm.toISOString(),
            criadoEm: c.criadoEm.toISOString(),
          })),
        };
      }),
  );

  app.post(
    '/empresas/atual/convites',
    {
      preHandler: pre,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['admin'],
        summary: 'Convida um e-mail para a empresa ativa',
        description:
          'Cria o convite (7 dias) e envia o link por e-mail. O link também volta na resposta, ' +
          'para o admin copiar se o e-mail não chegar. Um novo convite substitui o pendente.',
        security: seguranca,
        headers: cabecalhos,
        body: z.object({
          email: z.string().trim().toLowerCase().pipe(z.email('e-mail inválido')),
          papel: z.enum(ROLES).default('leitor'),
        }),
        response: {
          201: z.object({ convite: schemaConvite, link: z.string(), emailEnviado: z.boolean() }),
          ...erros,
        },
      },
    },
    async (request, reply) => {
      const empresa = request.empresa!;
      const { email, papel } = request.body;
      const token = gerarTokenConvite(empresa.id);
      const convite = await request.comTenant(async (tx) => {
        const [membro] = await tx
          .select({ id: memberships.id })
          .from(memberships)
          .innerJoin(users, eq(users.id, memberships.userId))
          .where(and(eq(memberships.tenantId, empresa.id), sql`lower(${users.email}) = ${email}`))
          .limit(1);
        if (membro) throw ErroApi.de('conflito', 'Este e-mail já faz parte da empresa.');
        await tx.delete(invites).where(and(eq(invites.email, email), isNull(invites.aceitoEm)));
        const [c] = await tx
          .insert(invites)
          .values({
            tenantId: empresa.id,
            email,
            role: papel,
            tokenHash: sha256(token),
            expiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS),
            criadoPor: request.usuario!.id,
          })
          .returning();
        return c!;
      });
      const link = `${opcoes.webUrl}/convite?token=${encodeURIComponent(token)}`;
      const emailEnviado = await opcoes.email.enviar({
        para: email,
        assunto: `Convite para o painel ${empresa.nome}`,
        texto: `Você foi convidado para acompanhar o painel ${empresa.nome}. Abra o link para criar seu acesso (vale 7 dias): ${link}`,
        html: htmlComBotao(
          `Convite para o painel ${empresa.nome}`,
          'Você foi convidado para acompanhar o painel. O link vale por 7 dias.',
          'Criar meu acesso',
          link,
        ),
      });
      return reply.code(201).send({
        convite: {
          id: convite.id,
          email: convite.email,
          papel: convite.role,
          expiraEm: convite.expiraEm.toISOString(),
          criadoEm: convite.createdAt.toISOString(),
        },
        link,
        emailEnviado,
      });
    },
  );

  app.delete(
    '/empresas/atual/convites/:id',
    {
      preHandler: pre,
      schema: {
        tags: ['admin'],
        summary: 'Cancela um convite pendente',
        security: seguranca,
        headers: cabecalhos,
        params: z.object({ id: z.uuid() }),
        response: { 204: z.null(), ...erros },
      },
    },
    async (request, reply) => {
      const apagados = await request.comTenant((tx) =>
        tx.delete(invites).where(eq(invites.id, request.params.id)).returning({ id: invites.id }),
      );
      if (apagados.length === 0) throw ErroApi.de('nao_encontrado', 'Convite não encontrado.');
      return reply.code(204).send(null);
    },
  );

  const naoSiMesmo = (alvo: string, eu: string) => {
    if (alvo === eu) {
      throw ErroApi.de('acesso_negado', 'Você não pode mudar o próprio acesso.');
    }
  };

  app.patch(
    '/empresas/atual/usuarios/:id',
    {
      preHandler: pre,
      schema: {
        tags: ['admin'],
        summary: 'Muda o papel de um membro',
        security: seguranca,
        headers: cabecalhos,
        params: z.object({ id: z.uuid() }),
        body: z.object({ papel: z.enum(ROLES) }),
        response: { 204: z.null(), ...erros },
      },
    },
    async (request, reply) => {
      naoSiMesmo(request.params.id, request.usuario!.id);
      const linhas = await request.comTenant((tx) =>
        tx
          .update(memberships)
          .set({ role: request.body.papel })
          .where(
            and(
              eq(memberships.tenantId, request.empresa!.id),
              eq(memberships.userId, request.params.id),
            ),
          )
          .returning({ id: memberships.id }),
      );
      if (linhas.length === 0) throw ErroApi.de('nao_encontrado', 'Membro não encontrado.');
      return reply.code(204).send(null);
    },
  );

  app.delete(
    '/empresas/atual/usuarios/:id',
    {
      preHandler: pre,
      schema: {
        tags: ['admin'],
        summary: 'Remove um membro da empresa (a conta continua existindo)',
        security: seguranca,
        headers: cabecalhos,
        params: z.object({ id: z.uuid() }),
        response: { 204: z.null(), ...erros },
      },
    },
    async (request, reply) => {
      naoSiMesmo(request.params.id, request.usuario!.id);
      const linhas = await request.comTenant((tx) =>
        tx
          .delete(memberships)
          .where(
            and(
              eq(memberships.tenantId, request.empresa!.id),
              eq(memberships.userId, request.params.id),
            ),
          )
          .returning({ id: memberships.id }),
      );
      if (linhas.length === 0) throw ErroApi.de('nao_encontrado', 'Membro não encontrado.');
      return reply.code(204).send(null);
    },
  );
};
