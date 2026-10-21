/**
 * Conta do usuário: login por senha, perfil (nome e sobrenome), troca de senha, redefinição por
 * e-mail, aceite de convite e a verificação em duas etapas opcional (conta/totp.ts). As rotas
 * públicas têm limite de taxa próprio, e quem confere senha ou código também tem bloqueio por
 * conta (conta/tentativas.ts).
 */
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { cifrar, decifrar } from '../admin/cifra.js';
import { emitirToken, listarEmpresas, VALIDADE_TOKEN_LEMBRAR } from '../auth/plugin.js';
import { comTenant, invites, memberships, ROLES, tenants, users } from '../db/client.js';
import { ErroApi, schemaRespostaErro } from '../erros.js';
import { htmlComBotao, type EnviadorEmail } from './email.js';
import { chaveConta, criarTentativas, type Tentativas } from './tentativas.js';
import { conferirTotp, gerarSegredoTotp, uriTotp } from './totp.js';
import {
  conferirSenha,
  criarTokenRedefinicao,
  gerarHashSenha,
  lerTokenRedefinicao,
  precisaRefazerHash,
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
  token: z
    .string()
    .describe('JWT de 12 h (30 dias com `lembrar`) com a claim tenant da primeira empresa'),
  usuario: schemaUsuario,
  empresas: z.array(schemaEmpresa),
});

/** Senha conferiu e o usuário tem duas etapas: a sessão sai em `POST /auth/duas-etapas`. */
const schemaDesafio = z.object({
  segundoFator: z.literal(true),
  desafio: z.string().describe('Vale 5 min; só serve para `POST /auth/duas-etapas`'),
});
const schemaEntrada = z.union([schemaSessao, schemaDesafio]);
/** Claims do desafio: sem `sub` nem `email`, o `autenticar` nunca o aceita como token de acesso. */
const schemaClaimsDesafio = z.object({
  etapa: z.literal('duas_etapas'),
  uid: z.uuid(),
  sv: z.string(),
  lembrar: z.boolean().optional(),
  tenant: z.uuid().optional(),
});
const codigo = z.string().max(20).describe('6 dígitos do app autenticador');

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
  /** Chave AES-256 do segredo da verificação em duas etapas (a mesma dos segredos de webhook). */
  chaveCifra: Buffer;
  /** Bloqueio por conta (testes injetam um com relógio próprio). Default: 10 falhas em 15 min. */
  tentativas?: Tentativas;
  /**
   * Bloqueio dos códigos de 6 dígitos, separado do da senha (acertar a senha não zera este).
   * Default: 5 falhas por hora.
   */
  tentativasCodigo?: Tentativas;
}

/** Só os campos públicos (nunca o hash da senha). */
const publico = (u: UsuarioConta): UsuarioConta => ({
  id: u.id,
  email: u.email,
  nome: u.nome,
  sobrenome: u.sobrenome,
});

async function sessao(
  app: FastifyInstance,
  usuario: UsuarioConta,
  senhaHash: string | null,
  opcoes: { tenant?: string; lembrar?: boolean } = {},
) {
  const empresas = await listarEmpresas(app.db, usuario.id);
  const ativa = opcoes.tenant ?? empresas[0]?.id;
  const token = emitirToken(
    app,
    {
      sub: usuario.id,
      email: usuario.email,
      ...(ativa ? { tenant: ativa } : {}),
      // Versão da senha: trocar a senha invalida este token (ver auth/plugin.ts).
      sv: versaoSenha(senhaHash),
    },
    opcoes.lembrar ? { expiresIn: VALIDADE_TOKEN_LEMBRAR } : {},
  );
  return { token, usuario, empresas };
}

const limitePublico = { rateLimit: { max: 10, timeWindow: '1 minute' } };

/** Mesma resposta exista ou não a conta, para o bloqueio não revelar quem tem cadastro. */
function erroBloqueio(ms: number): ErroApi {
  const minutos = Math.max(1, Math.ceil(ms / 60_000));
  return ErroApi.de(
    'limite_excedido',
    `Muitas tentativas com este e-mail. Tente de novo em ${minutos} min ou redefina a senha.`,
  );
}
const porEmail = (alvo: string) => sql`lower(${users.email}) = ${alvo.trim().toLowerCase()}`;

