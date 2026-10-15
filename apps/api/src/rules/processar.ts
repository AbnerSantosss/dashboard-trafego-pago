/**
 * Processa um `webhook_events`: aplica a regra ativa da fonte, grava `events` e atualiza
 * `metrics_daily` dos dias afetados. Interface combinada com a Ingestão (não mudar):
 * `processarWebhookEvent(db, { tenantId, webhookEventId })`.
 *
 * - Erro de regra (`ErroDeRegra`: payload que não casa, campo inválido, fonte sem regra ativa)
 *   → status `erro` com motivo, sem lançar. Não adianta tentar de novo.
 * - Qualquer outro erro (banco, rede) é lançado e a transação volta inteira: o worker decide
 *   a retentativa.
 * - Reprocessar é idempotente: os `events` derivados daquele bruto são apagados antes.
 */
import {
  aplicarRegras,
  diaNoFuso,
  ErroDeRegra,
  validarConjunto,
  type ConjuntoDeRegras,
} from '@trafego/rules';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  comTenant,
  events,
  rules,
  tenants,
  webhookEvents,
  type Db,
  type NovoEvento,
  type Tx,
} from '../db/client.js';
import { agregarIncremental } from './agregar.js';

export interface ResultadoProcessamento {
  status: 'processado' | 'erro';
  eventos: number;
  motivo?: string;
}

/** Contexto pré-carregado (reprocessamento em lote evita reler regra e fuso a cada bruto). */
export interface ContextoFonte {
  fuso: string;
  /** `null` = fonte sem regra ativa válida; `motivo` explica. */
  conjunto: ConjuntoDeRegras | null;
  motivo?: string;
}

/** Monta o conjunto a partir da linha de `rules` (mapping = conjunto completo ou só a lista de blocos). */
export async function carregarContextoFonte(
  tx: Tx,
  tenantId: string,
  sourceId: string,
): Promise<ContextoFonte> {
  const [t] = await tx
    .select({ fuso: tenants.fuso, moeda: tenants.moeda })
    .from(tenants)
    .where(eq(tenants.id, tenantId));
  const fuso = t?.fuso ?? 'America/Sao_Paulo';
  const [regra] = await tx
    .select()
    .from(rules)
    .where(and(eq(rules.sourceId, sourceId), eq(rules.ativo, true)))
    .limit(1);
  if (!regra) return { fuso, conjunto: null, motivo: 'A fonte não tem versão de regra ativa.' };

  const mapping = regra.mapping as unknown;
  const json: Record<string, unknown> = Array.isArray(mapping)
    ? { regras: mapping }
    : { ...(mapping as Record<string, unknown>) };
  json.version ??= regra.version;
  if (Array.isArray(regra.channelRules) && regra.channelRules.length > 0) {
    json.canais = regra.channelRules;
  }
  const v = validarConjunto(json, { fuso, moeda_padrao: t?.moeda ?? 'BRL' });
  if (!v.ok) {
    return {
      fuso,
      conjunto: null,
      motivo: `Regra ativa (versão ${regra.version}) inválida: ${v.erros.join('; ')}`,
    };
  }
  return { fuso, conjunto: v.conjunto };
}

const paraDinheiro = (v: number | undefined) => (v === undefined ? null : v.toFixed(2));

/**
 * Processa um lote de brutos dentro de uma transação já aberta (todos da mesma fonte quando
 * `contexto` é informado). Operações em massa: um select, um delete, inserts em blocos e um
 * update para os processados. Devolve o resultado por id e os dias (fuso da empresa) cuja
 * agregação precisa ser refeita; não agrega.
 */
