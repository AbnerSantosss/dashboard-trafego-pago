/**
 * Conta do usuário: login por senha, perfil (nome e sobrenome), troca de senha, redefinição por
 * e-mail e aceite de convite. As rotas públicas têm limite de taxa próprio.
 */
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { emitirToken, listarEmpresas } from '../auth/plugin.js';
import { comTenant, invites, memberships, ROLES, tenants, users } from '../db/client.js';
import { ErroApi, schemaRespostaErro } from '../erros.js';
import { htmlComBotao, type EnviadorEmail } from './email.js';
import {
  conferirSenha,
  criarTokenRedefinicao,
  gerarHashSenha,
  lerTokenRedefinicao,
  SENHA_MINIMA,
  sha256,
  tenantDoTokenConvite,
  versaoSenha,
} from './senha.js';

const schemaEmpresa = z.object({
  id: z.uuid(),
  slug: z.string(),
  nome: z.string(),
  papel: z.enum(ROLES),
});
export const schemaUsuario = z.object({
  id: z.uuid(),
  email: z.string(),
  nome: z.string(),
  sobrenome: z.string(),
});
type UsuarioConta = z.infer<typeof schemaUsuario>;
export const schemaSessao = z.object({
  token: z.string().describe('JWT de 12 h com a claim tenant da primeira empresa'),
  usuario: schemaUsuario,
  empresas: z.array(schemaEmpresa),
});

export const schemaSenha = z
  .string()
  .min(SENHA_MINIMA, `no mínimo ${SENHA_MINIMA} caracteres`)
  .max(200, 'no máximo 200 caracteres');
const nome = z.string().trim().min(1, 'obrigatório').max(80, 'no máximo 80 caracteres');
const sobrenome = z.string().trim().max(120, 'no máximo 120 caracteres');

export const camposUsuario = {
  id: users.id,
  email: users.email,
  nome: users.nome,
  sobrenome: users.sobrenome,
};

export interface OpcoesConta {
  email: EnviadorEmail;
  webUrl: string;
  segredo: string;
}

/** Só os campos públicos (nunca o hash da senha). */
const publico = (u: UsuarioConta): UsuarioConta => ({
  id: u.id,
  email: u.email,
  nome: u.nome,
  sobrenome: u.sobrenome,
});

async function sessao(app: FastifyInstance, usuario: UsuarioConta, tenant?: string) {
  const empresas = await listarEmpresas(app.db, usuario.id);
  const ativa = tenant ?? empresas[0]?.id;
  const token = emitirToken(app, {
    sub: usuario.id,
    email: usuario.email,
    ...(ativa ? { tenant: ativa } : {}),
  });
  return { token, usuario, empresas };
}

const limitePublico = { rateLimit: { max: 10, timeWindow: '1 minute' } };
const porEmail = (alvo: string) => sql`lower(${users.email}) = ${alvo.trim().toLowerCase()}`;