export const rotasConta: FastifyPluginAsyncZod<OpcoesConta> = async (app, opcoes) => {
  const erros = { 400: schemaRespostaErro, 401: schemaRespostaErro, 429: schemaRespostaErro };
  const tentativas = opcoes.tentativas ?? criarTentativas({ maxFalhas: 10 });
  const tentativasCodigo =
    opcoes.tentativasCodigo ?? criarTentativas({ maxFalhas: 5, janelaMs: 60 * 60_000 });

  /**
   * Abre a sessão ou, com a verificação em duas etapas ativa, devolve o desafio que
   * `POST /auth/duas-etapas` troca pela sessão junto com o código do app.
   */
  async function entrada(
    usuario: UsuarioConta,
    senhaHash: string | null,
    totpAtivoEm: Date | null,
    extra: { tenant?: string; lembrar?: boolean } = {},
  ) {
    if (!totpAtivoEm) return sessao(app, usuario, senhaHash, extra);
    const claims = {
      etapa: 'duas_etapas' as const,
      uid: usuario.id,
      sv: versaoSenha(senhaHash),
      ...(extra.lembrar ? { lembrar: true } : {}),
      ...(extra.tenant ? { tenant: extra.tenant } : {}),
    };
    // O payload tipado do @fastify/jwt é o do token de acesso; o desafio tem outro formato.
    const desafio = app.jwt.sign(claims as never, { expiresIn: '5m' });
    return { segundoFator: true as const, desafio };
  }

  /**
   * Confere o código do app com bloqueio próprio e grava o passo usado, de forma atômica: de dois
   * pedidos com o mesmo código, só um passa.
   */
  async function conferirCodigo(
    u: { id: string; totpSegredoEnc: string | null; totpUltimoPasso: number | null },
    valor: string,
  ): Promise<boolean> {
    const chave = `totp:${u.id}`;
    const espera = tentativasCodigo.bloqueio(chave);
    if (espera > 0) {
      const minutos = Math.max(1, Math.ceil(espera / 60_000));
      throw ErroApi.de(
        'limite_excedido',
        `Muitos códigos errados. Tente de novo em ${minutos} min.`,
      );
    }
    const segredo = u.totpSegredoEnc ? decifrar(u.totpSegredoEnc, opcoes.chaveCifra) : null;
    if (!segredo) {
      throw ErroApi.de(
        'erro_interno',
        'Não foi possível ler o segredo da verificação em duas etapas.',
      );
    }
    const passo = conferirTotp(segredo, valor, { ultimoPasso: u.totpUltimoPasso });
    const gravado =
      passo !== null &&
      (
        await app.db
          .update(users)
          .set({ totpUltimoPasso: passo })
          .where(
            and(
              eq(users.id, u.id),
              sql`(${users.totpUltimoPasso} is null or ${users.totpUltimoPasso} < ${passo})`,
            ),
          )
          .returning({ id: users.id })
      ).length > 0;
    if (gravado) tentativasCodigo.acertou(chave);
    else tentativasCodigo.falhou(chave);
    return gravado;
  }

  const camposTotp = {
    totpSegredoEnc: users.totpSegredoEnc,
    totpAtivoEm: users.totpAtivoEm,
    totpUltimoPasso: users.totpUltimoPasso,
  };

  /** Confere a senha com o bloqueio por conta: conta a falha e libera a chave no acerto. */
  async function conferirComBloqueio(email: string, senha: string, hash: string | null) {
    const chave = chaveConta(email);
    const espera = tentativas.bloqueio(chave);
    if (espera > 0) throw erroBloqueio(espera);
    const ok = await conferirSenha(senha, hash);
    if (ok) tentativas.acertou(chave);
    else tentativas.falhou(chave);
    return ok;
  }

  app.post(
    '/auth/login',
    {
      config: limitePublico,
      schema: {
        tags: ['conta'],
        summary: 'Login por e-mail e senha',
        body: z.object({
          email: z.string().max(320),
          senha: z.string().max(200),
          lembrar: z.boolean().optional().describe('Sessão de 30 dias em vez de 12 h'),
        }),
        response: { 200: schemaEntrada, ...erros },
      },
    },
    async (request) => {
      const [u] = await app.db
        .select({ ...camposUsuario, senhaHash: users.senhaHash, totpAtivoEm: users.totpAtivoEm })
        .from(users)
        .where(porEmail(request.body.email))
        .limit(1);
      const ok = await conferirComBloqueio(
        request.body.email,
        request.body.senha,
        u?.senhaHash ?? null,
      );
      if (!u || !ok) throw ErroApi.de('nao_autenticado', 'E-mail ou senha incorretos.');
      let senhaHash = u.senhaHash;
      if (precisaRefazerHash(senhaHash)) {
        // Hash legado (scrypt) ou fraco: refaz em Argon2id agora que a senha em claro está aqui.
        senhaHash = await gerarHashSenha(request.body.senha);
        await app.db.update(users).set({ senhaHash }).where(eq(users.id, u.id));
      }
      return entrada(publico(u), senhaHash, u.totpAtivoEm, {
        lembrar: request.body.lembrar === true,
      });
    },
  );

  app.post(
    '/auth/duas-etapas',
    {
      config: limitePublico,
      schema: {
        tags: ['conta'],
        summary: 'Troca o desafio do login e o código do app autenticador pela sessão',
        body: z.object({ desafio: z.string().max(2000), codigo }),
        response: { 200: schemaSessao, ...erros },
      },
    },
    async (request) => {
      let claims: z.infer<typeof schemaClaimsDesafio> | null = null;
      try {
        const lido = schemaClaimsDesafio.safeParse(app.jwt.verify(request.body.desafio));
        if (lido.success) claims = lido.data;
      } catch {
        // vencido ou adulterado: mesma resposta abaixo
      }
      const vencido = () =>
        ErroApi.de('token_invalido', 'A verificação expirou. Entre de novo com e-mail e senha.');
      if (!claims) throw vencido();
      const [u] = await app.db
        .select({ ...camposUsuario, senhaHash: users.senhaHash, ...camposTotp })
        .from(users)
        .where(eq(users.id, claims.uid))
        .limit(1);
      // A senha mudou ou a verificação foi desligada depois do desafio: ele não vale mais.
      if (!u || !u.totpAtivoEm || versaoSenha(u.senhaHash) !== claims.sv) throw vencido();
      if (!(await conferirCodigo(u, request.body.codigo))) {
        throw ErroApi.de('nao_autenticado', 'Código incorreto.');
      }
      return sessao(app, publico(u), u.senhaHash, {
        ...(claims.tenant ? { tenant: claims.tenant } : {}),
        ...(claims.lembrar ? { lembrar: true } : {}),
      });
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
        // Em segundo plano: a resposta é a mesma exista ou não o e-mail, então não espera o SMTP
        // (que pode demorar mais que os 4 s do web e ainda denunciaria pelo tempo quem tem conta).
        // A falha vai para o log com o motivo.
        void opcoes.email
          .enviar({
            para: u.email,
            assunto: 'Defina sua senha do painel',
            texto: `Olá, ${u.nome}. Para definir sua senha, abra: ${link}\nO link vale por 1 hora.`,
            html: htmlComBotao(
              'Defina sua senha',
              `Olá, ${u.nome}. O link vale por 1 hora.`,
              'Definir senha',
              link,
            ),
          })
          .catch((erro: unknown) => ({
            enviado: false as const,
            motivo: `Erro inesperado ao enviar o e-mail: ${(erro as Error)?.message ?? String(erro)}.`,
          }))
          .then((r) => {
            if (r.enviado) return;
            request.log.warn({ motivo: r.motivo }, 'e-mail de redefinição não enviado');
            // Sem SMTP, só fora de produção: o link vai para o log local.
            if (process.env.NODE_ENV !== 'production') {
              request.log.warn({ link }, 'link de redefinição (só dev)');
            }
          });
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
        response: { 200: schemaEntrada, ...erros },
      },
    },
    async (request) => {
      const dados = lerTokenRedefinicao(opcoes.segredo, request.body.token);
      const [u] = dados
        ? await app.db
            .select({
              ...camposUsuario,
              senhaHash: users.senhaHash,
              totpAtivoEm: users.totpAtivoEm,
            })
            .from(users)
            .where(eq(users.id, dados.userId))
            .limit(1)
        : [];
      if (!dados || !u || versaoSenha(u.senhaHash) !== dados.versao) {
        throw ErroApi.de('token_invalido', 'Link inválido ou expirado. Peça outro.');
      }
      const senhaHash = await gerarHashSenha(request.body.senha);
      await app.db
        .update(users)
        .set({ senhaHash, updatedAt: new Date() })
        .where(eq(users.id, u.id));
      // Quem redefiniu pelo e-mail é o dono: o bloqueio de quem tentava adivinhar acaba aqui.
      tentativas.acertou(chaveConta(u.email));
      // Com duas etapas, o link do e-mail troca a senha mas não abre sessão sem o código do app.
      return entrada(publico(u), senhaHash, u.totpAtivoEm);
    },
  );

  app.post(
    '/auth/sair',
    {
      preHandler: app.autenticar,
      schema: {
        tags: ['conta'],
        summary: 'Encerra as sessões do usuário',
        description:
          'Todo token deste usuário emitido até agora deixa de valer, em qualquer dispositivo.',
        security: [{ bearerAuth: [] }],
        response: { 204: z.null(), ...erros },
      },
    },
    async (request, reply) => {
      await app.db
        .update(users)
        .set({ sessoesDesde: new Date() })
        .where(eq(users.id, request.usuario!.id));
      return reply.code(204).send(null);
    },
  );

  app.patch(
    '/me',
    {
      preHandler: app.autenticar,
      // Confere a senha atual: mesmo limite das rotas públicas contra força bruta.
      config: limitePublico,
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
        response: {
          200: z.object({
            usuario: schemaUsuario,
            token: z
              .string()
              .optional()
              .describe('Novo JWT quando a senha muda (o anterior deixa de valer)'),
          }),
          403: schemaRespostaErro,
          ...erros,
        },
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
        if (
          atual?.senhaHash &&
          !(await conferirComBloqueio(request.usuario!.email, b.senhaAtual ?? '', atual.senhaHash))
        ) {
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
      if (!mudancas.senhaHash) return { usuario };
      // A troca de senha encerra as outras sessões; esta recebe um token novo com o mesmo prazo.
      const atual = request.user as { tenant?: string; exp?: number };
      const restante = atual.exp ? atual.exp - Math.floor(Date.now() / 1000) : 0;
      const token = emitirToken(
        app,
        {
          sub: usuario.id,
          email: usuario.email,
          ...(atual.tenant ? { tenant: atual.tenant } : {}),
          sv: versaoSenha(mudancas.senhaHash),
        },
        restante > 60 ? { expiresIn: restante } : {},
      );
      return { usuario, token };
    },
  );

  // --- Verificação em duas etapas (opcional, no perfil do próprio usuário) ------------------

  const conflito = (mensagem: string) => ErroApi.de('conflito', mensagem);
  const errosPerfil = { 403: schemaRespostaErro, 409: schemaRespostaErro, ...erros };

  async function carregarParaDuasEtapas(id: string) {
    const [u] = await app.db
      .select({ id: users.id, email: users.email, senhaHash: users.senhaHash, ...camposTotp })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!u) throw ErroApi.de('token_invalido', 'Usuário do token não existe.');
    return u;
  }

  app.post(
    '/me/duas-etapas/iniciar',
    {
      preHandler: app.autenticar,
      config: limitePublico,
      schema: {
        tags: ['conta'],
        summary: 'Gera o segredo do app autenticador (pendente até confirmar um código)',
        description:
          'Pede a senha atual. Devolve o segredo e a URI do QR; só passa a valer depois de ' +
          '`POST /me/duas-etapas/ativar`. Chamar de novo troca o segredo pendente.',
        security: [{ bearerAuth: [] }],
        body: z.object({ senhaAtual: z.string().max(200) }),
        response: {
          200: z.object({ segredo: z.string(), uri: z.string() }),
          ...errosPerfil,
        },
      },
    },
    async (request) => {
      const u = await carregarParaDuasEtapas(request.usuario!.id);
      if (u.totpAtivoEm) throw conflito('A verificação em duas etapas já está ativa.');
      if (!(await conferirComBloqueio(u.email, request.body.senhaAtual, u.senhaHash))) {
        throw ErroApi.de('acesso_negado', 'Senha atual incorreta.');
      }
      const segredo = gerarSegredoTotp();
      await app.db
        .update(users)
        .set({
          totpSegredoEnc: cifrar(segredo, opcoes.chaveCifra),
          totpUltimoPasso: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, u.id));
      return { segredo, uri: uriTotp(segredo, u.email) };
    },
  );

  app.post(
    '/me/duas-etapas/ativar',
    {
      preHandler: app.autenticar,
      config: limitePublico,
      schema: {
        tags: ['conta'],
        summary: 'Confirma o primeiro código do app e liga a verificação em duas etapas',
        security: [{ bearerAuth: [] }],
        body: z.object({ codigo }),
        response: { 204: z.null(), ...errosPerfil },
      },
    },
    async (request, reply) => {
      const u = await carregarParaDuasEtapas(request.usuario!.id);
      if (u.totpAtivoEm) throw conflito('A verificação em duas etapas já está ativa.');
      if (!u.totpSegredoEnc) throw conflito('Comece pelo QR code: gere o segredo de novo.');
      if (!(await conferirCodigo(u, request.body.codigo))) {
        throw ErroApi.de('acesso_negado', 'Código incorreto. Confira o app e tente de novo.');
      }
      await app.db
        .update(users)
        .set({ totpAtivoEm: new Date(), updatedAt: new Date() })
        .where(eq(users.id, u.id));
      return reply.code(204).send(null);
    },
  );

  app.post(
    '/me/duas-etapas/desativar',
    {
      preHandler: app.autenticar,
      config: limitePublico,
      schema: {
        tags: ['conta'],
        summary: 'Desliga a verificação em duas etapas (pede senha e código)',
        security: [{ bearerAuth: [] }],
        body: z.object({ senhaAtual: z.string().max(200), codigo }),
        response: { 204: z.null(), ...errosPerfil },
      },
    },
    async (request, reply) => {
      const u = await carregarParaDuasEtapas(request.usuario!.id);
      if (!u.totpAtivoEm) throw conflito('A verificação em duas etapas não está ativa.');
      if (!(await conferirComBloqueio(u.email, request.body.senhaAtual, u.senhaHash))) {
        throw ErroApi.de('acesso_negado', 'Senha atual incorreta.');
      }
      if (!(await conferirCodigo(u, request.body.codigo))) {
        throw ErroApi.de('acesso_negado', 'Código incorreto. Confira o app e tente de novo.');
      }
      await app.db
        .update(users)
        .set({
          totpSegredoEnc: null,
          totpAtivoEm: null,
          totpUltimoPasso: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, u.id));
      return reply.code(204).send(null);
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
        response: {
          200: schemaEntrada,
          404: schemaRespostaErro,
          409: schemaRespostaErro,
          ...erros,
        },
      },
    },
    async (request) => {
      const c = await abrirConvite(request.params.token);
      if (!c) throw naoAchou();
      const b = request.body;
      let senhaHash: string | null = null;
      let totpAtivoEm: Date | null = null;
      const usuario = await comTenant(app.db, c.tenantId, async (tx): Promise<UsuarioConta> => {
        const [existente] = await tx
          .select({ ...camposUsuario, senhaHash: users.senhaHash, totpAtivoEm: users.totpAtivoEm })
          .from(users)
          .where(porEmail(c.email))
          .limit(1);
        let u: UsuarioConta | undefined;
        if (existente?.senhaHash) {
          if (!(await conferirComBloqueio(c.email, b.senha, existente.senhaHash))) {
            throw ErroApi.de('nao_autenticado', 'Este e-mail já tem conta: use a senha dela.');
          }
          u = publico(existente);
          senhaHash = existente.senhaHash;
          totpAtivoEm = existente.totpAtivoEm;
        } else if (existente) {
          // Conta que existe e ainda não tem senha (ex.: admin criado no preparo). O link do
          // convite também chega a quem convidou, então ele nunca define a senha de uma conta
          // existente: o dono cria a senha pelo e-mail ("Esqueci minha senha") e aceita depois.
          throw ErroApi.de(
            'conflito',
            'Este e-mail já tem conta sem senha. Use "Esqueci minha senha" no login e abra o convite de novo.',
          );
        } else {
          senhaHash = await gerarHashSenha(b.senha);
          [u] = await tx
            .insert(users)
            .values({ email: c.email, nome: b.nome, sobrenome: b.sobrenome, senhaHash })
            .returning(camposUsuario);
        }
        if (!u) throw ErroApi.de('erro_interno', 'Falha ao gravar o usuário do convite.');
        // Marca o convite antes: de dois aceites ao mesmo tempo, só um passa.
        const marcado = await tx
          .update(invites)
          .set({ aceitoEm: new Date() })
          .where(and(eq(invites.id, c.id), isNull(invites.aceitoEm)))
          .returning({ id: invites.id });
        if (!marcado.length) throw naoAchou();
        // Quem já é membro mantém o papel que tem (o convite não rebaixa nem promove).
        await tx
          .insert(memberships)
          .values({ tenantId: c.tenantId, userId: u.id, role: c.papel })
          .onConflictDoNothing({ target: [memberships.tenantId, memberships.userId] });
        return u;
      });
      // A sessão nasce na empresa do convite.
      return entrada(usuario, senhaHash, totpAtivoEm, { tenant: c.tenantId });
    },
  );
};
