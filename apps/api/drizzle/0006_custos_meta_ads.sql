CREATE TABLE "custos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"dia" date NOT NULL,
	"canal" text NOT NULL,
	"campanha" text DEFAULT '' NOT NULL,
	"valor" numeric(14, 2) NOT NULL,
	"origem" text NOT NULL,
	"meta_conta_id" uuid,
	"ref_externa" text DEFAULT '' NOT NULL,
	"descricao" text,
	"criado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custos_origem_valida" CHECK ("custos"."origem" in ('manual', 'meta')),
	CONSTRAINT "custos_valor_nao_negativo" CHECK ("custos"."valor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "custos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "meta_contas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conta_id" text NOT NULL,
	"nome" text DEFAULT '' NOT NULL,
	"moeda" text,
	"canal" text DEFAULT 'Meta' NOT NULL,
	"token_enc" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ultima_sync" timestamp with time zone,
	"ultimo_erro" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meta_contas_tenant_conta_unico" UNIQUE("tenant_id","conta_id"),
	CONSTRAINT "meta_contas_tenant_id_unico" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "meta_contas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "custos" ADD CONSTRAINT "custos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custos" ADD CONSTRAINT "custos_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custos" ADD CONSTRAINT "custos_meta_conta_fk" FOREIGN KEY ("tenant_id","meta_conta_id") REFERENCES "public"."meta_contas"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_contas" ADD CONSTRAINT "meta_contas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custos_tenant_dia_idx" ON "custos" USING btree ("tenant_id","dia");--> statement-breakpoint
CREATE INDEX "custos_meta_conta_idx" ON "custos" USING btree ("tenant_id","meta_conta_id","dia");--> statement-breakpoint
CREATE POLICY "custos_isolamento_tenant" ON "custos" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "meta_contas_isolamento_tenant" ON "meta_contas" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "custos" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meta_contas" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "custos", "meta_contas" TO app_user;
