/**
 * Publica um preset de regras (`PRESETS` de `@trafego/rules`, ex.: `gtech`) como nova versão
 * ativa das regras de uma fonte. Sem editor de regras na interface (D15), este é o caminho
 * programático. Idempotente: se a versão ativa já tem o mesmo conteúdo, não cria outra.
 *
 * A fonte precisa existir (Configurações → Webhooks cria a fonte e mostra o segredo).
 *
 * Uso no contêiner da API (lê os segredos de /run/segredos):
 *   node --import tsx --import ./src/segredos-do-servidor.ts src/rules/aplicar-preset.ts \
 *     --empresa pasio --fonte gtech --preset gtech [--reprocessar]
 * Uso local: `pnpm --filter @trafego/api exec tsx src/rules/aplicar-preset.ts --empresa ... `
 * (com DATABASE_URL). `--reprocessar` reaplica a versão nova aos brutos já recebidos da fonte.
 */
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { PRESETS, validarConjunto } from '@trafego/rules';
import { and, desc, eq } from 'drizzle-orm';
import { comTenant, criarDb, rules, sources, tenants, type Db } from '../db/client.js';
import { reprocessarFonte, type ResultadoReprocessamento } from './reprocessar.js';

export interface OpcoesPublicar {
  tenantId: string;
  sourceId: string;
  /** Conteúdo de `rules.mapping`: conjunto sem versão/fuso/moeda ou só a lista de blocos. */
  mapping: unknown;
  channelRules?: unknown[];
  autor?: string;
}

export interface ResultadoPublicar {
  version: number;
  /** `false` = a versão ativa já tinha este conteúdo; nada mudou. */
  criada: boolean;
}

/** Cria a versão seguinte, ativa, e desativa a anterior (uma transação, sob RLS). */
export async function publicarRegras(db: Db, opcoes: OpcoesPublicar): Promise<ResultadoPublicar> {
  const { tenantId, sourceId, mapping } = opcoes;
  const channelRules = opcoes.channelRules ?? [];
  const json = Array.isArray(mapping) ? { regras: mapping } : (mapping as Record<string, unknown>);
  const v = validarConjunto({ version: 1, ...json });
  if (!v.ok) throw new Error(`Regras inválidas: ${v.erros.join('; ')}`);

  return comTenant(db, tenantId, async (tx) => {
    const [fonte] = await tx
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.id, sourceId))
      .limit(1);
    if (!fonte) throw new Error('Fonte não encontrada nesta empresa.');

    const [ultima] = await tx
      .select({ version: rules.version })
      .from(rules)
      .where(eq(rules.sourceId, sourceId))
      .orderBy(desc(rules.version))
      .limit(1);
    const [ativa] = await tx
      .select()
      .from(rules)
      .where(and(eq(rules.sourceId, sourceId), eq(rules.ativo, true)))
      .limit(1);
    if (
      ativa &&
      isDeepStrictEqual(ativa.mapping, mapping) &&
      isDeepStrictEqual(ativa.channelRules, channelRules)
    ) {
      return { version: ativa.version, criada: false };
    }

    const version = (ultima?.version ?? 0) + 1;
    // Desativa antes de inserir: o índice único parcial só admite uma ativa por fonte.
    await tx
      .update(rules)
      .set({ ativo: false })
      .where(and(eq(rules.sourceId, sourceId), eq(rules.ativo, true)));
    await tx.insert(rules).values({
      tenantId,
      sourceId,
      version,
      mapping,
      channelRules,
      ativo: true,
      createdBy: opcoes.autor ?? null,
    });
    await tx
      .update(sources)
      .set({ rulesVersion: version, updatedAt: new Date() })
      .where(eq(sources.id, sourceId));
    return { version, criada: true };
  });
}

/** Resolve empresa e fonte pelos slugs; erro legível se faltar alguma. */
export async function localizarFonte(
  db: Db,
  empresa: string,
  fonte: string,
): Promise<{ tenantId: string; sourceId: string }> {
  const [t] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, empresa));
  if (!t) throw new Error(`Empresa "${empresa}" não existe.`);
  const [s] = await comTenant(db, t.id, (tx) =>
    tx.select({ id: sources.id }).from(sources).where(eq(sources.slug, fonte)).limit(1),
  );
  if (!s) {
    throw new Error(
      `Fonte "${fonte}" não existe na empresa "${empresa}". Crie em Configurações → Webhooks.`,
    );
  }
  return { tenantId: t.id, sourceId: s.id };
}

async function principal(): Promise<void> {
  const { values } = parseArgs({
    options: {
      empresa: { type: 'string', default: 'pasio' },
      fonte: { type: 'string' },
      preset: { type: 'string' },
      reprocessar: { type: 'boolean', default: false },
    },
  });
  const preset = values.preset ?? values.fonte;
  if (!values.fonte || !preset) {
    throw new Error(
      'Uso: aplicar-preset.ts --empresa pasio --fonte gtech [--preset gtech] [--reprocessar]',
    );
  }
  const gerar = PRESETS[preset];
  if (!gerar) {
    throw new Error(`Preset "${preset}" desconhecido (há: ${Object.keys(PRESETS).join(', ')}).`);
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL ausente.');

  const db = criarDb(url, { max: 1 });
  try {
    const alvo = await localizarFonte(db, values.empresa, values.fonte);
    const r = await publicarRegras(db, { ...alvo, mapping: gerar() });
    console.log(
      r.criada
        ? `regras: preset "${preset}" publicado como versão ${r.version} ativa de ${values.empresa}/${values.fonte}`
        : `regras: a versão ativa (${r.version}) de ${values.empresa}/${values.fonte} já é o preset "${preset}"; nada mudou`,
    );
    if (values.reprocessar) {
      const rep: ResultadoReprocessamento = await reprocessarFonte(db, alvo);
      console.log(
        `reprocessamento: ${rep.total} brutos, ${rep.processados} processados, ` +
          `${rep.erros} com erro, ${rep.eventos} eventos, ${rep.dias} dias reagregados`,
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
    console.error(`aplicar-preset falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    process.exit(1);
  }
}
