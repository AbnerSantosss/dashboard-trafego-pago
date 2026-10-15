/**
 * Reprocessamento em lote: aplica a regra ativa da fonte aos brutos (`webhook_events`) do
 * intervalo, em lotes de 500 (uma transação por lote). A agregação de cada lote é feita uma
 * vez no fim do lote, só para os dias afetados.
 */
import { and, asc, eq, gt, gte, lt, type SQL } from 'drizzle-orm';
import { comTenant, webhookEvents, type Db } from '../db/client.js';
import { agregarIncremental } from './agregar.js';
import { carregarContextoFonte, processarLote } from './processar.js';

export const TAMANHO_LOTE = 500;

export interface ResultadoReprocessamento {
  total: number;
  processados: number;
  erros: number;
  eventos: number;
  /** Dias (fuso da empresa) reagregados. */
  dias: number;
}

export async function reprocessarFonte(
  db: Db,
  { tenantId, sourceId, de, ate }: { tenantId: string; sourceId: string; de?: Date; ate?: Date },
): Promise<ResultadoReprocessamento> {
  const r: ResultadoReprocessamento = { total: 0, processados: 0, erros: 0, eventos: 0, dias: 0 };
  const todosDias = new Set<string>();
  let cursor: string | null = null;

  for (;;) {
    const fim: boolean = await comTenant(db, tenantId, async (tx) => {
      const filtros: (SQL | undefined)[] = [eq(webhookEvents.sourceId, sourceId)];
      if (de) filtros.push(gte(webhookEvents.receivedAt, de));
      if (ate) filtros.push(lt(webhookEvents.receivedAt, ate));
      // Paginação por id (keyset): received_at tem microssegundos e Date só milissegundos.
      if (cursor) filtros.push(gt(webhookEvents.id, cursor));
      const lote = await tx
        .select({ id: webhookEvents.id })
        .from(webhookEvents)
        .where(and(...filtros))
        .orderBy(asc(webhookEvents.id))
        .limit(TAMANHO_LOTE);
      if (lote.length === 0) return true;

      const contexto = await carregarContextoFonte(tx, tenantId, sourceId);
      const diasLote = new Set<string>();
      const { resultados, dias } = await processarLote(
        tx,
        tenantId,
        lote.map((w) => w.id),
        contexto,
      );
      for (const resultado of resultados.values()) {
        r.total++;
        if (resultado.status === 'processado') r.processados++;
        else r.erros++;
        r.eventos += resultado.eventos;
      }
      for (const d of dias) diasLote.add(d);
      await agregarIncremental(tx, tenantId, contexto.fuso, diasLote);
      for (const d of diasLote) todosDias.add(d);
      cursor = lote[lote.length - 1]!.id;
      return lote.length < TAMANHO_LOTE;
    });
    if (fim) break;
  }
  r.dias = todosDias.size;
  return r;
}
