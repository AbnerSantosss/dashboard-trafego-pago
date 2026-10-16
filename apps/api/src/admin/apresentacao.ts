/**
 * P5.1 — Apresentação da empresa ativa (nome exibido e logo). Papel `admin`, leitura/escrita sob RLS.
 * Contrato: `packages/contratos/src/admin.ts`.
 */
import { LOGO_TIPOS, NOME_EXIBICAO_MAXIMO, type ApresentacaoResposta } from '@trafego/contratos';
import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { presentation, tenants } from '../db/client.js';
import { schemaRespostaErro } from '../erros.js';
import { limparCacheMetricas } from '../metricas/cache.js';
import { validarLogo } from './logo.js';

/** Logo padrão por slug de empresa (arquivos servidos pelo web em `/brand`). */
const LOGO_PADRAO: Record<string, string> = { pasio: '/brand/pasio-logo.png' };

export const schemaApresentacao = z.object({
  nomeExibicao: z.string(),
  logoUrl: z.string().nullable(),
  logoPadraoUrl: z.string().nullable(),
  atualizadoEm: z.string().nullable(),
});

export const schemaApresentacaoPatch = z.object({
  nomeExibicao: z
    .string()
    .trim()
    .min(1, 'não pode ser vazio')
    .max(NOME_EXIBICAO_MAXIMO, `no máximo ${NOME_EXIBICAO_MAXIMO} caracteres`)
    .optional(),
  logo: z
    .object({ tipo: z.enum(LOGO_TIPOS), base64: z.string() })
    .nullable()
    .optional(),
});

const seguranca = [{ bearerAuth: [] }];
const cabecalhos = z.object({ 'x-tenant': z.string().optional() });

async function ler(request: FastifyRequest): Promise<ApresentacaoResposta> {
  const empresa = request.empresa!;
  const [linha] = await request.comTenant((tx) =>
    tx
      .select({
        nomeExibicao: presentation.nomeExibicao,
        logoUrl: presentation.logoUrl,
        atualizadoEm: presentation.updatedAt,
      })
      .from(presentation)
      .limit(1),
  );
  const [t] = await request.server.db
    .select({ slug: tenants.slug, nome: tenants.nome })
    .from(tenants)
    .where(eq(tenants.id, empresa.id))
    .limit(1);
  return {
    nomeExibicao: linha?.nomeExibicao ?? t?.nome ?? empresa.nome,
    logoUrl: linha?.logoUrl ?? null,
    logoPadraoUrl: LOGO_PADRAO[t?.slug ?? empresa.slug] ?? null,
    atualizadoEm: linha?.atualizadoEm?.toISOString() ?? null,
  };
}

export const rotasApresentacao: FastifyPluginAsyncZod = async (app) => {
  const erros = {
    400: schemaRespostaErro,
    401: schemaRespostaErro,
    403: schemaRespostaErro,
  };

  app.get(
    '/empresas/atual/apresentacao',
    {
      preHandler: [app.exigirEmpresa, app.exigirPapel('admin')],
      schema: {
        tags: ['admin'],
        summary: 'Nome exibido e logo da empresa ativa',
        security: seguranca,
        headers: cabecalhos,
        response: { 200: schemaApresentacao, ...erros },
      },
    },
    async (request) => ler(request),
  );

  app.patch(
    '/empresas/atual/apresentacao',
    {
      preHandler: [app.exigirEmpresa, app.exigirPapel('admin')],
      schema: {
        tags: ['admin'],
        summary: 'Altera nome exibido e/ou logo',
        description:
          'Campos ausentes não mudam. `logo: null` remove o logo enviado. Logo PNG ou SVG em base64 ' +
          '(sem prefixo data:), até 512 KB decodificado (413 logo_grande); conteúdo inválido ou SVG ' +
          'com script/eventos/javascript:/foreignObject → 422 logo_invalido.',
        security: seguranca,
        headers: cabecalhos,
        body: schemaApresentacaoPatch,
        response: {
          200: schemaApresentacao,
          ...erros,
          413: schemaRespostaErro,
          422: schemaRespostaErro,
        },
      },
    },
    async (request) => {
      const empresa = request.empresa!;
      const { nomeExibicao, logo } = request.body;
      const mudancas: { nomeExibicao?: string; logoUrl?: string | null } = {};
      if (nomeExibicao !== undefined) mudancas.nomeExibicao = nomeExibicao;
      if (logo !== undefined)
        mudancas.logoUrl = logo === null ? null : validarLogo(logo.tipo, logo.base64);

      if (Object.keys(mudancas).length > 0) {
        await request.comTenant(async (tx) => {
          const atualizadas = await tx
            .update(presentation)
            .set({ ...mudancas, updatedAt: new Date() })
            .returning({ id: presentation.id });
          if (atualizadas.length === 0) {
            const [t] = await tx
              .select({ nome: tenants.nome })
              .from(tenants)
              .where(eq(tenants.id, empresa.id));
            await tx.insert(presentation).values({
              tenantId: empresa.id,
              nomeExibicao: mudancas.nomeExibicao ?? t?.nome ?? empresa.nome,
              logoUrl: mudancas.logoUrl ?? null,
            });
          }
        });
        limparCacheMetricas(empresa.id);
        request.log.info(
          { tenant: empresa.slug, campos: Object.keys(mudancas) },
          'apresentação atualizada',
        );
      }
      return ler(request);
    },
  );
};
