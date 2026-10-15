import { describe, expect, it } from 'vitest';
import { carregarEnv, ErroEnv } from './env.js';

function capturar(fn: () => unknown): ErroEnv {
  try {
    fn();
  } catch (erro) {
    return erro as ErroEnv;
  }
  throw new Error('esperava ErroEnv');
}

describe('carregarEnv', () => {
  it('em teste aceita defaults seguros sem .env', () => {
    const env = carregarEnv({ NODE_ENV: 'test' });
    expect(env.API_PORT).toBe(3001);
    expect(env.DATABASE_URL).toMatch(/^postgres:\/\//);
    expect(env.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it('fora de teste, lista todas as variáveis faltando', () => {
    const e = capturar(() => carregarEnv({ NODE_ENV: 'development', AUTH_SECRET: '' }));
    expect(e).toBeInstanceOf(ErroEnv);
    expect(e.variaveis).toEqual(expect.arrayContaining(['DATABASE_URL', 'AUTH_SECRET']));
    expect(e.message).toContain('DATABASE_URL');
    expect(e.message).toContain('AUTH_SECRET');
  });

  it('em produção exige AUTH_SECRET com 32+ caracteres e não vaza o valor', () => {
    const segredo = 'curto-demais-123';
    const e = capturar(() =>
      carregarEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://u@h/db',
        AUTH_SECRET: segredo,
      }),
    );
    expect(e.variaveis).toEqual(['AUTH_SECRET']);
    expect(e.message).toContain('32');
    expect(e.message).not.toContain(segredo);
  });

  it('valida API_PORT, WEB_URL e LOG_LEVEL', () => {
    const e = capturar(() =>
      carregarEnv({
        NODE_ENV: 'test',
        API_PORT: 'abc',
        WEB_URL: 'nao-e-url',
        LOG_LEVEL: 'barulhento',
      }),
    );
    expect(e.variaveis).toEqual(expect.arrayContaining(['API_PORT', 'WEB_URL', 'LOG_LEVEL']));
    const env = carregarEnv({ NODE_ENV: 'test', API_PORT: '4000', LOG_LEVEL: 'debug' });
    expect(env.API_PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe('debug');
  });
});
