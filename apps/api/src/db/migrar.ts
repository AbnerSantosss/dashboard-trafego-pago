/**
 * Aplica as migrações de `apps/api/drizzle/`. Uso: `pnpm --filter @trafego/api db:migrate`.
 * Conecta com `DATABASE_ADMIN_URL` (dono das tabelas); cai para `DATABASE_URL` se ausente.
 */
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('Defina DATABASE_ADMIN_URL (ou DATABASE_URL) para migrar.');
  process.exit(1);
}

const pasta = fileURLToPath(new URL('../../drizzle', import.meta.url));
const cliente = postgres(url, { max: 1, onnotice: () => {} });

try {
  await migrate(drizzle(cliente), { migrationsFolder: pasta });
  console.log(`Migrações aplicadas a partir de ${pasta}`);
} catch (erro) {
  console.error('Falha ao migrar:', erro);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
