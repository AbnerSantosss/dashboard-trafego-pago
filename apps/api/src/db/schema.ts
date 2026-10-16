/**
 * Esquema multiempresa (P2.1). Fonte humana: wiki/arquitetura/modelo-de-dados.md.
 *
 * Regras:
 * - `tenants` e `users` são globais (sem RLS por empresa).
 * - Toda outra tabela tem `tenant_id NOT NULL` com FK para `tenants` e política RLS
 *   `tenant_id = app.tenant_id`. ENABLE e políticas vêm do `pgPolicy`; FORCE, papel `app_user`
 *   e GRANTs ficam na migração escrita à mão `drizzle/0001_papel_app_user_force_rls.sql`.
 * - Este arquivo não importa nada relativo, para o drizzle-kit conseguir carregá-lo sozinho.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ROLES = ['admin', 'analista', 'leitor'] as const;
/** Espelha `EVENT_TYPES` de `@trafego/rules` (o teste `schema.test.ts` garante a igualdade). */
export const TIPOS_EVENTO = ['gasto', 'clique', 'visita', 'cadastro', 'ftd', 'deposito'] as const;
export const STATUS_WEBHOOK = ['recebido', 'processado', 'erro'] as const;

export const roleEnum = pgEnum('role', ROLES);
export const eventTypeEnum = pgEnum('event_type', TIPOS_EVENTO);
export const webhookStatusEnum = pgEnum('webhook_status', STATUS_WEBHOOK);

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

/**
 * Tenant ativo da sessão. `nullif` evita erro de cast quando o parâmetro existe mas está vazio
 * (acontece numa conexão reaproveitada depois de um `SET LOCAL` já encerrado).
 */
const tenantAtual = sql`nullif(current_setting('app.tenant_id', true), '')::uuid`;
const usuarioAtual = sql`nullif(current_setting('app.user_id', true), '')::uuid`;

/** Política padrão de isolamento por empresa (leitura e escrita). */
const politicaTenant = (tabela: string) =>
  pgPolicy(`${tabela}_isolamento_tenant`, {
    as: 'permissive',
    for: 'all',
    to: 'public',
    using: sql`tenant_id = ${tenantAtual}`,
    withCheck: sql`tenant_id = ${tenantAtual}`,
  });

const criadoEm = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const atualizadoEm = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const dinheiro = (nome: string) => numeric(nome, { precision: 14, scale: 2 });
const tenantId = () =>
  uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' });

// ---------------------------------------------------------------------------
// Globais
// ---------------------------------------------------------------------------

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique('tenants_slug_unico'),
  nome: text('nome').notNull(),
  logoUrl: text('logo_url'),
  moeda: text('moeda').notNull().default('BRL'),
  fuso: text('fuso').notNull().default('America/Sao_Paulo'),
  createdAt: criadoEm(),
  updatedAt: atualizadoEm(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique('users_email_unico'),
  nome: text('nome').notNull(),
  createdAt: criadoEm(),
  updatedAt: atualizadoEm(),
});

// ---------------------------------------------------------------------------
// Por empresa (RLS)
// ---------------------------------------------------------------------------

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull().default('leitor'),
    createdAt: criadoEm(),
  },
  (t) => [
    unique('memberships_tenant_user_unico').on(t.tenantId, t.userId),
    index('memberships_user_idx').on(t.userId),
    politicaTenant('memberships'),
    // Permite listar as próprias empresas antes de fixar o tenant (troca de empresa).
    pgPolicy('memberships_leitura_proprio_usuario', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`user_id = ${usuarioAtual}`,
    }),
  ],
).enableRLS();

