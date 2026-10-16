import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { carregarEnv } from './env.js';

describe('logs estruturados', () => {
  it('incluem requestId e omitem authorization, x-signature e cookie', async () => {
    const linhas: string[] = [];
    const app = await buildApp({
      env: carregarEnv({ NODE_ENV: 'test', LOG_LEVEL: 'info' }),
      destinoLog: { write: (msg) => void linhas.push(msg) },
    });
    // Loga os cabeçalhos da requisição para exercitar a redaction.
    app.addHook('onRequest', async (request) => {
      request.log.info({ headers: request.headers }, 'cabeçalhos');
    });
    await app.ready();

    // /health loga só a partir de warn (healthcheck do contêiner); uma rota qualquer loga em info.
    const res = await app.inject({
      method: 'GET',
      url: '/rota-inexistente',
      headers: {
        authorization: 'Bearer token-ficticio-abc',
        'x-signature': 'assinatura-ficticia-xyz',
        cookie: 'sessao=valor-ficticio',
      },
    });
    await app.close();

    const texto = linhas.join('');
    const requestId = res.headers['x-request-id'];
    expect(texto).toContain(`"requestId":"${requestId}"`);
    expect(texto).toContain('[omitido]');
    expect(texto).not.toContain('token-ficticio-abc');
    expect(texto).not.toContain('assinatura-ficticia-xyz');
    expect(texto).not.toContain('valor-ficticio');
  });
});
