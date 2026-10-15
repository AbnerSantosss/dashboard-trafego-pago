/**
 * Fila de processamento dos webhooks (pg-boss).
 *
 * O pg-boss cria e migra o schema `pgboss`; `app_user` não tem `CREATE` no banco, então a fila
 * conecta com `DATABASE_ADMIN_URL`. O worker continua lendo e gravando dados de negócio pelo
 * `Db` da aplicação (app_user, sob RLS).
 *
 * A rota depende só da interface `Fila`, então `buildApp` roda sem pg-boss nos testes
 * (`criarFilaMemoria`).
 */
import { PgBoss } from 'pg-boss';

export const FILA_PROCESSAR = 'webhook.processar';
export const FILA_REPROCESSAR = 'webhook.reprocessar';
/** Retentativas após a 1ª execução (até 6 execuções no total). */
export const LIMITE_RETENTATIVAS = 5;

export interface JobProcessar {
  tenantId: string;
  webhookEventId: string;
}

export interface JobReprocessar {
  tenantId: string;
  sourceId: string;
  /** ISO 8601; filtra `received_at >= de`. */
  de?: string;
  /** ISO 8601; filtra `received_at < ate`. */
  ate?: string;
  solicitadoPor?: string;
}

export interface Fila {
  enfileirarProcessamento(job: JobProcessar, opcoes?: { chave?: string }): Promise<string | null>;
  enfileirarReprocessamento(job: JobReprocessar): Promise<string | null>;
}

export type FilaMemoria = Fila & { processar: JobProcessar[]; reprocessar: JobReprocessar[] };

/** Fila em memória para testes: só registra os jobs. */
export function criarFilaMemoria(): FilaMemoria {
  let n = 0;
  const fila: FilaMemoria = {
    processar: [],
    reprocessar: [],
    async enfileirarProcessamento(job) {
      fila.processar.push(job);
      return `mem-${++n}`;
    },
    async enfileirarReprocessamento(job) {
      fila.reprocessar.push(job);
      return `mem-${++n}`;
    },
  };
  return fila;
}

/** Retry exponencial: 5 s, 10 s, 20 s, 40 s, 80 s (com jitter), teto de 5 min. */
export const OPCOES_RETRY = {
  retryLimit: LIMITE_RETENTATIVAS,
  retryDelay: 5,
  retryBackoff: true,
  retryDelayMax: 300,
} as const;

/** Cria o pg-boss, sobe o schema e as filas. Chame `boss.stop()` no encerramento. */
export async function criarBoss(url: string): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString: url, max: 4 });
  await boss.start();
  for (const nome of [FILA_PROCESSAR, FILA_REPROCESSAR]) {
    if (!(await boss.getQueue(nome))) await boss.createQueue(nome, OPCOES_RETRY);
  }
  return boss;
}

export function filaPgBoss(boss: PgBoss): Fila {
  return {
    enfileirarProcessamento(job, opcoes) {
      return boss.send(FILA_PROCESSAR, job, {
        ...OPCOES_RETRY,
        singletonKey: opcoes?.chave ?? job.webhookEventId,
      });
    },
    enfileirarReprocessamento(job) {
      return boss.send(FILA_REPROCESSAR, job, { ...OPCOES_RETRY });
    },
  };
}
