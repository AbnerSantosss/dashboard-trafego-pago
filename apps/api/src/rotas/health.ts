import { z } from 'zod';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ErroApi, schemaRespostaErro } from '../erros.js';

export const schemaHealth = z.object({
  status: z.literal('ok'),
  service: z.literal('api'),
  versao: z.string(),
  uptime: z.number().describe('Segundos desde a subida do processo'),
});

export const schemaReady = z.object({ status: z.literal('ok'), banco: z.literal('ok') });

const TEMPO_LIMITE_READY_MS = 3000;

export const rotasHealth: FastifyPluginAsyncZod<{ versao: string }> = async (app, opcoes) => {
  app.get(
    '/health',
    {
      // O healthcheck do contêiner chama a cada 10 s: sem log por requisição, para não encher o log.
      logLevel: 'warn',
      schema: {
        tags: ['infra'],
        summary: 'Healthcheck',
        description: 'Liveness da API. Não consulta o banco (a prontidão é GET /ready).',
        response: { 200: schemaHealth },
      },
    },
    async () => ({
      status: 'ok' as const,
      service: 'api' as const,
      versao: opcoes.versao,
      uptime: process.uptime(),
    }),
  );

  app.get(
    '/ready',
    {
      schema: {
        tags: ['infra'],
        summary: 'Prontidão',
        description:
          'Executa select 1 no Postgres. 503 servico_indisponivel se o banco não responder.',
        response: { 200: schemaReady, 503: schemaRespostaErro },
      },
    },
    async (request) => {
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          app.db.execute(sql`select 1`),
          new Promise((_, rejeitar) => {
            timer = setTimeout(() => rejeitar(new Error('timeout')), TEMPO_LIMITE_READY_MS);
          }),
        ]);
      } catch (erro) {
        request.log.warn({ err: erro }, 'banco indisponível no /ready');
        throw ErroApi.de('servico_indisponivel', 'Banco de dados indisponível.');
      } finally {
        clearTimeout(timer);
      }
      return { status: 'ok' as const, banco: 'ok' as const };
    },
  );
};
