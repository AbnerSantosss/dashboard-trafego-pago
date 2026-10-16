/**
 * Preparo de produção (P7.2): validações e criação idempotente de empresa e admin. Usa uma empresa
 * de slug aleatório e apaga tudo no fim; a PASIO demo do banco local não é tocada.
 */
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { criarDb, memberships, presentation, tenants, users } from './client.js';
import { garantirEmpresaEAdmin, validarEmailAdmin, validarSenhaAppUser } from './producao.js';

const URL_ADMIN =
  process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@127.0.0.1:5460/trafego';

describe('validações', () => {
  it('senha do app_user: só caracteres seguros para URL e SQL, 24 ou mais', () => {
    expect(validarSenhaAppUser('a'.repeat(24))).toBe('a'.repeat(24));
    expect(() => validarSenhaAppUser(undefined)).toThrow(/APP_USER_SENHA/);
    expect(() => validarSenhaAppUser('curta')).toThrow(/APP_USER_SENHA/);
    expect(() => validarSenhaAppUser(`${'a'.repeat(24)}'; drop role x; --`)).toThrow();
    expect(() => validarSenhaAppUser(`${'a'.repeat(24)}@host`)).toThrow();
  });
  it('e-mail do admin: normaliza e recusa vazio', () => {
    expect(validarEmailAdmin('  Admin@Exemplo.COM ')).toBe('admin@exemplo.com');
    expect(() => validarEmailAdmin(undefined)).toThrow(/ADMIN_EMAIL/);
    expect(() => validarEmailAdmin('sem-arroba')).toThrow(/ADMIN_EMAIL/);
  });
});

const db = criarDb(URL_ADMIN, { max: 1 });
async function bancoDisponivel(): Promise<boolean> {
  try {
    await db.execute(sql`select 1 from presentation limit 0`);
    return true;
  } catch {
    console.warn('[producao.test] Postgres indisponível em DATABASE_ADMIN_URL; testes PULADOS.');
    return false;
  }
}
const disponivel = await bancoDisponivel();

describe.skipIf(!disponivel)('garantirEmpresaEAdmin', () => {
  const slug = `prod-teste-${randomUUID().slice(0, 8)}`;
  const email = `admin-${randomUUID().slice(0, 8)}@teste.local`;

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.slug, slug));
    await db.delete(users).where(eq(users.email, email));
    await db.$client.end({ timeout: 1 });
  });

  it('cria empresa, apresentação e admin sem senha; rodar de novo não duplica nem sobrescreve', async () => {
    const r1 = await garantirEmpresaEAdmin(db, { email: email.toUpperCase(), slug });
    expect(r1).toMatchObject({ empresaCriada: true, semSenha: true });

    // O cliente muda o nome exibido e rebaixa o admin; a próxima subida não desfaz o nome.
    await db
      .update(presentation)
      .set({ nomeExibicao: 'Nome do cliente' })
      .where(eq(presentation.tenantId, r1.tenantId));
    await db.update(memberships).set({ role: 'leitor' }).where(eq(memberships.userId, r1.userId));

    const r2 = await garantirEmpresaEAdmin(db, { email, slug });
    expect(r2).toEqual({ ...r1, empresaCriada: false });
    const [ap] = await db
      .select({ nome: presentation.nomeExibicao })
      .from(presentation)
      .where(eq(presentation.tenantId, r1.tenantId));
    expect(ap?.nome).toBe('Nome do cliente');
    const vinculos = await db
      .select({ role: memberships.role })
      .from(memberships)
      .where(eq(memberships.userId, r1.userId));
    expect(vinculos).toEqual([{ role: 'admin' }]);
  });
});
