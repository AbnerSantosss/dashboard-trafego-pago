/**
 * Utilitários dos testes de webhook: cria fontes com segredo aleatório (só em memória) e monta
 * requisições assinadas. Não é usado em produção.
 */
import { randomBytes } from 'node:crypto';
import { buildApp } from '../app.js';
import { URL_APP } from '../auth/banco-teste.js';
import { comTenant, criarDb, sources, type Db } from '../db/client.js';
import { hashSegredo } from '../db/seed.js';
import { carregarEnv } from '../env.js';
import { assinar } from './assinatura.js';
import { criarFilaMemoria, type FilaMemoria } from './fila.js';
import { obterSegredoDeMapa } from './segredos.js';

export interface FonteTeste {
  tenantId: string;
  tenantSlug: string;
  sourceId: string;
  slug: string;
  segredo: string;
}

export async function criarFonte(
  db: Db,
  tenant: { id: string; slug: string },
  slug = 'demo',
  ativo = true,
): Promise<FonteTeste> {
  const segredo = randomBytes(24).toString('base64url');
  const [s] = await comTenant(db, tenant.id, (tx) =>
    tx
      .insert(sources)
      .values({
        tenantId: tenant.id,
        slug,
        nome: `Fonte ${slug}`,
        secretHash: hashSegredo(segredo),
        ativo,
      })
      .returning({ id: sources.id }),
  );
  return { tenantId: tenant.id, tenantSlug: tenant.slug, sourceId: s!.id, slug, segredo };
}

/** App com banco local, fila em memória e segredos das fontes informadas. */
export async function appWebhooks(
  fontes: FonteTeste[],
  extra: { limitePorMinuto?: number; agora?: () => number } = {},
) {
  const fila: FilaMemoria = criarFilaMemoria();
  const mapa = Object.fromEntries(fontes.map((f) => [`${f.tenantSlug}/${f.slug}`, f.segredo]));
  const app = await buildApp({
    env: carregarEnv({ NODE_ENV: 'test', DATABASE_URL: URL_APP }),
    logger: false,
    webhooks: { fila, obterSegredo: obterSegredoDeMapa(mapa), ...extra },
  });
  await app.ready();
  return { app, fila };
}

export function dbTeste(): Db {
  return criarDb(URL_APP, { max: 2 });
}

export interface OpcoesEnvio {
  corpo?: string | object;
  eventId?: string | null;
  timestamp?: number;
  segredo?: string;
  assinatura?: string;
}

/** Monta um `inject` assinado para `POST /webhooks/:empresa/:fonte`. */
export function requisicaoAssinada(
  empresa: string,
  fonte: string,
  segredo: string,
  o: OpcoesEnvio = {},
) {
  const corpo =
    typeof o.corpo === 'string' ? o.corpo : JSON.stringify(o.corpo ?? { event: 'signup' });
  const ts = String(o.timestamp ?? Math.floor(Date.now() / 1000));
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-timestamp': ts,
    'x-signature': o.assinatura ?? assinar(o.segredo ?? segredo, ts, corpo),
  };
  if (o.eventId !== null)
    headers['x-event-id'] = o.eventId ?? `evt-${randomBytes(6).toString('hex')}`;
  return { method: 'POST' as const, url: `/webhooks/${empresa}/${fonte}`, headers, payload: corpo };
}
