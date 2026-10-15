/**
 * Utilitários para testes que precisam do Postgres local. Se o banco não responder, os
 * testes que dependem dele são pulados com aviso (mesmo padrão de `db/rls.test.ts`).
 */
import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { buildApp } from '../app.js';
import {
  comTenant,
  criarDb,
  memberships,
  presentation,
  tenants,
  users,
  type Role,
} from '../db/client.js';
import { carregarEnv } from '../env.js';

export const URL_APP =
  process.env.DATABASE_URL ?? 'postgres://app_user:app_user@127.0.0.1:5460/trafego';

export async function bancoDisponivel(rotulo: string): Promise<boolean> {
  const sonda = criarDb(URL_APP, { max: 1 });
  try {
    await sonda.execute(sql`select 1 from memberships limit 0`);
    return true;
  } catch {
    console.warn(
      `[${rotulo}] Postgres indisponível ou não migrado em DATABASE_URL; testes de banco PULADOS. ` +
        `Suba com "docker compose up -d db" e rode "pnpm --filter @trafego/api db:migrate".`,
    );
    return false;
  } finally {
    await sonda.$client.end({ timeout: 1 });
  }
}

/** App de teste apontando para o banco local. */
export function appComBanco(databaseUrl = URL_APP) {
  return buildApp({
    env: carregarEnv({ NODE_ENV: 'test', DATABASE_URL: databaseUrl }),
    logger: false,
  });
}

export interface Cenario {
  sufixo: string;
  t1: { id: string; slug: string };
  t2: { id: string; slug: string };
  t3: { id: string; slug: string };
  usuario: { id: string; email: string };
  limpar(): Promise<void>;
}

/**
 * Usuário com `leitor` em T1 e `admin` em T2; T3 existe mas sem membership.
 * Cada empresa tem uma linha em `presentation` com o nome dela.
 */
export async function criarCenario(papeis: [Role, Role] = ['leitor', 'admin']): Promise<Cenario> {
  const db = criarDb(URL_APP, { max: 2 });
  const sufixo = randomUUID().slice(0, 8);
  const slugs = [1, 2, 3].map((n) => `teste-auth-t${n}-${sufixo}`);
  const criados = await db
    .insert(tenants)
    .values(slugs.map((slug, i) => ({ slug, nome: `Empresa T${i + 1} (teste)` })))
    .returning({ id: tenants.id, slug: tenants.slug });
  const [t1, t2, t3] = slugs.map((s) => criados.find((c) => c.slug === s)!);
  const email = `auth-${sufixo}@teste.local`;
  const [u] = await db
    .insert(users)
    .values({ email, nome: 'Teste Auth' })
    .returning({ id: users.id });
  const usuario = { id: u!.id, email };

  for (const [t, papel] of [
    [t1!, papeis[0]],
    [t2!, papeis[1]],
    [t3!, null],
  ] as const) {
    await comTenant(db, t.id, async (tx) => {
      await tx.insert(presentation).values({ tenantId: t.id, nomeExibicao: `Apres ${t.slug}` });
      if (papel)
        await tx.insert(memberships).values({ tenantId: t.id, userId: usuario.id, role: papel });
    });
  }

  return {
    sufixo,
    t1: t1!,
    t2: t2!,
    t3: t3!,
    usuario,
    async limpar() {
      // tenants e users não têm RLS; o CASCADE das FKs limpa as tabelas por empresa.
      await db.delete(tenants).where(inArray(tenants.id, [t1!.id, t2!.id, t3!.id]));
      await db.delete(users).where(eq(users.id, usuario.id));
      await db.$client.end({ timeout: 5 });
    },
  };
}
