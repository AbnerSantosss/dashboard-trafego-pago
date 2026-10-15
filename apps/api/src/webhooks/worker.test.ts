import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoDisponivel, criarCenario, type Cenario } from '../auth/banco-teste.js';
import { comTenant, webhookEvents, type Db } from '../db/client.js';
import { criarFilaMemoria } from './fila.js';
import { criarFonte, dbTeste, type FonteTeste } from './teste-util.js';
import {
  criarWorker,
  MOTIVO_RETENTATIVAS_ESGOTADAS,
  type Processar,
  type Reprocessar,
} from './worker.js';

const disponivel = await bancoDisponivel('webhooks/worker.test');

describe.skipIf(!disponivel)('worker de webhooks', () => {
  let c: Cenario;
  let db: Db;
  let f: FonteTeste;

  beforeAll(async () => {
    c = await criarCenario();
    db = dbTeste();
    f = await criarFonte(db, c.t1);
  });

  afterAll(async () => {
    await db?.$client.end({ timeout: 5 });
    await c?.limpar();
  });

  async function bruto(chave: string): Promise<string> {
    const [l] = await comTenant(db, f.tenantId, (tx) =>
      tx
        .insert(webhookEvents)
        .values({ tenantId: f.tenantId, sourceId: f.sourceId, eventKey: chave, payload: {} })
        .returning({ id: webhookEvents.id }),
    );
    return l!.id;
  }

  const ler = async (id: string) =>
    (
      await comTenant(db, f.tenantId, (tx) =>
        tx.select().from(webhookEvents).where(eq(webhookEvents.id, id)),
      )
    )[0]!;

  it('sucesso → processado com processed_at', async () => {
    const id = await bruto('ok');
    const w = criarWorker({ db, processar: async () => ({ status: 'processado', eventos: 2 }) });
    await w.tratarProcessar({ data: { tenantId: f.tenantId, webhookEventId: id }, retryCount: 0 });
    const l = await ler(id);
    expect(l.status).toBe('processado');
    expect(l.processedAt).toBeInstanceOf(Date);
    expect(l.tentativas).toBe(1);
  });

  it('erro de regra → status erro com motivo, sem lançar (sem retentativa)', async () => {
    const id = await bruto('regra');
    const w = criarWorker({
      db,
      processar: async () => ({ status: 'erro', eventos: 0, motivo: 'campo ausente' }),
    });
    await expect(
      w.tratarProcessar({ data: { tenantId: f.tenantId, webhookEventId: id }, retryCount: 0 }),
    ).resolves.toMatchObject({ status: 'erro' });
    expect(await ler(id)).toMatchObject({ status: 'erro', erro: 'campo ausente' });
  });

  it('exceção → lança para retentar; na última tentativa vira retentativas_esgotadas', async () => {
    const id = await bruto('infra');
    const processar: Processar = async () => {
      throw new Error('banco caiu');
    };
    const w = criarWorker({ db, processar });
    const job = (retryCount: number) => ({
      data: { tenantId: f.tenantId, webhookEventId: id },
      retryCount,
    });
    await expect(w.tratarProcessar(job(0))).rejects.toThrow('banco caiu');
    expect(await ler(id)).toMatchObject({ status: 'recebido', tentativas: 1 });
    await expect(w.tratarProcessar(job(5))).resolves.toMatchObject({
      motivo: MOTIVO_RETENTATIVAS_ESGOTADAS,
    });
    expect(await ler(id)).toMatchObject({
      status: 'erro',
      erro: MOTIVO_RETENTATIVAS_ESGOTADAS,
      tentativas: 6,
    });
  });

  it('reprocessar reenfileira os brutos da fonte', async () => {
    const fila = criarFilaMemoria();
    const w = criarWorker({
      db,
      fila,
      processar: async () => ({ status: 'processado', eventos: 0 }),
    });
    const n = await w.tratarReprocessar({
      id: 'j1',
      data: { tenantId: f.tenantId, sourceId: f.sourceId },
    });
    expect(n).toBeGreaterThanOrEqual(3);
    expect(fila.processar).toHaveLength(n);
    expect(fila.processar.every((j) => j.tenantId === f.tenantId)).toBe(true);
  });

  it('reprocessar com função injetada chama reprocessarFonte e não reenfileira', async () => {
    const fila = criarFilaMemoria();
    const chamadas: Parameters<Reprocessar>[1][] = [];
    const reprocessar: Reprocessar = async (_db, job) => {
      chamadas.push(job);
      return { total: 7 };
    };
    const w = criarWorker({
      db,
      fila,
      reprocessar,
      processar: async () => ({ status: 'processado', eventos: 0 }),
    });
    const n = await w.tratarReprocessar({
      data: { tenantId: f.tenantId, sourceId: f.sourceId, de: '2026-01-01T00:00:00.000Z' },
    });
    expect(n).toBe(7);
    expect(chamadas).toEqual([
      { tenantId: f.tenantId, sourceId: f.sourceId, de: new Date('2026-01-01T00:00:00.000Z') },
    ]);
    expect(fila.processar).toHaveLength(0);
  });
});
