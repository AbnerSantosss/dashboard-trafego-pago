import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from './app.js';
import { appDeTeste } from './teste-util.js';

/**
 * Além de validar o documento, este teste grava `apps/api/docs/openapi.json`.
 * Para regenerar: `pnpm --filter @trafego/api exec vitest run src/openapi.test.ts`.
 */
const SAIDA = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/openapi.json');

let app: App;

beforeAll(async () => {
  app = await appDeTeste();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('OpenAPI', () => {
  it('/docs/json é um documento OpenAPI 3 com /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.paths['/health']).toBeDefined();
    const schema200 = doc.paths['/health'].get.responses['200'].content['application/json'].schema;
    expect(Object.keys(schema200.properties)).toEqual(
      expect.arrayContaining(['status', 'service', 'versao', 'uptime']),
    );

    mkdirSync(dirname(SAIDA), { recursive: true });
    writeFileSync(SAIDA, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  });

  it('/docs serve a interface do Swagger UI', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs' });
    expect([200, 302]).toContain(res.statusCode);
  });
});