export const sources = pgTable(
  'sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    slug: text('slug').notNull(),
    nome: text('nome').notNull(),
    /** Hash do segredo HMAC (o segredo em claro é mostrado uma vez e nunca gravado). */
    secretHash: text('secret_hash').notNull(),
    /** Segredo HMAC cifrado (AES-256-GCM, `v1$iv$tag$ct`) com a chave de WEBHOOK_CHAVE_CIFRA (P5.2). */
    secretEnc: text('secret_enc'),
    /** Versão de regras ativa nesta fonte (espelho de `rules.version` com `ativo = true`). */
    rulesVersion: integer('rules_version'),
    ativo: boolean('ativo').notNull().default(true),
    createdAt: criadoEm(),
    updatedAt: atualizadoEm(),
  },
  (t) => [
    unique('sources_tenant_slug_unico').on(t.tenantId, t.slug),
    // Alvo das FKs compostas que impedem referenciar fonte de outra empresa.
    unique('sources_tenant_id_unico').on(t.tenantId, t.id),
    politicaTenant('sources'),
  ],
).enableRLS();

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    sourceId: uuid('source_id').notNull(),
    eventKey: text('event_key').notNull(),
    payload: jsonb('payload').notNull(),
    headers: jsonb('headers').notNull().default({}),
    status: webhookStatusEnum('status').notNull().default('recebido'),
    /** Motivo da falha (status `erro`), exibido na tela de dead-letter. */
    erro: text('erro'),
    tentativas: integer('tentativas').notNull().default(0),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('webhook_events_idempotencia_unico').on(t.tenantId, t.sourceId, t.eventKey),
    unique('webhook_events_tenant_id_unico').on(t.tenantId, t.id),
    index('webhook_events_status_idx').on(t.tenantId, t.status, t.receivedAt),
    foreignKey({
      name: 'webhook_events_source_fk',
      columns: [t.tenantId, t.sourceId],
      foreignColumns: [sources.tenantId, sources.id],
    }).onDelete('cascade'),
    politicaTenant('webhook_events'),
  ],
).enableRLS();

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    /** Bruto de origem; permite apagar e recalcular no reprocessamento. Nulo = inserção manual. */
    webhookEventId: uuid('webhook_event_id'),
    sourceId: uuid('source_id'),
    type: eventTypeEnum('type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    value: dinheiro('value'),
    currency: text('currency'),
    channel: text('channel').notNull().default('Outros'),
    campaign: text('campaign'),
    page: text('page'),
    leadKey: text('lead_key'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    referrer: text('referrer'),
    /** Clique marcado como base contatada (conta em base_contatada, não em cliques). */
    base: boolean('base').notNull().default(false),
    createdAt: criadoEm(),
  },
  (t) => [
    index('events_tenant_occurred_idx').on(t.tenantId, t.occurredAt),
    index('events_tenant_channel_idx').on(t.tenantId, t.channel),
    index('events_webhook_event_idx').on(t.webhookEventId),
    foreignKey({
      name: 'events_webhook_event_fk',
      columns: [t.tenantId, t.webhookEventId],
      foreignColumns: [webhookEvents.tenantId, webhookEvents.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'events_source_fk',
      columns: [t.tenantId, t.sourceId],
      foreignColumns: [sources.tenantId, sources.id],
    }).onDelete('cascade'),
    politicaTenant('events'),
  ],
).enableRLS();

export const metricsDaily = pgTable(
  'metrics_daily',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    /** Dia no fuso da empresa. */
    day: date('day').notNull(),
    channel: text('channel').notNull(),
    /** `''` = sem campanha (não usar NULL, senão o único não funciona). */
    campaign: text('campaign').notNull().default(''),
    /** `''` = sem página. */
    page: text('page').notNull().default(''),
    /** NULL = canal sem gasto (ex.: Afiliados); CPA e ROAS ficam nulos, nunca zero. */
    /**
     * Base contatada (1ª etapa do funil): envios de email/SMS ou cliques com `base=true`.
     * Linhas de canal reservado `__funil__` guardam o funil ilustrativo da empresa demo.
     */
    baseContatada: integer('base_contatada').notNull().default(0),
    investimento: dinheiro('investimento'),
    cliques: integer('cliques').notNull().default(0),
    visitas: integer('visitas').notNull().default(0),
    cadastros: integer('cadastros').notNull().default(0),
    ftds: integer('ftds').notNull().default(0),
    ftdsValor: dinheiro('ftds_valor').notNull().default('0'),
    depositos: dinheiro('depositos').notNull().default('0'),
    updatedAt: atualizadoEm(),
  },
  (t) => [
    uniqueIndex('metrics_daily_chave_unico').on(t.tenantId, t.day, t.channel, t.campaign, t.page),
    politicaTenant('metrics_daily'),
  ],
).enableRLS();

export const rules = pgTable(
  'rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    sourceId: uuid('source_id').notNull(),
    version: integer('version').notNull(),
    mapping: jsonb('mapping').notNull(),
    channelRules: jsonb('channel_rules').notNull().default([]),
    ativo: boolean('ativo').notNull().default(false),
    /** Autor da versão (histórico). */
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: criadoEm(),
  },
  (t) => [
    unique('rules_fonte_versao_unico').on(t.tenantId, t.sourceId, t.version),
    // Só uma versão ativa por fonte.
    uniqueIndex('rules_uma_ativa_por_fonte')
      .on(t.tenantId, t.sourceId)
      .where(sql`${t.ativo}`),
    foreignKey({
      name: 'rules_source_fk',
      columns: [t.tenantId, t.sourceId],
      foreignColumns: [sources.tenantId, sources.id],
    }).onDelete('cascade'),
    politicaTenant('rules'),
  ],
).enableRLS();

export const presentation = pgTable(
  'presentation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    nomeExibicao: text('nome_exibicao').notNull(),
    logoUrl: text('logo_url'),
    subtitulo: text('subtitulo'),
    kpis: jsonb('kpis').notNull().default([]),
    columns: jsonb('columns').notNull().default([]),
    /** Canais da empresa: nome, cor e ordem. */
    channels: jsonb('channels').notNull().default([]),
    palette: jsonb('palette').notNull().default({}),
    currency: text('currency').notNull().default('BRL'),
    timezone: text('timezone').notNull().default('America/Sao_Paulo'),
    updatedAt: atualizadoEm(),
  },
  (t) => [unique('presentation_tenant_unico').on(t.tenantId), politicaTenant('presentation')],
).enableRLS();

// ---------------------------------------------------------------------------
// Tipos inferidos
// ---------------------------------------------------------------------------

export type Tenant = typeof tenants.$inferSelect;
export type NovoTenant = typeof tenants.$inferInsert;
export type Usuario = typeof users.$inferSelect;
export type NovoUsuario = typeof users.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type NovaMembership = typeof memberships.$inferInsert;
export type Fonte = typeof sources.$inferSelect;
export type NovaFonte = typeof sources.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NovoWebhookEvent = typeof webhookEvents.$inferInsert;
export type Evento = typeof events.$inferSelect;
export type NovoEvento = typeof events.$inferInsert;
export type MetricaDiaria = typeof metricsDaily.$inferSelect;
export type NovaMetricaDiaria = typeof metricsDaily.$inferInsert;
export type Regra = typeof rules.$inferSelect;
export type NovaRegra = typeof rules.$inferInsert;
export type Apresentacao = typeof presentation.$inferSelect;
export type NovaApresentacao = typeof presentation.$inferInsert;
export type Role = (typeof ROLES)[number];
export type TipoEvento = (typeof TIPOS_EVENTO)[number];
export type StatusWebhook = (typeof STATUS_WEBHOOK)[number];
