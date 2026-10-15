/** Integração real com pg-boss (DATABASE_ADMIN_URL). Pulado se o Postgres admin não responder. */
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { describe, expect, it } from 'vitest';
import { criarBoss, FILA_PROCESSAR, filaPgBoss } from './fila.js';

const URL_ADMIN =
  process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@127.0.0.1:5460/trafego';

async function adminDisponivel(): Promise<boolean> {
  const s = postgres(URL_ADMIN, { max: 1, connect_timeout: 2, onnotice: () => {} });
  try {
    await s`select 1`;
    return true;
  } catch {
    console.warn('[webhooks/fila.test] DATABASE_ADMIN_URL indisponível; teste do pg-boss PULADO.');
    return false;
  } finally {
    await s.end({ timeout: 1 });
  }
}

const disponivel = await adminDisponivel();

describe.skipIf(!disponivel)('fila pg-boss', () => {
  it('cria as filas com retry exponencial 5x e enfileira com singletonKey', async () => {
    const boss = await criarBoss(URL_ADMIN);
    try {
      const fila = await boss.getQueue(FILA_PROCESSAR);
      expect(fila).toMatchObject({ retryLimit: 5, retryBackoff: true });
      const webhookEventId = randomUUID();
      const id = await filaPgBoss(boss).enfileirarProcessamento({
        tenantId: randomUUID(),
        webhookEventId,
      });
      expect(id).toBeTruthy();
      const [job] = await boss.findJobs(FILA_PROCESSAR, { id: id! });
      expect(job).toMatchObject({ singletonKey: webhookEventId, retryLimit: 5 });
      await boss.deleteJob(FILA_PROCESSAR, id!);
    } finally {
      await boss.stop({ graceful: false, timeout: 2000 });
    }
  });
});
