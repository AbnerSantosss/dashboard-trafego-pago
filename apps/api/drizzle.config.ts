import { defineConfig } from 'drizzle-kit';

// Migrações rodam com o papel dono das tabelas (admin), nunca com `app_user`.
const url =
  process.env.DATABASE_ADMIN_URL ??
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@127.0.0.1:5460/trafego';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
  entities: { roles: false },
  strict: true,
  verbose: true,
});
