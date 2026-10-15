import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from './app.js';
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
