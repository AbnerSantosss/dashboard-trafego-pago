/**
 * Métricas (P4.8). Contrato fixo em `@trafego/contratos` (metricas.ts); doc em docs/metricas.md.
 */
import type { VisaoGeralResposta } from '@trafego/contratos';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { schemaRespostaErro } from '../erros.js';
import { chaveCache, gravarCache, lerCache, TTL_CACHE_MS } from '../metricas/cache.js';
import { consultarVisaoGeral } from '../metricas/consulta.js';

const dataIso = z.iso.date().describe('AAAA-MM-DD, inclusivo, no fuso da empresa');

export const schemaVisaoGeralQuery = z.object({
  de: dataIso.optional(),
  ate: dataIso.optional(),
  comparar: z.enum(['anterior', 'nenhum']).default('anterior'),
  canal: z.string().min(1).max(200).default('todos'),
  campanha: z.string().min(1).max(300).default('todas'),
});

const periodo = z.object({ de: z.string(), ate: z.string() });
const numeroOuNulo = z.number().nullable();
const kpiId = z.enum(['investimento', 'ftds', 'cpa', 'depositos', 'roas']);

const linhaCanal = z.object({
  canal: z.string(),
  cor: z.string().nullable(),
  investimento: numeroOuNulo,
  cliques: z.number(),
  visitas: z.number(),
  cadastros: z.number(),
  ftdsQtd: z.number(),
  ftdsValor: z.number(),
  depositos: z.number(),
  cpa: numeroOuNulo,
  roas: numeroOuNulo,
});

export const schemaVisaoGeralResposta = z.object({
  periodo,
  comparacao: periodo.nullable(),
  atualizadoEm: z.string().nullable(),
  apresentacao: z.object({
    nomeExibicao: z.string(),
    logoUrl: z.string().nullable(),
    subtitulo: z.string().nullable(),
    kpis: z.array(kpiId),
    columns: z.array(z.string()),
    channels: z.array(z.object({ canal: z.string(), cor: z.string(), ordem: z.number() })),
    palette: z.record(z.string(), z.string()),
    currency: z.string(),
    timezone: z.string(),
  }),
  kpis: z.array(
    z.object({
      id: kpiId,
      valor: numeroOuNulo,
      valorAnterior: numeroOuNulo,
      variacaoPct: numeroOuNulo,
      sparkline: z.array(z.number()),
    }),
  ),
  funil: z.array(
    z.object({
      id: z.enum(['base', 'cliques', 'visitas', 'cadastro', 'ftd', 'redeposito']),
      valor: z.number(),
      taxaPct: numeroOuNulo,
    }),
  ),
  canais: z.array(linhaCanal),
  total: linhaCanal,
  opcoes: z.object({ canais: z.array(z.string()), campanhas: z.array(z.string()) }),
});

// Garante em tempo de compilação que o schema zod e o contrato não divergem.
type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _contratoConfere: Igual<z.infer<typeof schemaVisaoGeralResposta>, VisaoGeralResposta> = true;
void _contratoConfere;

export const rotasMetricas: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/metricas/visao-geral',
    {
      preHandler: app.exigirEmpresa,
      schema: {
        tags: ['metricas'],
        summary: 'Visão Geral: KPIs, funil e tabela por canal',
        description:
          'Qualquer papel. Lido sob RLS. Sem de/ate: 24 dias terminando no último dia com dados. ' +
          'Canais com prefixo __ nunca aparecem em kpis/canais/opcoes (só no funil). ' +
          'Cache em memória por instância, 15 s (Cache-Control: private, max-age=15).',
        security: [{ bearerAuth: [] }],
        headers: z.object({ 'x-tenant': z.string().optional() }),
        querystring: schemaVisaoGeralQuery,
        response: {
          200: schemaVisaoGeralResposta,
          400: schemaRespostaErro,
          401: schemaRespostaErro,
          403: schemaRespostaErro,
        },
      },
    },
    async (request, reply) => {
      const empresa = request.empresa!;
      const chave = chaveCache(empresa.id, request.query);
      let resposta = lerCache<VisaoGeralResposta>(chave);
      if (!resposta) {
        resposta = await request.comTenant((tx) =>
          consultarVisaoGeral(tx, empresa.id, request.query),
        );
        gravarCache(chave, resposta);
      }
      reply.header('cache-control', `private, max-age=${TTL_CACHE_MS / 1000}`);
      return resposta;
    },
  );
};
