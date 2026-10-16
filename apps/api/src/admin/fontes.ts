/**
 * P5.2 — Fontes de webhook da empresa ativa e rotação de segredo. Papel `admin`, sob RLS.
 * O segredo em claro só existe na resposta de criação/rotação: o banco guarda `secret_hash`
 * (scrypt) e `secret_enc` (AES-256-GCM). Nada disso é logado: o logger do Fastify não serializa
 * corpos de resposta, e os logs destas rotas só levam slugs.
 */
import { randomBytes } from 'node:crypto';
import type { FonteResumo } from '@trafego/contratos';
import { asc, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sources, type Fonte } from '../db/client.js';
import { hashSegredo } from '../db/seed.js';
import { ErroApi, schemaRespostaErro } from '../erros.js';
import { cifrar } from './cifra.js';

export interface OpcoesFontes {
  /** Chave AES-256-GCM (32 bytes) de `secret_enc`. */
  chaveCifra: Buffer;
  /** Mapa `empresa/fonte → segredo` de WEBHOOK_SEGREDOS (só para `segredoUtilizavel`). */
  mapaSegredos: Record<string, string>;
}

export const schemaFonte = z.object({
  id: z.uuid(),
  slug: z.string(),
  nome: z.string(),
  ativo: z.boolean(),
  caminho: z.string(),
  segredoUtilizavel: z.boolean(),
  criadoEm: z.string(),
  atualizadoEm: z.string().nullable(),
});
export const schemaFontes = z.object({ fontes: z.array(schemaFonte) });
export const schemaFonteComSegredo = z.object({ fonte: schemaFonte, segredo: z.string() });

const schemaNome = z.string().trim().min(1, 'não pode ser vazio').max(120);
export const schemaFonteCriar = z.object({
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'use kebab-case: letras minúsculas, números e hífen'),
  nome: schemaNome,
});
export const schemaFonteAtualizar = z.object({
  nome: schemaNome.optional(),
  ativo: z.boolean().optional(),
});
const schemaParams = z.object({ id: z.uuid() });

const seguranca = [{ bearerAuth: [] }];
const cabecalhos = z.object({ 'x-tenant': z.string().optional() });
const naoEncontrada = () => ErroApi.de('fonte_nao_encontrada', 'Fonte não encontrada.');

/** Gera um segredo novo e os dois campos gravados no banco. */
function novoSegredo(chave: Buffer) {
  const segredo = randomBytes(32).toString('base64url');
  return { segredo, secretHash: hashSegredo(segredo), secretEnc: cifrar(segredo, chave) };
}

/** Violação de unicidade do Postgres (23505), mesmo embrulhada pelo drizzle em `cause`. */
function violouUnico(erro: unknown): boolean {
  let e = erro as { code?: string; cause?: unknown } | undefined;
  for (let i = 0; e && i < 5; i++) {
    if (e.code === '23505') return true;
    e = e.cause as typeof e;
  }
  return false;
}

