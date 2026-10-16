/**
 * Recebimento público da tag de atribuição do GTM: `POST /t/:empresa/clk`.
 *
 * O navegador envia com `sendBeacon` (text/plain, sem preflight de CORS). Cada chamada grava um
 * toque em `attribution_touches`; um `page_view` marcado com `cv: 1` (primeira página da sessão)
 * também vira um evento `visita`, com a agregação adiada alguns segundos por empresa.
 */
import { diaNoFuso } from '@trafego/rules';
import { eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { attributionTouches, comTenant, events, tenants } from '../db/client.js';
import { ErroApi, schemaRespostaErro } from '../erros.js';
import { agregarIncremental } from '../rules/agregar.js';
import { canalDoToque } from './toques.js';

/** Limite de corpo da tag: 16 KB. */
const LIMITE_TAG = 16 * 1024;

const texto = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim().slice(0, 512))
  .transform((v) => (v === '' || v.includes('{{') ? undefined : v))
  .optional()
  .catch(undefined);

/** Leniente: campo estranho ou inválido vira ausente, nunca derruba o toque. */
export const schemaToque = z.object({
  tipo: z.enum(['page_view', 'lead', 'evento']).catch('page_view').default('page_view'),
  cv: z.coerce.number().optional().catch(undefined),
  user_id: texto,
  visitor_id: texto,
  gclid: texto,
  gbraid: texto,
  wbraid: texto,
  fbclid: texto,
  fbp: texto,
  ttclid: texto,
  ttp: texto,
  clickid: texto,
  tblci: texto,
  utm_source: texto,
  utm_medium: texto,
  utm_campaign: texto,
  utm_content: texto,
  utm_term: texto,
  url: texto,
  referrer: texto,
});

export interface OpcoesAtribuicao {
  /** Atraso da agregação das visitas (ms). Default 30 s; testes usam 0. */
  atrasoAgregacaoMs?: number;
}

export const rotasAtribuicao: FastifyPluginAsyncZod<OpcoesAtribuicao> = async (app, opcoes) => {
  const atraso = opcoes.atrasoAgregacaoMs ?? 30_000;
  // A tag manda text/plain com JSON dentro.
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req, corpo, feito) => {
    try {
      feito(null, corpo === '' ? {} : JSON.parse(corpo as string));
    } catch {
      feito(null, {});
    }
  });

  // Agregação adiada: junta os dias pendentes por empresa e recalcula uma vez por janela.
  const pendentes = new Map<string, { fuso: string; dias: Set<string>; timer: NodeJS.Timeout }>();
  const agregar = async (tenantId: string) => {
    const p = pendentes.get(tenantId);
    pendentes.delete(tenantId);
    if (!p) return;
    try {
      await comTenant(app.db, tenantId, (tx) => agregarIncremental(tx, tenantId, p.fuso, p.dias));
    } catch (erro) {
      app.log.error({ err: erro, tenantId }, 'falha ao agregar visitas da tag');
    }
  };
  const agendar = (tenantId: string, fuso: string, dia: string) => {
    const p = pendentes.get(tenantId);
    if (p) {
      p.dias.add(dia);
      return;
    }
    const timer = setTimeout(() => void agregar(tenantId), atraso);
    timer.unref();
    pendentes.set(tenantId, { fuso, dias: new Set([dia]), timer });
  };
  app.addHook('onClose', async () => {
    for (const [tenantId, p] of pendentes) {
      clearTimeout(p.timer);
      await agregar(tenantId);
    }
  });

  app.post(
    '/t/:empresa/clk',
    {
      bodyLimit: LIMITE_TAG,
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        tags: ['atribuicao'],
        summary: 'Recebe um toque da tag de atribuição do GTM (público)',
        description:
          'Corpo JSON enviado como text/plain (sendBeacon). Campos: tipo, cv, user_id, ' +
          'visitor_id, click ids (gclid, gbraid, wbraid, fbclid, fbp, ttclid, ttp, clickid, ' +
          'tblci), utm_*, url, referrer. Responde 204.',
        params: z.object({ empresa: z.string().min(1).max(80) }),
        body: schemaToque,
        response: { 204: z.null(), 404: schemaRespostaErro, 429: schemaRespostaErro },
      },
    },
    async (request, reply) => {
      reply.header('access-control-allow-origin', '*');
      const [t] = await app.db
        .select({ id: tenants.id, fuso: tenants.fuso })
        .from(tenants)
        .where(eq(tenants.slug, request.params.empresa))
        .limit(1);
      if (!t) throw ErroApi.de('nao_encontrado', 'Empresa não encontrada.');
      const b = request.body;
      const toque = {
        gclid: b.gclid,
        gbraid: b.gbraid,
        wbraid: b.wbraid,
        fbclid: b.fbclid,
        fbp: b.fbp,
        ttclid: b.ttclid,
        ttp: b.ttp,
        kwaiClickId: b.clickid,
        tblci: b.tblci,
        utmSource: b.utm_source,
        utmMedium: b.utm_medium,
        utmCampaign: b.utm_campaign,
        referrer: b.referrer,
      };
      const agora = new Date();
      const visita = b.tipo === 'page_view' && b.cv === 1;
      await comTenant(app.db, t.id, async (tx) => {
        await tx.insert(attributionTouches).values({
          tenantId: t.id,
          tipo: b.tipo,
          leadKey: b.user_id,
          visitorId: b.visitor_id,
          utmContent: b.utm_content,
          utmTerm: b.utm_term,
          url: b.url,
          ...toque,
          recebidoEm: agora,
        });
        if (visita) {
          await tx.insert(events).values({
            tenantId: t.id,
            type: 'visita',
            occurredAt: agora,
            currency: 'BRL',
            channel: canalDoToque(toque),
            campaign: b.utm_campaign ?? null,
            leadKey: b.user_id ?? null,
            utmSource: b.utm_source ?? null,
            utmMedium: b.utm_medium ?? null,
            utmCampaign: b.utm_campaign ?? null,
            referrer: b.referrer ?? null,
          });
        }
      });
      if (visita) agendar(t.id, t.fuso, diaNoFuso(agora, t.fuso));
      return reply.code(204).send(null);
    },
  );

  // Preflight de quem usar fetch com outro content-type.
  app.options('/t/:empresa/clk', async (_request, reply) =>
    reply
      .header('access-control-allow-origin', '*')
      .header('access-control-allow-methods', 'POST')
      .header('access-control-allow-headers', 'content-type')
      .code(204)
      .send(),
  );
};
