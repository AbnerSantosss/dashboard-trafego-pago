/**
 * Produção (D39): os segredos são gerados no próprio servidor pelo serviço `segredos` da stack e
 * ficam em arquivos de /run/segredos; ninguém os digita nem os vê. Este módulo entra com `--import`
 * antes do preparo e do servidor e preenche as variáveis a partir dos arquivos. Uma variável já
 * definida (não vazia) vale mais que o arquivo. Sem a pasta (dev, testes, CI), não faz nada.
 */
import { existsSync, readFileSync } from 'node:fs';

export const PASTA_SEGREDOS = '/run/segredos';

/** Banco da stack: o serviço `db` do docker-compose.prod.yml. */
const BANCO = 'db:5432/trafego';

export function aplicarSegredos(env: NodeJS.ProcessEnv, pasta = PASTA_SEGREDOS): void {
  if (!existsSync(pasta)) return;
  const ler = (arquivo: string) => readFileSync(`${pasta}/${arquivo}`, 'utf8').trim();
  const definir = (chave: string, valor: () => string) => {
    if (!env[chave]) env[chave] = valor();
  };
  definir('POSTGRES_SENHA', () => ler('postgres_senha'));
  definir('APP_USER_SENHA', () => ler('app_user_senha'));
  definir('AUTH_SECRET', () => ler('auth_secret'));
  definir('WEBHOOK_CHAVE_CIFRA', () => ler('webhook_chave_cifra'));
  definir('DATABASE_URL', () => `postgres://app_user:${env.APP_USER_SENHA}@${BANCO}`);
  definir('DATABASE_ADMIN_URL', () => `postgres://postgres:${env.POSTGRES_SENHA}@${BANCO}`);
}

aplicarSegredos(process.env);
