import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, chaveLimite, urlParaLog, type App } from './app.js';
import { carregarEnv } from './env.js';
import { schemaHealth } from './rotas/health.js';
import { appDeTeste } from './teste-util.js';

let app: App;

beforeAll(async () => {
  app = await appDeTeste();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('responde 200 no schema { status, service, versao, uptime }', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const corpo = schemaHealth.parse(res.json());
    expect(corpo.status).toBe('ok');
    expect(corpo.service).toBe('api');
    expect(corpo.uptime).toBeGreaterThanOrEqual(0);
  });

  it('ecoa x-request-id gerado (UUID) quando o cliente não envia', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reaproveita x-request-id enviado pelo cliente', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'abc-123' },
    });
    expect(res.headers['x-request-id']).toBe('abc-123');
  });
});

describe('cabeçalhos de segurança', () => {
  it('toda resposta sai com nosniff, DENY, no-referrer e CSP fechada; sem HSTS fora de produção', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });

  it('em produção liga HSTS e tira o /docs', async () => {
    const prod = await buildApp({
      env: carregarEnv({
        NODE_ENV: 'production',
        // Banco que não existe: /health e /docs não consultam, e o postgres.js só conecta ao usar.
        DATABASE_URL: 'postgres://ninguem:ninguem@127.0.0.1:1/nenhum',
        AUTH_SECRET: 'segredo-de-teste-somente-local-0123456789abcdef',
        WEBHOOK_CHAVE_CIFRA: 'ab'.repeat(32),
      }),
      logger: false,
    });
    try {
      const res = await prod.inject({ method: 'GET', url: '/health' });
      expect(res.headers['strict-transport-security']).toBe('max-age=31536000');
      const docs = await prod.inject({ method: 'GET', url: '/docs' });
      expect(docs.statusCode).toBe(404);
    } finally {
      await prod.close();
    }
  });
});

describe('urlParaLog e chaveLimite', () => {
  it('omite o token do convite no log e mantém o resto da URL', () => {
    expect(urlParaLog('/convites/abc.def-123/aceitar')).toBe('/convites/[omitido]/aceitar');
    expect(urlParaLog('/convites/abc?x=1')).toBe('/convites/[omitido]?x=1');
    expect(urlParaLog('/metricas/visao-geral?de=2025-01-01')).toBe(
      '/metricas/visao-geral?de=2025-01-01',
    );
  });

  it('usa o IP da borda quando válido e agrupa IPv6 por /64', () => {
    const req = (ip: string, borda?: string) => ({
      ip,
      headers: borda ? { 'cf-connecting-ip': borda } : {},
    });
    expect(chaveLimite(req('10.0.0.5'))).toBe('10.0.0.5');
    expect(chaveLimite(req('10.0.0.5', '203.0.113.9'))).toBe('203.0.113.9');
    expect(chaveLimite(req('10.0.0.5', 'lixo'))).toBe('10.0.0.5');
    expect(chaveLimite(req('10.0.0.5', '2001:DB8:1:2:aaaa::1'))).toBe('2001:db8:1:2::/64');
    expect(chaveLimite(req('2001:db8::1'))).toBe('2001:db8:0:0::/64');
    expect(chaveLimite(req('::ffff:10.0.0.5'))).toBe('::ffff:10.0.0.5');
  });
});
