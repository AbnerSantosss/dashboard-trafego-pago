/**
 * Cliente do banco (postgres.js + Drizzle) e helpers de contexto de empresa para RLS.
 *
 * A aplicação conecta sempre como `app_user` (sem BYPASSRLS). Toda consulta a tabela com
 * `tenant_id` precisa rodar dentro de `comTenant`, senão a política devolve zero linhas.
 */
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { z } from 'zod';
import * as schema from './schema.js';

export interface OpcoesDb {
  /** Tamanho máximo do pool (padrão 10). */
  max?: number;
}

export function criarDb(url: string, opcoes: OpcoesDb = {}) {
  const cliente = postgres(url, { max: opcoes.max ?? 10, onnotice: () => {} });
  return drizzle(cliente, { schema });
}

export type Db = ReturnType<typeof criarDb>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const uuidSchema = z.uuid();

/**
 * Abre uma transação com `app.tenant_id` (e opcionalmente `app.user_id`) fixados via
 * `set_config(..., true)`, equivalente a `SET LOCAL`: o valor morre no fim da transação e
 * não vaza para a próxima requisição que reaproveitar a conexão do pool.
 */
export function comTenant<T>(db: Db, tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
export function comTenant<T>(
  db: Db,
  tenantId: string,
  userId: string | undefined,
  fn: (tx: Tx) => Promise<T>,
): Promise<T>;
export async function comTenant<T>(
  db: Db,
  tenantId: string,
  userIdOuFn: string | undefined | ((tx: Tx) => Promise<T>),
  talvezFn?: (tx: Tx) => Promise<T>,
): Promise<T> {
  const fn = typeof userIdOuFn === 'function' ? userIdOuFn : talvezFn;
  const userId = typeof userIdOuFn === 'function' ? undefined : userIdOuFn;
  if (!fn) throw new TypeError('comTenant: função de trabalho ausente');
  const tenant = uuidSchema.parse(tenantId);
  const usuario = userId === undefined ? undefined : uuidSchema.parse(userId);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenant}, true)`);
    if (usuario !== undefined) {
      await tx.execute(sql`select set_config('app.user_id', ${usuario}, true)`);
    }
    return fn(tx);
  });
}

/**
 * Transação só com `app.user_id`: serve para listar as empresas do usuário (memberships)
 * antes de fixar a empresa ativa. Nenhuma outra tabela por empresa fica visível aqui.
 */
export async function comUsuario<T>(
  db: Db,
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const usuario = uuidSchema.parse(userId);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${usuario}, true)`);
    return fn(tx);
  });
}

export * from './schema.js';
