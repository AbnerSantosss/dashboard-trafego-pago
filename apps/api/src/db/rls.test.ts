/**
 * Isolamento por empresa via RLS (embrião do gate G2). Roda contra o Postgres local
 * (`docker compose up -d db` + `pnpm --filter @trafego/api db:migrate`).
 * Conecta como `app_user`; se o banco não responder, os testes são pulados com aviso.
 */
import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { comTenant, comUsuario, criarDb, events, memberships, tenants, users } from './client.js';

const URL_APP = process.env.DATABASE_URL ?? 'postgres://app_user:app_user@127.0.0.1:5460/trafego';

async function bancoDisponivel(): Promise<boolean> {
  const sonda = criarDb(URL_APP, { max: 1 });
  try {
    await sonda.execute(sql`select 1 from events limit 0`);
    return true;
  } catch {
    return false;
  } finally {
    await sonda.$client.end({ timeout: 1 });
  }
}

const disponivel = await bancoDisponivel();
if (!disponivel) {
  console.warn(
    `[rls.test] Postgres indisponível ou não migrado em DATABASE_URL; testes de RLS PULADOS. ` +
      `Suba com "docker compose up -d db" e rode "pnpm --filter @trafego/api db:migrate".`,
  );
}

describe.skipIf(!disponivel)('RLS por tenant_id', () => {
  const db = criarDb(URL_APP, { max: 2 });
  const sufixo = randomUUID().slice(0, 8);
  let tenantA = '';
  let tenantB = '';
  let usuario = '';

  beforeAll(async () => {
    const criados = await db
      .insert(tenants)
      .values([
        { slug: `teste-rls-a-${sufixo}`, nome: 'Empresa A (teste)' },
        { slug: `teste-rls-b-${sufixo}`, nome: 'Empresa B (teste)' },
      ])
      .returning({ id: tenants.id });
    tenantA = criados[0]!.id;
    tenantB = criados[1]!.id;

    const [u] = await db
      .insert(users)
      .values({ email: `rls-${sufixo}@teste.local`, nome: 'Teste RLS' })
      .returning({ id: users.id });
    usuario = u!.id;

    for (const [tenant, canal] of [
      [tenantA, 'Meta'],
      [tenantB, 'Email'],
    ] as const) {
      await comTenant(db, tenant, async (tx) => {
        await tx.insert(events).values([
          { tenantId: tenant, type: 'clique', occurredAt: new Date(), channel: canal },
          { tenantId: tenant, type: 'ftd', occurredAt: new Date(), channel: canal, value: '50.00' },
        ]);
        await tx.insert(memberships).values({ tenantId: tenant, userId: usuario, role: 'admin' });
      });
    }
  });

  afterAll(async () => {
    // tenants e users não têm RLS; o CASCADE das FKs limpa as tabelas por empresa.
    if (tenantA || tenantB) {
      await db.delete(tenants).where(inArray(tenants.id, [tenantA, tenantB].filter(Boolean)));
    }
    if (usuario) await db.delete(users).where(eq(users.id, usuario));
    await db.$client.end({ timeout: 5 });
  });

  it('conecta com papel sem superusuário nem BYPASSRLS', async () => {
    const linhas = await db.execute<{ rolsuper: boolean; rolbypassrls: boolean }>(
      sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
    );
    expect(linhas[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('com app.tenant_id = A só enxerga eventos de A', async () => {
    const linhas = await comTenant(db, tenantA, (tx) => tx.select().from(events));
    expect(linhas).toHaveLength(2);
    expect(linhas.every((l) => l.tenantId === tenantA && l.channel === 'Meta')).toBe(true);
  });

  it('com app.tenant_id = B só enxerga eventos de B', async () => {
    const linhas = await comTenant(db, tenantB, (tx) => tx.select().from(events));
    expect(linhas).toHaveLength(2);
    expect(linhas.every((l) => l.tenantId === tenantB)).toBe(true);
  });

  it('filtrar explicitamente por B sob contexto A não devolve nada', async () => {
    const linhas = await comTenant(db, tenantA, (tx) =>
      tx.select().from(events).where(eq(events.tenantId, tenantB)),
    );
    expect(linhas).toHaveLength(0);
  });

  it('insert com tenant_id de B sob contexto A é recusado', async () => {
    await expect(
      comTenant(db, tenantA, (tx) =>
        tx.insert(events).values({ tenantId: tenantB, type: 'visita', occurredAt: new Date() }),
      ),
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ message: expect.stringMatching(/row-level security/) }),
    });
    const deB = await comTenant(db, tenantB, (tx) => tx.select().from(events));
    expect(deB).toHaveLength(2);
  });

  it('update e delete sob contexto A não alcançam linhas de B', async () => {
    await comTenant(db, tenantA, async (tx) => {
      await tx.update(events).set({ channel: 'Invadido' }).where(eq(events.tenantId, tenantB));
      await tx.delete(events).where(eq(events.tenantId, tenantB));
    });
    const deB = await comTenant(db, tenantB, (tx) => tx.select().from(events));
    expect(deB).toHaveLength(2);
    expect(deB.every((l) => l.channel === 'Email')).toBe(true);
  });

  it('sem app.tenant_id nenhuma linha aparece', async () => {
    expect(await db.select().from(events)).toHaveLength(0);
    // Mesmo numa conexão que já teve SET LOCAL (parâmetro vazio, não nulo).
    const linhas = await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', '', true)`);
      return tx.select().from(events);
    });
    expect(linhas).toHaveLength(0);
  });

  it('o próprio usuário lista suas memberships antes de fixar a empresa', async () => {
    const minhas = await comUsuario(db, usuario, (tx) => tx.select().from(memberships));
    expect(minhas.map((m) => m.tenantId).sort()).toEqual([tenantA, tenantB].sort());

    const deOutro = await comUsuario(db, randomUUID(), (tx) => tx.select().from(memberships));
    expect(deOutro).toHaveLength(0);
  });

  it('comTenant rejeita tenant_id que não é UUID', async () => {
    await expect(comTenant(db, "x' or 1=1 --", (tx) => tx.select().from(events))).rejects.toThrow();
  });
});
