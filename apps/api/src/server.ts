import { existsSync } from 'node:fs';
import type { PgBoss } from 'pg-boss';
import { buildApp } from './app.js';
import { carregarEnv, ErroEnv } from './env.js';
import { processarWebhookEvent } from './rules/processar.js';
import { reprocessarFonte } from './rules/reprocessar.js';
import { lerConfigWebhooks } from './webhooks/config.js';
import { criarBoss, filaPgBoss } from './webhooks/fila.js';
import { criarWorker } from './webhooks/worker.js';

async function iniciar(): Promise<void> {
  // Segredos locais (SMTP etc.) ficam em apps/api/.env.local, fora do git. Em produção, variáveis do Portainer.
  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
  let env;
  try {
    env = carregarEnv(process.env);
  } catch (erro) {
    if (erro instanceof ErroEnv) {
      console.error(erro.message);
      process.exit(1);
    }
    throw erro;
  }

  // Fila pg-boss: precisa de DATABASE_ADMIN_URL (app_user não pode criar o schema pgboss).
  const { urlFila } = lerConfigWebhooks(process.env);
  let boss: PgBoss | undefined;
  if (urlFila) {
    try {
      boss = await criarBoss(urlFila);
    } catch (erro) {
      console.error('falha ao iniciar a fila pg-boss:', (erro as Error).message);
      process.exit(1);
    }
  }

  const app = await buildApp({ env, ...(boss ? { webhooks: { fila: filaPgBoss(boss) } } : {}) });

  if (boss) {
    const worker = criarWorker({
      reprocessar: reprocessarFonte,
      db: app.db,
      boss,
      fila: filaPgBoss(boss),
      processar: processarWebhookEvent,
      log: app.log,
    });
    await worker.iniciar();
    app.log.info('worker de webhooks iniciado');
  } else {
    app.log.warn('DATABASE_ADMIN_URL ausente: webhooks são gravados mas não processados');
  }

  const encerrar = async (sinal: string) => {
    app.log.info({ sinal }, 'encerrando');
    if (boss) await boss.stop({ graceful: true, timeout: 10_000 });
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void encerrar('SIGINT'));
  process.once('SIGTERM', () => void encerrar('SIGTERM'));

  try {
    await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  } catch (erro) {
    app.log.error({ err: erro }, 'falha ao subir a API');
    process.exit(1);
  }
}

void iniciar();
