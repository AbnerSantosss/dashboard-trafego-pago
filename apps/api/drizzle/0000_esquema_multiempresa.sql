CREATE TYPE "public"."event_type" AS ENUM('gasto', 'clique', 'visita', 'cadastro', 'ftd', 'deposito');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'analista', 'leitor');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('recebido', 'processado', 'erro');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"webhook_event_id" uuid,
	"source_id" uuid,
	"type" "event_type" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"value" numeric(14, 2),
	"currency" text,
	"channel" text DEFAULT 'Outros' NOT NULL,
	"campaign" text,
	"page" text,
	"lead_key" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"referrer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "role" DEFAULT 'leitor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_tenant_user_unico" UNIQUE("tenant_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "metrics_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"day" date NOT NULL,
	"channel" text NOT NULL,
	"campaign" text DEFAULT '' NOT NULL,
	"page" text DEFAULT '' NOT NULL,
	"investimento" numeric(14, 2),
	"cliques" integer DEFAULT 0 NOT NULL,
	"visitas" integer DEFAULT 0 NOT NULL,
	"cadastros" integer DEFAULT 0 NOT NULL,
	"ftds" integer DEFAULT 0 NOT NULL,
	"ftds_valor" numeric(14, 2) DEFAULT '0' NOT NULL,
	"depositos" numeric(14, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "metrics_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "presentation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome_exibicao" text NOT NULL,
	"logo_url" text,
	"subtitulo" text,
	"kpis" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"columns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"palette" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presentation_tenant_unico" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "presentation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"mapping" jsonb NOT NULL,
	"channel_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ativo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rules_fonte_versao_unico" UNIQUE("tenant_id","source_id","version")
);
--> statement-breakpoint
ALTER TABLE "rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"nome" text NOT NULL,
	"secret_hash" text NOT NULL,
	"rules_version" integer,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_tenant_slug_unico" UNIQUE("tenant_id","slug"),
	CONSTRAINT "sources_tenant_id_unico" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nome" text NOT NULL,
	"logo_url" text,
	"moeda" text DEFAULT 'BRL' NOT NULL,
	"fuso" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unico" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unico" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"event_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "webhook_status" DEFAULT 'recebido' NOT NULL,
	"erro" text,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "webhook_events_tenant_id_unico" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_webhook_event_fk" FOREIGN KEY ("tenant_id","webhook_event_id") REFERENCES "public"."webhook_events"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_source_fk" FOREIGN KEY ("tenant_id","source_id") REFERENCES "public"."sources"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_daily" ADD CONSTRAINT "metrics_daily_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation" ADD CONSTRAINT "presentation_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_source_fk" FOREIGN KEY ("tenant_id","source_id") REFERENCES "public"."sources"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_source_fk" FOREIGN KEY ("tenant_id","source_id") REFERENCES "public"."sources"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_tenant_occurred_idx" ON "events" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "events_tenant_channel_idx" ON "events" USING btree ("tenant_id","channel");--> statement-breakpoint
CREATE INDEX "events_webhook_event_idx" ON "events" USING btree ("webhook_event_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metrics_daily_chave_unico" ON "metrics_daily" USING btree ("tenant_id","day","channel","campaign","page");--> statement-breakpoint
CREATE UNIQUE INDEX "rules_uma_ativa_por_fonte" ON "rules" USING btree ("tenant_id","source_id") WHERE "rules"."ativo";--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_idempotencia_unico" ON "webhook_events" USING btree ("tenant_id","source_id","event_key");--> statement-breakpoint
CREATE INDEX "webhook_events_status_idx" ON "webhook_events" USING btree ("tenant_id","status","received_at");--> statement-breakpoint
CREATE POLICY "events_isolamento_tenant" ON "events" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "memberships_isolamento_tenant" ON "memberships" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "memberships_leitura_proprio_usuario" ON "memberships" AS PERMISSIVE FOR SELECT TO public USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "metrics_daily_isolamento_tenant" ON "metrics_daily" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "presentation_isolamento_tenant" ON "presentation" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "rules_isolamento_tenant" ON "rules" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sources_isolamento_tenant" ON "sources" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "webhook_events_isolamento_tenant" ON "webhook_events" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);