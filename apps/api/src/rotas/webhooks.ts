/**
 * Ingestão de webhooks (P3.1) e rotas administrativas da fonte (P3.6).
 *
 * - `POST /webhooks/:empresa/:fonte`: público, autenticado por HMAC (ver docs/webhooks.md).
 * - `POST /webhooks/:empresa/:fonte/reprocessar`: admin, enfileira o reprocessamento.
 * - `GET  /webhooks/:empresa/:fonte/entregas`: analista, últimas entregas sob RLS.
 */
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { comTenant, sources, tenants, webhookEvents } from '../db/client.js';
import { ErroApi, schemaRespostaErro } from '../erros.js';
import { assinaturaConfere, chaveEvento, timestampNaJanela } from '../webhooks/assinatura.js';
import type { Fila } from '../webhooks/fila.js';
import type { FonteResolvida, ObterSegredo } from '../webhooks/segredos.js';

export interface OpcoesWebhooks {
  fila: Fila;
  obterSegredo: ObterSegredo;
  /** Janela do X-Timestamp em segundos (padrão 300). */
  janelaSegundos: number;
  /** Requisições por minuto por fonte (padrão 600). */
  limitePorMinuto: number;
  /** Relógio injetável (testes). */
  agora?: () => number;
}

const slug = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'slug inválido');
export const schemaParamsWebhook = z.object({ empresa: slug, fonte: slug });

export const schemaAceito = z.object({
  id: z.uuid(),
  status: z.literal('recebido'),
});
export const schemaDuplicado = z.object({
  id: z.uuid().nullable(),
  duplicado: z.literal(true),
});
export const schemaReprocessar = z
  .object({
    de: z.iso.datetime({ offset: true }).optional(),
    ate: z.iso.datetime({ offset: true }).optional(),
  })
  .default({});
export const schemaReprocessarResposta = z.object({
  status: z.literal('enfileirado'),
  jobId: z.string().nullable(),
});
export const schemaEntrega = z.object({
  id: z.uuid(),
  eventKey: z.string(),
  status: z.enum(['recebido', 'processado', 'erro']),
  erro: z.string().nullable(),
  tentativas: z.number().int(),
  receivedAt: z.string(),
  processedAt: z.string().nullable(),
});
export const schemaEntregas = z.object({ entregas: z.array(schemaEntrega) });

/** Cabeçalhos guardados com o bruto. `x-signature` e `authorization` nunca entram. */
const CABECALHOS_GUARDADOS = [
  'content-type',
  'user-agent',
  'x-event-id',
  'x-timestamp',
  'x-request-id',
  'x-forwarded-for',
] as const;

function cabecalho(request: FastifyRequest, nome: string): string | undefined {
  const v = request.headers[nome];
  return typeof v === 'string' ? v : undefined;
}

const naoEncontrado = () => ErroApi.de('nao_encontrado', 'Empresa ou fonte não encontrada.');

/** Resolve empresa (global) e fonte ativa (RLS da empresa). `null` se qualquer uma faltar. */
async function resolverFonte(
  db: FastifyRequest['server']['db'],
  empresa: string,
  fonte: string,
): Promise<FonteResolvida | null> {
  const [t] = await db
    .select({ id: tenants.id, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.slug, empresa))
    .limit(1);
  if (!t) return null;
  const [s] = await comTenant(db, t.id, (tx) =>
    tx
      .select({
        id: sources.id,
        slug: sources.slug,
        secretHash: sources.secretHash,
        secretEnc: sources.secretEnc,
      })
      .from(sources)
      .where(and(eq(sources.slug, fonte), eq(sources.ativo, true)))
      .limit(1),
  );
  if (!s) return null;
  return {
    tenantId: t.id,
    tenantSlug: t.slug,
    sourceId: s.id,
    fonteSlug: s.slug,
    secretHash: s.secretHash,
    secretEnc: s.secretEnc,
  };
}