export const rotasFontes: FastifyPluginAsyncZod<OpcoesFontes> = async (app, opcoes) => {
  const pre = [app.exigirEmpresa, app.exigirPapel('admin')];
  const erros = { 400: schemaRespostaErro, 401: schemaRespostaErro, 403: schemaRespostaErro };

  function resumo(request: FastifyRequest, f: Fonte): FonteResumo {
    const empresa = request.empresa!.slug;
    return {
      id: f.id,
      slug: f.slug,
      nome: f.nome,
      ativo: f.ativo,
      caminho: `/webhooks/${empresa}/${f.slug}`,
      segredoUtilizavel:
        f.secretEnc != null || Boolean(opcoes.mapaSegredos[`${empresa}/${f.slug}`]),
      criadoEm: f.createdAt.toISOString(),
      atualizadoEm: f.updatedAt?.toISOString() ?? null,
    };
  }

  app.get(
    '/empresas/atual/fontes',
    {
      preHandler: pre,
      schema: {
        tags: ['admin'],
        summary: 'Fontes de webhook da empresa ativa',
        security: seguranca,
        headers: cabecalhos,
        response: { 200: schemaFontes, ...erros },
      },
    },
    async (request) => {
      const linhas = await request.comTenant((tx) =>
        tx.select().from(sources).orderBy(asc(sources.createdAt), asc(sources.slug)),
      );
      return { fontes: linhas.map((f) => resumo(request, f)) };
    },
  );

  app.post(
    '/empresas/atual/fontes',
    {
      preHandler: pre,
      schema: {
        tags: ['admin'],
        summary: 'Cria uma fonte e devolve o segredo (uma única vez)',
        description: '409 fonte_existente se o slug já existir na empresa.',
        security: seguranca,
        headers: cabecalhos,
        body: schemaFonteCriar,
        response: { 201: schemaFonteComSegredo, ...erros, 409: schemaRespostaErro },
      },
    },
    async (request, reply) => {
      const empresa = request.empresa!;
      const { segredo, secretHash, secretEnc } = novoSegredo(opcoes.chaveCifra);
      let criada: Fonte | undefined;
      try {
        [criada] = await request.comTenant((tx) =>
          tx
            .insert(sources)
            .values({
              tenantId: empresa.id,
              slug: request.body.slug,
              nome: request.body.nome,
              secretHash,
              secretEnc,
            })
            .returning(),
        );
      } catch (erro) {
        if (violouUnico(erro)) {
          throw ErroApi.de('fonte_existente', 'Já existe uma fonte com este slug.', {
            slug: request.body.slug,
          });
        }
        throw erro;
      }
      request.log.info({ tenant: empresa.slug, fonte: criada!.slug }, 'fonte criada');
      return reply.status(201).send({ fonte: resumo(request, criada!), segredo });
    },
  );

  app.patch(
    '/empresas/atual/fontes/:id',
    {
      preHandler: pre,
      schema: {
        tags: ['admin'],
        summary: 'Renomeia ou ativa/desativa uma fonte',
        security: seguranca,
        headers: cabecalhos,
        params: schemaParams,
        body: schemaFonteAtualizar,
        response: { 200: schemaFonte, ...erros, 404: schemaRespostaErro },
      },
    },
    async (request) => {
      const { nome, ativo } = request.body;
      const [linha] = await request.comTenant((tx) =>
        tx
          .update(sources)
          .set({
            ...(nome !== undefined ? { nome } : {}),
            ...(ativo !== undefined ? { ativo } : {}),
            updatedAt: new Date(),
          })
          .where(eq(sources.id, request.params.id))
          .returning(),
      );
      if (!linha) throw naoEncontrada();
      return resumo(request, linha);
    },
  );

  app.post(
    '/empresas/atual/fontes/:id/segredo',
    {
      preHandler: pre,
      schema: {
        tags: ['admin'],
        summary: 'Rotaciona o segredo da fonte (devolvido uma única vez)',
        description: 'O segredo anterior deixa de valer imediatamente.',
        security: seguranca,
        headers: cabecalhos,
        params: schemaParams,
        response: { 200: schemaFonteComSegredo, ...erros, 404: schemaRespostaErro },
      },
    },
    async (request) => {
      const { segredo, secretHash, secretEnc } = novoSegredo(opcoes.chaveCifra);
      const [linha] = await request.comTenant((tx) =>
        tx
          .update(sources)
          .set({ secretHash, secretEnc, updatedAt: new Date() })
          .where(eq(sources.id, request.params.id))
          .returning(),
      );
      if (!linha) throw naoEncontrada();
      // O cache de WEBHOOK_SEGREDOS é chaveado por `sourceId|secret_hash`: o hash novo o invalida;
      // o segredo do banco não tem cache (é decifrado a cada entrega).
      request.log.info({ tenant: request.empresa!.slug, fonte: linha.slug }, 'segredo rotacionado');
      return { fonte: resumo(request, linha), segredo };
    },
  );
};
