ALTER TABLE "users" ADD COLUMN "totp_segredo_enc" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_ativo_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_ultimo_passo" integer;