export async function processarLote(
  tx: Tx,
  tenantId: string,
  ids: string[],
  contexto?: ContextoFonte,
): Promise<{ resultados: Map<string, ResultadoProcessamento>; dias: Set<string> }> {
  const dias = new Set<string>();
  const resultados = new Map<string, ResultadoProcessamento>();
  if (ids.length === 0) return { resultados, dias };
  const brutos = await tx
    .select({
      id: webhookEvents.id,
      sourceId: webhookEvents.sourceId,
      payload: webhookEvents.payload,
    })
    .from(webhookEvents)
    .where(inArray(webhookEvents.id, ids));
  for (const id of ids) {
    resultados.set(id, {
      status: 'erro',
      eventos: 0,
      motivo: 'Evento bruto não encontrado nesta empresa.',
    });
  }
  if (brutos.length === 0) return { resultados, dias };

  const contextos = new Map<string, ContextoFonte>();
  const ctxDe = async (sourceId: string) => {
    let c = contexto ?? contextos.get(sourceId);
    if (!c) {
      c = await carregarContextoFonte(tx, tenantId, sourceId);
      contextos.set(sourceId, c);
    }
    return c;
  };
  const fuso = (await ctxDe(brutos[0]!.sourceId)).fuso;

  // Reprocessamento idempotente: remove o que estes brutos geraram antes (e marca os dias).
  const antigos = await tx
    .delete(events)
    .where(
      inArray(
        events.webhookEventId,
        brutos.map((b) => b.id),
      ),
    )
    .returning({ occurredAt: events.occurredAt });
  for (const a of antigos) dias.add(diaNoFuso(a.occurredAt, fuso));

  const linhas: NovoEvento[] = [];
  const ok: string[] = [];
  const falhas: { id: string; motivo: string }[] = [];
  for (const we of brutos) {
    const ctx = await ctxDe(we.sourceId);
    try {
      if (!ctx.conjunto) throw new ErroDeRegra(ctx.motivo ?? 'A fonte não tem regra ativa.');
      const { eventos } = aplicarRegras(we.payload, ctx.conjunto);
      for (const e of eventos) {
        linhas.push({
          tenantId,
          webhookEventId: we.id,
          sourceId: we.sourceId,
          type: e.type,
          occurredAt: e.occurred_at,
          value: paraDinheiro(e.value),
          currency: e.currency,
          channel: e.channel,
          campaign: e.campaign ?? null,
          page: e.page ?? null,
          leadKey: e.lead_key ?? null,
          utmSource: e.utm_source ?? null,
          utmMedium: e.utm_medium ?? null,
          utmCampaign: e.utm_campaign ?? null,
          referrer: e.referrer ?? null,
          base: e.base ?? false,
        });
        dias.add(diaNoFuso(e.occurred_at, fuso));
      }
      ok.push(we.id);
      resultados.set(we.id, { status: 'processado', eventos: eventos.length });
    } catch (e) {
      if (!(e instanceof ErroDeRegra)) throw e;
      falhas.push({ id: we.id, motivo: e.message });
      resultados.set(we.id, { status: 'erro', eventos: 0, motivo: e.message });
    }
  }

  for (let i = 0; i < linhas.length; i += BLOCO_INSERT) {
    await tx.insert(events).values(linhas.slice(i, i + BLOCO_INSERT));
  }
  const agora = new Date();
  if (ok.length > 0) {
    await tx
      .update(webhookEvents)
      .set({
        status: 'processado',
        erro: null,
        processedAt: agora,
        tentativas: sql`${webhookEvents.tentativas} + 1`,
      })
      .where(inArray(webhookEvents.id, ok));
  }
  for (const f of falhas) {
    await tx
      .update(webhookEvents)
      .set({
        status: 'erro',
        erro: f.motivo,
        processedAt: agora,
        tentativas: sql`${webhookEvents.tentativas} + 1`,
      })
      .where(eq(webhookEvents.id, f.id));
  }
  return { resultados, dias };
}

/** Insert em blocos para não passar do limite de parâmetros do Postgres (65535). */
const BLOCO_INSERT = 2000;

export async function processarWebhookEvent(
  db: Db,
  { tenantId, webhookEventId }: { tenantId: string; webhookEventId: string },
): Promise<ResultadoProcessamento> {
  return comTenant(db, tenantId, async (tx) => {
    const [t] = await tx
      .select({ fuso: tenants.fuso })
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    const { resultados, dias } = await processarLote(tx, tenantId, [webhookEventId]);
    await agregarIncremental(tx, tenantId, t?.fuso ?? 'America/Sao_Paulo', dias);
    return resultados.get(webhookEventId)!;
  });
}
