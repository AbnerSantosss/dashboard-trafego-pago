-- Migração escrita à mão (drizzle-kit generate --custom).
-- 1) Garante o papel `app_user` (sem senha aqui; local, o init SQL do compose já o cria com LOGIN).
-- 2) FORCE ROW LEVEL SECURITY: nem o dono da tabela escapa da política (superusuário escapa sempre).
-- 3) GRANTs de DML para `app_user`, que nunca tem BYPASSRLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;--> statement-breakpoint
ALTER ROLE app_user NOSUPERUSER NOBYPASSRLS;--> statement-breakpoint
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sources" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "webhook_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "metrics_daily" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rules" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "presentation" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
