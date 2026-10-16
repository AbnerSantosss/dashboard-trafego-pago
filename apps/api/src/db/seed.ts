/**
 * Seed da empresa demo PASIO (P2.4). Uso: `pnpm --filter @trafego/api db:seed`.
 *
 * Idempotente: tudo é upsert por chave única (slug, email, tenant+user, tenant+slug,
 * tenant+dia+canal+campanha+página). Conecta como `app_user` (DATABASE_URL) e grava as tabelas
 * por empresa dentro de `comTenant`, como a aplicação faz.
 *
 * Segredo da fonte `demo`: gerado aleatoriamente só na primeira criação e impresso uma vez no
 * console; no banco fica apenas o hash scrypt. Rodar de novo não gira o segredo.
 */
import { randomBytes, scryptSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import {
  attributionTouches,
  comTenant,
  criarDb,
  events,
  memberships,
  metricsDaily,
  presentation,
  sources,
  tenants,
  users,
  webhookEvents,
  type Db,
} from './client.js';
import { apresentacaoDemo, LOGO_PADRAO, metricasDemo } from './seed/dados.js';
import { pessoasDemo, PREFIXO_DEMO } from './seed/pessoas.js';

export const SLUG_DEMO = 'pasio';
export const EMAIL_ADMIN_DEMO = 'admin@pasio.local';

export interface ResultadoSeed {
  tenantId: string;
  userId: string;
  sourceId: string;
  /** Presente só quando a fonte foi criada agora (o segredo em claro não fica guardado). */
  segredoNovo?: string;
  linhasMetricas: number;
  /** Pessoas fictícias da amostra (lista por etapa e ficha do lead). */
  pessoas: number;
}

/** Hash do segredo HMAC no formato `scrypt$<sal hex>$<hash hex>`. */
export function hashSegredo(segredo: string, sal = randomBytes(16)): string {
  return `scrypt$${sal.toString('hex')}$${scryptSync(segredo, sal, 32).toString('hex')}`;
}

export async function executarSeed(db: Db): Promise<ResultadoSeed> {
  const [tenant] = await db
    .insert(tenants)
    .values({
      slug: SLUG_DEMO,
      nome: 'PASIO',
      logoUrl: LOGO_PADRAO,
      moeda: 'BRL',
      fuso: 'America/Sao_Paulo',
    })
    .onConflictDoUpdate({
      target: tenants.slug,
      set: {
        nome: 'PASIO',
        logoUrl: LOGO_PADRAO,
        moeda: 'BRL',
        fuso: 'America/Sao_Paulo',
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: tenants.id });
  const tenantId = tenant!.id;

  const [usuario] = await db
    .insert(users)
    .values({ email: EMAIL_ADMIN_DEMO, nome: 'Admin PASIO (demo)' })
    .onConflictDoUpdate({ target: users.email, set: { updatedAt: sql`now()` } })
    .returning({ id: users.id });
  const userId = usuario!.id;

  return comTenant(db, tenantId, async (tx) => {
    await tx
      .insert(memberships)
      .values({ tenantId, userId, role: 'admin' })
      .onConflictDoUpdate({
        target: [memberships.tenantId, memberships.userId],
        set: { role: 'admin' },
      });

    const apresentacao = apresentacaoDemo();
    await tx
      .insert(presentation)
      .values({ tenantId, ...apresentacao })
      .onConflictDoUpdate({
        target: presentation.tenantId,
        set: { ...apresentacao, updatedAt: sql`now()` },
      });

    // Fonte: cria com segredo novo só se ainda não existir (não gira o segredo a cada seed).
    let segredoNovo: string | undefined;
    const segredo = randomBytes(32).toString('base64url');
    const criada = await tx
      .insert(sources)
      .values({ tenantId, slug: 'demo', nome: 'Fonte demo', secretHash: hashSegredo(segredo) })
      .onConflictDoNothing({ target: [sources.tenantId, sources.slug] })
      .returning({ id: sources.id });
    let sourceId = criada[0]?.id;
    if (sourceId) {
      segredoNovo = segredo;
    } else {
      const [existente] = await tx
        .select({ id: sources.id })
        .from(sources)
        .where(sql`${sources.tenantId} = ${tenantId} and ${sources.slug} = 'demo'`);
      sourceId = existente!.id;
    }

    const linhas = metricasDemo(tenantId);
    await tx
      .insert(metricsDaily)
      .values(linhas)
      .onConflictDoUpdate({
        target: [
          metricsDaily.tenantId,
          metricsDaily.day,
          metricsDaily.channel,
          metricsDaily.campaign,
          metricsDaily.page,
        ],
        set: {
          investimento: sql`excluded.investimento`,
          cliques: sql`excluded.cliques`,
          visitas: sql`excluded.visitas`,
          cadastros: sql`excluded.cadastros`,
          ftds: sql`excluded.ftds`,
          ftdsValor: sql`excluded.ftds_valor`,
          depositos: sql`excluded.depositos`,
          baseContatada: sql`excluded.base_contatada`,
          updatedAt: sql`now()`,
        },
      });

    // Amostra de pessoas: apaga a anterior (pelo prefixo) e regrava. Os eventos dos webhooks saem
    // junto pela FK em cascata. Não chama a agregação: os números do painel seguem os da imagem.
    const prefixo = `${PREFIXO_DEMO}%`;
    await tx.delete(webhookEvents).where(sql`${webhookEvents.eventKey} like ${prefixo}`);
    await tx.delete(events).where(sql`${events.leadKey} like ${prefixo}`);
    await tx.delete(attributionTouches).where(sql`${attributionTouches.leadKey} like ${prefixo}`);
    const amostra = pessoasDemo(tenantId, sourceId);
    await tx.insert(webhookEvents).values(amostra.webhooks);
    await tx.insert(events).values(amostra.eventos);
    await tx.insert(attributionTouches).values(amostra.toques);

    const resultado: ResultadoSeed = {
      tenantId,
      userId,
      sourceId,
      linhasMetricas: linhas.length,
      pessoas: amostra.toques.length,
    };
    if (segredoNovo !== undefined) resultado.segredoNovo = segredoNovo;
    return resultado;
  });
}

async function principal() {
  if (process.env.NODE_ENV === 'production') {
    console.error('db:seed é só para ambiente local; recusado com NODE_ENV=production.');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL ?? 'postgres://app_user:app_user@127.0.0.1:5460/trafego';
  const db = criarDb(url, { max: 1 });
  try {
    const r = await executarSeed(db);
    console.log(
      `Seed PASIO ok: tenant ${r.tenantId}, ${r.linhasMetricas} linhas em metrics_daily, ` +
        `${r.pessoas} pessoas de exemplo.`,
    );
    console.log(`Usuário demo: ${EMAIL_ADMIN_DEMO} (admin).`);
    if (r.segredoNovo) {
      console.log(
        `Segredo HMAC da fonte "demo" (mostrado UMA vez, não é gravado): ${r.segredoNovo}`,
      );
    } else {
      console.log('Fonte "demo" já existia; segredo mantido (não é exibido de novo).');
    }
  } catch (erro) {
    console.error('Falha no seed:', erro);
    process.exitCode = 1;
  } finally {
    await db.$client.end({ timeout: 5 });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await principal();
}
