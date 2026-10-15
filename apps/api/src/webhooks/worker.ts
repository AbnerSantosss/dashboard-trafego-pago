/**
 * Worker das filas `webhook.processar` e `webhook.reprocessar`.
 *
 * - `processar` (motor de regras, injetado) devolve `processado` ou `erro`.
 * - Erro de regra NÃO é retentado: vira status `erro` com o motivo (dead-letter lógico).
 * - Exceção (infraestrutura) é relançada para o pg-boss retentar com backoff; na última
 *   tentativa o evento fica `erro` com motivo `retentativas_esgotadas` e o job termina.
 */
import { and, eq, gte, lt } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { comTenant, webhookEvents, type Db } from '../db/client.js';
import {
  FILA_PROCESSAR,
  FILA_REPROCESSAR,
  LIMITE_RETENTATIVAS,
  type Fila,
  type JobProcessar,
  type JobReprocessar,
} from './fila.js';

export interface ResultadoProcessamento {
  status: 'processado' | 'erro';
  eventos: number;
  motivo?: string;
}

export type Processar = (db: Db, job: JobProcessar) => Promise<ResultadoProcessamento>;

/** Reprocessamento em lote (em produção, `reprocessarFonte` de `../rules/reprocessar.js`). */
export type Reprocessar = (
  db: Db,
  job: { tenantId: string; sourceId: string; de?: Date; ate?: Date },
) => Promise<{ total: number }>;

export const MOTIVO_RETENTATIVAS_ESGOTADAS = 'retentativas_esgotadas';

export interface LogMinimo {
  info(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

const logNulo: LogMinimo = { info() {}, error() {} };

export interface OpcoesWorker {
  db: Db;
  processar: Processar;
  /** Necessário para `iniciar`; `tratar*` funcionam sem ele (testes). */
  boss?: PgBoss;
  /** Se presente, o job `webhook.reprocessar` chama esta função em vez de reenfileirar. */
  reprocessar?: Reprocessar;
  /** Fila usada pelo reprocessamento (fallback sem `reprocessar`) para reenfileirar os eventos. */
  fila?: Fila;
  log?: LogMinimo;
  limiteRetentativas?: number;
}

async function marcar(
  db: Db,
  tenantId: string,
  id: string,
  valores: Partial<typeof webhookEvents.$inferInsert>,
): Promise<void> {
  await comTenant(db, tenantId, (tx) =>
    tx.update(webhookEvents).set(valores).where(eq(webhookEvents.id, id)),
  );
}

export function criarWorker(opcoes: OpcoesWorker) {
  const { db, processar } = opcoes;
  const log = opcoes.log ?? logNulo;
  const limite = opcoes.limiteRetentativas ?? LIMITE_RETENTATIVAS;

  /** Uma execução de um job. `retryCount` = quantas vezes já foi retentado. */
  async function tratarProcessar(job: {
    data: JobProcessar;
    retryCount: number;
  }): Promise<ResultadoProcessamento> {
    const { tenantId, webhookEventId } = job.data;
    const tentativas = job.retryCount + 1;
    let resultado: ResultadoProcessamento;
    try {
      resultado = await processar(db, job.data);
    } catch (erro) {
      const esgotou = job.retryCount >= limite;
      log.error(
        { tenantId, webhookEventId, tentativas, esgotou, err: erro },
        'falha de infraestrutura ao processar webhook',
      );
      try {
        await marcar(
          db,
          tenantId,
          webhookEventId,
          esgotou
            ? { tentativas, status: 'erro', erro: MOTIVO_RETENTATIVAS_ESGOTADAS }
            : { tentativas },
        );
      } catch (erroMarcacao) {
        log.error({ tenantId, webhookEventId, err: erroMarcacao }, 'falha ao marcar tentativa');
      }
      if (esgotou) return { status: 'erro', eventos: 0, motivo: MOTIVO_RETENTATIVAS_ESGOTADAS };
      throw erro;
    }

    // Grava o desfecho de forma idempotente (o motor também pode tê-lo gravado).
    await marcar(
      db,
      tenantId,
      webhookEventId,
      resultado.status === 'processado'
        ? { tentativas, status: 'processado', erro: null, processedAt: new Date() }
        : { tentativas, status: 'erro', erro: resultado.motivo ?? 'erro_de_regra' },
    );
    log.info(
      {
        tenantId,
        webhookEventId,
        status: resultado.status,
        eventos: resultado.eventos,
        motivo: resultado.motivo,
      },
      'webhook processado',
    );
    return resultado;
  }

  /** Reenfileira os brutos da fonte no intervalo pedido. O bruto nunca é alterado. */
  async function tratarReprocessar(job: { id?: string; data: JobReprocessar }): Promise<number> {
    const { tenantId, sourceId, de, ate } = job.data;
    if (opcoes.reprocessar) {
      const r = await opcoes.reprocessar(db, {
        tenantId,
        sourceId,
        ...(de ? { de: new Date(de) } : {}),
        ...(ate ? { ate: new Date(ate) } : {}),
      });
      log.info({ tenantId, sourceId, de, ate, ...r }, 'reprocessamento concluído');
      return r.total;
    }
    if (!opcoes.fila) throw new Error('worker sem fila para reprocessar');
    const ids = await comTenant(db, tenantId, (tx) =>
      tx
        .select({ id: webhookEvents.id })
        .from(webhookEvents)
        .where(
          and(
            eq(webhookEvents.sourceId, sourceId),
            de ? gte(webhookEvents.receivedAt, new Date(de)) : undefined,
            ate ? lt(webhookEvents.receivedAt, new Date(ate)) : undefined,
          ),
        )
        .orderBy(webhookEvents.receivedAt),
    );
    const lote = job.id ?? String(Date.now());
    for (const { id } of ids) {
      await opcoes.fila.enfileirarProcessamento(
        { tenantId, webhookEventId: id },
        { chave: `${id}:reproc:${lote}` },
      );
    }
    log.info({ tenantId, sourceId, de, ate, eventos: ids.length }, 'reprocessamento enfileirado');
    return ids.length;
  }

  return {
    tratarProcessar,
    tratarReprocessar,
    async iniciar(): Promise<void> {
      const boss = opcoes.boss;
      if (!boss) throw new Error('criarWorker: boss ausente');
      await boss.work<JobProcessar>(FILA_PROCESSAR, { batchSize: 1 }, async (jobs) => {
        for (const job of jobs) await tratarProcessar(job);
      });
      await boss.work<JobReprocessar>(FILA_REPROCESSAR, { batchSize: 1 }, async (jobs) => {
        for (const job of jobs) await tratarReprocessar(job);
      });
    },
  };
}
