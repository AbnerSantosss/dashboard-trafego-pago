/**
 * Preparo do banco de produção (P7.2): roda no contêiner da API antes do servidor (ver Dockerfile).
 * Uso: `node --import tsx src/db/producao.ts`. Idempotente; a cada subida do contêiner:
 * 1. aplica as migrações de `apps/api/drizzle/` como dono das tabelas (DATABASE_ADMIN_URL);
 * 2. dá LOGIN ao papel app_user (a migração 0001 o cria NOLOGIN) com a senha de APP_USER_SENHA;
 * 3. cria a empresa PASIO com a apresentação padrão, só se ainda não existir e sem dados de exemplo;
 * 4. garante o usuário de ADMIN_EMAIL como admin da PASIO. Enquanto ele não tiver senha, imprime no
 *    log um link de 1 hora para defini-la (cada subida gera um novo).
 * Nenhum segredo nem e-mail fica no código: tudo vem das variáveis da stack no Portainer.
 */
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { criarTokenRedefinicao } from '../conta/senha.js';
import { carregarEnv, ErroEnv } from '../env.js';
import {
  comTenant,
  criarDb,
  memberships,
  presentation,
  tenants,
  users,
  type Db,
} from './client.js';
import { apresentacaoDemo, LOGO_PADRAO } from './seed/dados.js';

/** Vai dentro de DATABASE_URL e do ALTER ROLE: só caracteres que não precisam de escape. */
const SENHA_APP_USER = /^[A-Za-z0-9_-]{24,200}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarSenhaAppUser(senha: string | undefined): string {
  if (!senha || !SENHA_APP_USER.test(senha)) {
    throw new Error(
      'APP_USER_SENHA ausente ou inválida: use 24 ou mais caracteres entre letras, números, _ e -.',
    );
  }
  return senha;
}

export function validarEmailAdmin(email: string | undefined): string {
  const limpo = email?.trim().toLowerCase() ?? '';
  if (!EMAIL.test(limpo)) throw new Error('ADMIN_EMAIL ausente ou inválido.');
  return limpo;
}

export async function definirSenhaAppUser(db: Db, senha: string): Promise<void> {
  // ALTER ROLE não aceita parâmetro; a regex acima garante que o literal não precisa de escape.
  await db.execute(sql.raw(`ALTER ROLE app_user LOGIN PASSWORD '${validarSenhaAppUser(senha)}'`));
}

export interface OpcoesInicial {
  email: string;
  nome?: string | undefined;
  slug?: string;
  nomeEmpresa?: string;
}

export interface ResultadoInicial {
  tenantId: string;
  userId: string;
  empresaCriada: boolean;
  /** O admin ainda não definiu senha: o chamador mostra o link de definição. */
  semSenha: boolean;
}

/** Empresa e admin. Não sobrescreve nada que já exista, exceto o papel do admin (sempre `admin`). */
export async function garantirEmpresaEAdmin(
  db: Db,
  opcoes: OpcoesInicial,
): Promise<ResultadoInicial> {
  const email = validarEmailAdmin(opcoes.email);
  const slug = opcoes.slug ?? 'pasio';
  const nomeEmpresa = opcoes.nomeEmpresa ?? 'PASIO';

  const criada = await db
    .insert(tenants)
    .values({ slug, nome: nomeEmpresa, logoUrl: LOGO_PADRAO })
    .onConflictDoNothing({ target: tenants.slug })
    .returning({ id: tenants.id });
  const [tenant] = criada.length
    ? criada
    : await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug));
  const tenantId = tenant!.id;

  await db
    .insert(users)
    .values({ email, nome: opcoes.nome?.trim() || 'Administrador' })
    .onConflictDoNothing({ target: users.email });
  const [usuario] = await db
    .select({ id: users.id, senhaHash: users.senhaHash })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  const userId = usuario!.id;

  await comTenant(db, tenantId, async (tx) => {
    await tx
      .insert(memberships)
      .values({ tenantId, userId, role: 'admin' })
      .onConflictDoUpdate({
        target: [memberships.tenantId, memberships.userId],
        set: { role: 'admin' },
      });
    await tx
      .insert(presentation)
      .values({ tenantId, ...apresentacaoDemo(), nomeExibicao: nomeEmpresa })
      .onConflictDoNothing({ target: presentation.tenantId });
  });

  return { tenantId, userId, empresaCriada: criada.length > 0, semSenha: !usuario!.senhaHash };
}

async function principal(): Promise<void> {
  const urlAdmin = process.env.DATABASE_ADMIN_URL;
  if (!urlAdmin) throw new Error('DATABASE_ADMIN_URL ausente.');
  const env = carregarEnv(process.env);
  const senhaAppUser = validarSenhaAppUser(process.env.APP_USER_SENHA);
  const email = validarEmailAdmin(process.env.ADMIN_EMAIL);

  const db = criarDb(urlAdmin, { max: 1 });
  try {
    const pasta = fileURLToPath(new URL('../../drizzle', import.meta.url));
    await migrate(db, { migrationsFolder: pasta });
    console.log('preparo: migrações aplicadas');
    await definirSenhaAppUser(db, senhaAppUser);
    console.log('preparo: papel app_user com LOGIN');

    const r = await garantirEmpresaEAdmin(db, { email, nome: process.env.ADMIN_NOME });
    console.log(`preparo: empresa PASIO ${r.empresaCriada ? 'criada' : 'já existia'}; admin ok`);
    if (r.semSenha) {
      const token = criarTokenRedefinicao(env.AUTH_SECRET, { userId: r.userId, senhaHash: null });
      console.log(
        'preparo: o admin ainda não tem senha. Abra em até 1 hora para defini-la ' +
          `(reinicie o contêiner para gerar outro): ${env.WEB_URL}/redefinir?token=${encodeURIComponent(token)}`,
      );
    }
  } finally {
    await db.$client.end({ timeout: 5 });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await principal();
  } catch (erro) {
    console.error(erro instanceof ErroEnv ? erro.message : `preparo falhou: ${String(erro)}`);
    process.exit(1);
  }
}