/** Recebimento. Tem parser próprio de JSON que preserva o corpo bruto (assinatura). */
export const rotasWebhookRecebimento: FastifyPluginAsyncZod<OpcoesWebhooks> = async (
  app,
  opcoes,
) => {
  const agora = opcoes.agora ?? Date.now;

  // Só neste escopo: o corpo chega como string; o parse JSON é feito depois da assinatura.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, corpo, done) => {
    done(null, corpo);
  });

  app.post(
    '/webhooks/:empresa/:fonte',
    {
      config: {
        rateLimit: {
          max: opcoes.limitePorMinuto,
          timeWindow: '1 minute',
          keyGenerator: (req: FastifyRequest) => {
            const p = req.params as { empresa?: string; fonte?: string };
            return `webhook:${p.empresa ?? ''}/${p.fonte ?? ''}`;
          },
        },
      },
      schema: {
        tags: ['webhooks'],
        summary: 'Recebe um webhook assinado',
        description:
          'Corpo JSON livre (até 1 MB). Cabeçalhos: X-Timestamp (epoch s, janela ±5 min), ' +
          'X-Signature (HMAC-SHA256 hex de `timestamp + "." + corpo bruto` com o segredo da fonte) ' +
          'e X-Event-Id (opcional; sem ele a idempotência usa o SHA-256 do corpo). ' +
          '202 = aceito e enfileirado; 200 = duplicado.',
        params: schemaParamsWebhook,
        response: {
          200: schemaDuplicado,
          202: schemaAceito,
          400: schemaRespostaErro,
          401: schemaRespostaErro,
          404: schemaRespostaErro,
          413: schemaRespostaErro,
          415: schemaRespostaErro,
          429: schemaRespostaErro,
        },
      },
    },
    async (request, reply) => {
      const { empresa, fonte } = request.params;
      const log = request.log.child({ tenant: empresa, fonte });
      const rejeitar = (erro: ErroApi, extra: object = {}) => {
        log.info({ resultado: erro.codigo, ...extra }, 'webhook rejeitado');
        return erro;
      };

      const corpo = typeof request.body === 'string' ? request.body : '';
      const timestamp = cabecalho(request, 'x-timestamp');
      const assinatura = cabecalho(request, 'x-signature');
      if (!timestamp || !assinatura) {
        throw rejeitar(
          ErroApi.de('cabecalho_ausente', 'Envie os cabeçalhos X-Timestamp e X-Signature.', {
            ausentes: [!timestamp && 'X-Timestamp', !assinatura && 'X-Signature'].filter(Boolean),
          }),
        );
      }

      const alvo = await resolverFonte(app.db, empresa, fonte);
      if (!alvo) throw rejeitar(naoEncontrado());

      if (!timestampNaJanela(timestamp, opcoes.janelaSegundos, agora())) {
        throw rejeitar(
          ErroApi.de(
            'timestamp_fora_da_janela',
            `X-Timestamp fora da janela de ${opcoes.janelaSegundos} s.`,
          ),
        );
      }

      const segredo = await opcoes.obterSegredo(alvo);
      if (!segredo)
        log.warn('fonte sem segredo utilizável no servidor (secret_enc ou WEBHOOK_SEGREDOS)');
      if (!segredo || !assinaturaConfere(segredo, timestamp, corpo, assinatura)) {
        throw rejeitar(ErroApi.de('assinatura_invalida', 'Assinatura do webhook não confere.'));
      }

      let payload: unknown;
      try {
        payload = JSON.parse(corpo);
      } catch {
        throw rejeitar(ErroApi.de('json_invalido', 'O corpo enviado não é um JSON válido.'));
      }

      const eventKey = chaveEvento(cabecalho(request, 'x-event-id'), corpo);
      const headers: Record<string, string> = {};
      for (const nome of CABECALHOS_GUARDADOS) {
        const v = cabecalho(request, nome);
        if (v !== undefined) headers[nome] = v;
      }

      const [novo] = await comTenant(app.db, alvo.tenantId, (tx) =>
        tx
          .insert(webhookEvents)
          .values({
            tenantId: alvo.tenantId,
            sourceId: alvo.sourceId,
            eventKey,
            payload: payload as object,
            headers,
          })
          .onConflictDoNothing()
          .returning({ id: webhookEvents.id }),
      );

      if (!novo) {
        const [existente] = await comTenant(app.db, alvo.tenantId, (tx) =>
          tx
            .select({ id: webhookEvents.id })
            .from(webhookEvents)
            .where(
              and(eq(webhookEvents.sourceId, alvo.sourceId), eq(webhookEvents.eventKey, eventKey)),
            )
            .limit(1),
        );
        log.info({ eventKey, resultado: 'duplicado' }, 'webhook recebido');
        return reply.status(200).send({ id: existente?.id ?? null, duplicado: true as const });
      }

      try {
        await opcoes.fila.enfileirarProcessamento({
          tenantId: alvo.tenantId,
          webhookEventId: novo.id,
        });
      } catch (erro) {
        // O bruto já está salvo (status recebido); o reprocessamento da fonte o recupera.
        log.error({ eventKey, id: novo.id, err: erro }, 'falha ao enfileirar webhook');
      }
      log.info({ eventKey, id: novo.id, resultado: 'aceito' }, 'webhook recebido');
      return reply.status(202).send({ id: novo.id, status: 'recebido' as const });
    },
  );
};

