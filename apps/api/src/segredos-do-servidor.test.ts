import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { lerChaveCifra } from './admin/cifra.js';
import { aplicarSegredos } from './segredos-do-servidor.js';

const pasta = mkdtempSync(join(tmpdir(), 'segredos-'));
const hex = (c: string) => c.repeat(64);
writeFileSync(join(pasta, 'postgres_senha'), hex('a'));
writeFileSync(join(pasta, 'app_user_senha'), `${hex('b')}\n`);
writeFileSync(join(pasta, 'auth_secret'), hex('c'));
writeFileSync(join(pasta, 'webhook_chave_cifra'), hex('d'));

afterAll(() => rmSync(pasta, { recursive: true, force: true }));

describe('segredos gerados no servidor', () => {
  it('preenche as variáveis e as URLs do banco a partir dos arquivos', () => {
    const env: NodeJS.ProcessEnv = { APP_USER_SENHA: '' };
    aplicarSegredos(env, pasta);
    expect(env.APP_USER_SENHA).toBe(hex('b'));
    expect(env.AUTH_SECRET).toBe(hex('c'));
    expect(env.DATABASE_URL).toBe(`postgres://app_user:${hex('b')}@db:5432/trafego`);
    expect(env.DATABASE_ADMIN_URL).toBe(`postgres://postgres:${hex('a')}@db:5432/trafego`);
    // O formato gerado (64 caracteres hex) é aceito como chave de 32 bytes.
    expect(lerChaveCifra(env.WEBHOOK_CHAVE_CIFRA!)).toHaveLength(32);
  });

  it('variável já definida vale mais que o arquivo', () => {
    const env: NodeJS.ProcessEnv = { AUTH_SECRET: 'definido-a-mao', DATABASE_URL: 'postgres://x' };
    aplicarSegredos(env, pasta);
    expect(env.AUTH_SECRET).toBe('definido-a-mao');
    expect(env.DATABASE_URL).toBe('postgres://x');
  });

  it('sem a pasta, não mexe em nada', () => {
    const env: NodeJS.ProcessEnv = {};
    aplicarSegredos(env, join(pasta, 'nao-existe'));
    expect(env).toEqual({});
  });
});