export const rotasConta: FastifyPluginAsyncZod<OpcoesConta> = async (app, opcoes) => {
  const erros = { 400: schemaRespostaErro, 401: schemaRespostaErro, 429: schemaRespostaErro };

  app.post(
    '/auth/login',
    {
      config: limitePublico,
      schema: {
        tags: ['conta'],
        summary: 'Login por e-mail e senha',
        body: z.object({ email: z.string().max(320), senha: z.string().max(200) }),
        response: { 200: schemaSessao, ...erros },
      },
    },
    async (request) => {
      const [u] = await app.db
        .select({ ...camposUsuario, senhaHash: users.senhaHash })
        .from(users)
        .where(porEmail(request.body.email))
        .limit(1);
      const ok = await conferirSenha(request.body.senha, u?.senhaHash ?? null);
      if (!u || !ok) throw ErroApi.de('nao_autenticado', 'E-mail ou senha incorretos.');
      return sessao(app, publico(u));
    },
  );

  app.post(
    '/auth/recuperar',
    {
      config: limitePublico,
      schema: {
        tags: ['conta'],
        summary: 'Envia por e-mail um link para definir ou redefinir a senha',
        description: 'Responde 204 sempre, exista ou não o e-mail (não revela cadastros).',
        body: z.object({ email: z.string().max(320) }),
        response: { 204: z.null(), ...erros },
      },
    },
    async (request, reply) => {
      const [u] = await app.db
        .select({ id: users.id, email: users.email, nome: users.nome, senhaHash: users.senhaHash })
        .from(users)
        .where(porEmail(request.body.email))
        .limit(1);
      if (u) {
        const token = criarTokenRedefinicao(opcoes.segredo, {
          userId: u.id,
          senhaHash: u.senhaHash,
        });
        const link = `${opcoes.webUrl}/redefinir?token=${encodeURIComponent(token)}`;
        const enviado = await opcoes.email.enviar({
          para: u.email,
          assunto: 'Defina sua senha do painel',
          texto: `Olá, ${u.nome}. Para definir sua senha, abra: ${link}\nO link vale por 1 hora.`,
          html: htmlComBotao(
            'Defina sua senha',
            `Olá, ${u.nome}. O link vale por 1 hora.`,
            'Definir senha',
            link,
          ),
        });
        // Sem SMTP, só fora de produção: o link vai para o log local.
        if (!enviado && process.env.NODE_ENV !== 'production') {
          request.log.warn({ link }, 'e-mail não enviado; link de redefinição (só dev)');
        }
      }
      return reply.code(204).send(null);
    },
  );

  app.post(
    '/auth/redefinir',
    {
      config: limitePublico,
      schema: {
        tags: ['conta'],
        summary: 'Define a senha a partir do link enviado por e-mail',
        body: z.object({ token: z.string().max(1000), senha: schemaSenha }),
        response: { 200: schemaSessao, ...erros },
      },
    },
    async (request) => {
      const dados = lerTokenRedefinicao(opcoes.segredo, request.body.token);
      const [u] = dados
        ? await app.db
            .select({ ...camposUsuario, senhaHash: users.senhaHash })
            .from(users)
            .where(eq(users.id, dados.userId))
            .limit(1)
        : [];
      if (!dados || !u || versaoSenha(u.senhaHash) !== dados.versao) {
        throw ErroApi.de('token_invalido', 'Link inválido ou expirado. Peça outro.');
      }
      await app.db
        .update(users)
        .set({ senhaHash: await gerarHashSenha(request.body.senha), updatedAt: new Date() })
        .where(eq(users.id, u.id));
      return sessao(app, publico(u));
    },
  );

  app.patch(
    '/me',
    {
      preHandler: app.autenticar,
      schema: {
        tags: ['conta'],
        summary: 'Atualiza nome, sobrenome e/ou senha do próprio usuário',
        description: 'Para trocar a senha, envie `senhaAtual` e `novaSenha`.',
        security: [{ bearerAuth: [] }],
        body: z.object({
          nome: nome.optional(),
          sobrenome: sobrenome.optional(),
          senhaAtual: z.string().max(200).optional(),
          novaSenha: schemaSenha.optional(),
        }),
        response: { 200: z.object({ usuario: schemaUsuario }), 403: schemaRespostaErro, ...erros },
      },
    },
    async (request) => {
      const id = request.usuario!.id;
      const b = request.body;
      const mudancas: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
      if (b.nome !== undefined) mudancas.nome = b.nome;
      if (b.sobrenome !== undefined) mudancas.sobrenome = b.sobrenome;
      if (b.novaSenha !== undefined) {
        const [atual] = await app.db
          .select({ senhaHash: users.senhaHash })
          .from(users)
          .where(eq(users.id, id));
        if (atual?.senhaHash && !(await conferirSenha(b.senhaAtual ?? '', atual.senhaHash))) {
          throw ErroApi.de('acesso_negado', 'Senha atual incorreta.');
        }
        mudancas.senhaHash = await gerarHashSenha(b.novaSenha);
      }
      const [usuario] = await app.db
        .update(users)
        .set(mudancas)
        .where(eq(users.id, id))
        .returning(camposUsuario);
      if (!usuario) throw ErroApi.de('token_invalido', 'Usuário do token não existe.');
      return { usuario };
    },
  );

  // --- Convite (público, pelo token do e-mail) ---------------------------------------------

  const schemaConvitePublico = z.object({
    empresa: z.string(),
    email: z.string(),
    papel: z.enum(ROLES),
    jaTemSenha: z.boolean().describe('O e-mail já tem conta com senha: o aceite pede essa senha'),
  });

  async function abrirConvite(token: string) {
    const tenantId = tenantDoTokenConvite(token);
    if (!tenantId) return null;
    return comTenant(app.db, tenantId, async (tx) => {
      const [c] = await tx
        .select({
          id: invites.id,
          tenantId: invites.tenantId,
          email: invites.email,
          papel: invites.role,
          empresa: tenants.nome,
        })
        .from(invites)
        .innerJoin(tenants, eq(tenants.id, invites.tenantId))
        .where(
          and(
            eq(invites.tokenHash, sha256(token)),
            isNull(invites.aceitoEm),
            gt(invites.expiraEm, new Date()),
          ),
        )
        .limit(1);
      return c ?? null;
    });
  }

  const paramsToken = z.object({ token: z.string().min(10).max(200) });
  const naoAchou = () => ErroApi.de('nao_encontrado', 'Convite inválido, expirado ou já usado.');

  app.get(
    '/convites/:token',
    {
      config: limitePublico,
      schema: {
        tags: ['conta'],
        summary: 'Dados do convite (público, pelo token do e-mail)',
        params: paramsToken,
        response: { 200: schemaConvitePublico, 404: schemaRespostaErro, ...erros },
      },
    },
    async (request) => {
      const c = await abrirConvite(request.params.token);
      if (!c) throw naoAchou();
      const [u] = await app.db
        .select({ senhaHash: users.senhaHash })
        .from(users)
        .where(porEmail(c.email))
        .limit(1);
      return { empresa: c.empresa, email: c.email, papel: c.papel, jaTemSenha: !!u?.senhaHash };
    },
  );

  app.post(
    '/convites/:token/aceitar',
    {
      config: limitePublico,
      schema: {
        tags: ['conta'],
        summary: 'Aceita o convite: cria a conta (ou confere a senha) e entra na empresa',
        params: paramsToken,
        body: z.object({ nome, sobrenome: sobrenome.default(''), senha: schemaSenha }),
        response: { 200: schemaSessao, 404: schemaRespostaErro, ...erros },
      },
    },
    async (request) => {
      const c = await abrirConvite(request.params.token);
      if (!c) throw naoAchou();
      const b = request.body;
      const usuario = await comTenant(app.db, c.tenantId, async (tx): Promise<UsuarioConta> => {
        const [existente] = await tx
          .select({ ...camposUsuario, senhaHash: users.senhaHash })
          .from(users)
          .where(porEmail(c.email))
          .limit(1);
        let u: UsuarioConta | undefined;
        if (existente?.senhaHash) {
          if (!(await conferirSenha(b.senha, existente.senhaHash))) {
            throw ErroApi.de('nao_autenticado', 'Este e-mail já tem conta: use a senha dela.');
          }
          u = publico(existente);
        } else {
          const dados = {
            nome: b.nome,
            sobrenome: b.sobrenome,
            senhaHash: await gerarHashSenha(b.senha),
          };
          [u] = existente
            ? await tx
                .update(users)
                .set({ ...dados, updatedAt: new Date() })
                .where(eq(users.id, existente.id))
                .returning(camposUsuario)
            : await tx
                .insert(users)
                .values({ email: c.email, ...dados })
                .returning(camposUsuario);
        }
        if (!u) throw ErroApi.de('erro_interno', 'Falha ao gravar o usuário do convite.');
        await tx
          .insert(memberships)
          .values({ tenantId: c.tenantId, userId: u.id, role: c.papel })
          .onConflictDoUpdate({
            target: [memberships.tenantId, memberships.userId],
            set: { role: c.papel },
          });
        await tx.update(invites).set({ aceitoEm: new Date() }).where(eq(invites.id, c.id));
        return u;
      });
      // A sessão nasce na empresa do convite.
      return sessao(app, usuario, c.tenantId);
    },
  );
};