/** Rotas autenticadas por JWT (parser JSON padrão). */
export const rotasWebhookAdmin: FastifyPluginAsyncZod<Pick<OpcoesWebhooks, 'fila'>> = async (
  app,
  opcoes,
) => {
  /** Confere que a empresa da URL é a empresa ativa e devolve a fonte (sob RLS). */
  async function fonteDaEmpresaAtiva(
    request: FastifyRequest,
    params: { empresa: string; fonte: string },
  ) {
    if (request.empresa?.slug !== params.empresa) throw naoEncontrado();
    const [s] = await request.comTenant((tx) =>
      tx.select({ id: sources.id }).from(sources).where(eq(sources.slug, params.fonte)).limit(1),
    );
    if (!s) throw naoEncontrado();
    return s;
  }

  app.post(
    '/webhooks/:empresa/:fonte/reprocessar',
    {
      preHandler: app.exigirPapel('admin'),
      schema: {
        tags: ['webhooks'],
        summary: 'Reprocessa os brutos da fonte',
        description:
          'Enfileira `webhook.reprocessar`: o worker reenfileira cada `webhook_events` da fonte ' +
          '(opcionalmente em `[de, ate)` por `received_at`) para o motor de regras. O bruto nunca muda.',
        security: [{ bearerAuth: [] }],
        params: schemaParamsWebhook,
        body: schemaReprocessar,
        response: {
          202: schemaReprocessarResposta,
          400: schemaRespostaErro,
          401: schemaRespostaErro,
          403: schemaRespostaErro,
          404: schemaRespostaErro,
        },
      },
    },
    async (request, reply) => {
      const fonte = await fonteDaEmpresaAtiva(request, request.params);
      const { de, ate } = request.body ?? {};
      const jobId = await opcoes.fila.enfileirarReprocessamento({
        tenantId: request.empresa!.id,
        sourceId: fonte.id,
        ...(de ? { de } : {}),
        ...(ate ? { ate } : {}),
        solicitadoPor: request.usuario!.id,
      });
      request.log.info(
        { tenant: request.empresa!.slug, fonte: request.params.fonte, de, ate, jobId },
        'reprocessamento solicitado',
      );
      return reply.status(202).send({ status: 'enfileirado' as const, jobId });
    },
  );

  app.get(
    '/webhooks/:empresa/:fonte/entregas',
    {
      preHandler: app.exigirPapel('analista'),
      schema: {
        tags: ['webhooks'],
        summary: 'Últimas entregas da fonte',
        security: [{ bearerAuth: [] }],
        params: schemaParamsWebhook,
        querystring: z.object({ limite: z.coerce.number().int().min(1).max(500).default(100) }),
        response: {
          200: schemaEntregas,
          401: schemaRespostaErro,
          403: schemaRespostaErro,
          404: schemaRespostaErro,
        },
      },
    },
    async (request) => {
      const fonte = await fonteDaEmpresaAtiva(request, request.params);
      const linhas = await request.comTenant((tx) =>
        tx
          .select({
            id: webhookEvents.id,
            eventKey: webhookEvents.eventKey,
            status: webhookEvents.status,
            erro: webhookEvents.erro,
            tentativas: webhookEvents.tentativas,
            receivedAt: webhookEvents.receivedAt,
            processedAt: webhookEvents.processedAt,
          })
          .from(webhookEvents)
          .where(eq(webhookEvents.sourceId, fonte.id))
          .orderBy(desc(webhookEvents.receivedAt))
          .limit(request.query.limite),
      );
      return {
        entregas: linhas.map((l) => ({
          ...l,
          receivedAt: l.receivedAt.toISOString(),
          processedAt: l.processedAt?.toISOString() ?? null,
        })),
      };
    },
  );
};
