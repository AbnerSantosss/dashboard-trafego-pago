-- Só ambiente local: roda uma vez, quando o volume pgdata é criado.
-- Papel da aplicação, sujeito a RLS. Senha `app_user` é exclusiva do Postgres local.
-- Em produção o papel é criado pela migração 0001 (NOLOGIN) e a senha é definida fora do repositório.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;
