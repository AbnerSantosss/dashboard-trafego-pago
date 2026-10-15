import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { App } from './app.js';
import { ErroApi } from './erros.js';
import { appDeTeste } from './teste-util.js';

let app: App;

beforeAll(async () => {
  app = await appDeTeste();
  // Rotas só de teste, para exercitar o contrato.
  app.post(
    '/teste/validacao',
    { schema: { body: z.object({ nome: z.string().min(2), idade: z.number().int() }) } },
    async () => ({ ok: true }),
  );
  app.get('/teste/conflito', async () => {
    throw ErroApi.de('conflito', 'Já existe uma empresa com esse slug.', { campo: 'slug' });
  });
  app.get('/teste/assinatura', async () => {
    throw new ErroApi(401, 'assinatura_invalida', 'Assinatura HMAC inválida.');
  });
  app.get('/teste/sensible', async (_req, reply) => reply.forbidden('Sem permissão.'));
  app.get('/teste/limite', async (_req, reply) => reply.tooManyRequests());
  app.get('/teste/explode', async () => {
    throw new Error('detalhe interno: senha=xyz');
  });
  app.post('/teste/corpo', async () => ({ ok: true }));
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const formato = expect.objectContaining({
  erro: expect.objectContaining({
    codigo: expect.any(String),
    mensagem: expect.any(String),
    requestId: expect.any(String),
  }),
});

describe('contrato de erros', () => {
  it('rota inexistente devolve 404 no contrato', async () => {
    const res = await app.inject({ method: 'GET', url: '/nao-existe?x=1' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual(formato);
    expect(res.json().erro.codigo).toBe('nao_encontrado');
    expect(res.json().erro.mensagem).toBe('Rota GET /nao-existe não encontrada.');
  });

  it('erro de validação devolve 400 com detalhes por campo', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/teste/validacao',
      payload: { nome: 'a', idade: 'x' },
    });
    expect(res.statusCode).toBe(400);
    const { erro } = res.json();
    expect(erro.codigo).toBe('validacao_invalida');
    expect(erro.detalhes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ origem: 'body', campo: 'nome' }),
        expect.objectContaining({ origem: 'body', campo: 'idade' }),
      ]),
    );
  });

  it('requestId da resposta de erro bate com o cabeçalho x-request-id', async () => {
    const res = await app.inject({ method: 'GET', url: '/nao-existe' });
    expect(res.json().erro.requestId).toBe(res.headers['x-request-id']);
    expect(res.json().erro.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('ErroApi vira status e código próprios, com detalhes', async () => {
    const res = await app.inject({ method: 'GET', url: '/teste/conflito' });
    expect(res.statusCode).toBe(409);
    expect(res.json().erro).toMatchObject({ codigo: 'conflito', detalhes: { campo: 'slug' } });
    const r401 = await app.inject({ method: 'GET', url: '/teste/assinatura' });
    expect(r401.statusCode).toBe(401);
    expect(r401.json().erro.codigo).toBe('assinatura_invalida');
  });

  it('erros do @fastify/sensible caem no contrato (403, 429)', async () => {
    const r403 = await app.inject({ method: 'GET', url: '/teste/sensible' });
    expect(r403.statusCode).toBe(403);
    expect(r403.json().erro).toMatchObject({ codigo: 'acesso_negado', mensagem: 'Sem permissão.' });
    const r429 = await app.inject({ method: 'GET', url: '/teste/limite' });
    expect(r429.statusCode).toBe(429);
    expect(r429.json().erro.codigo).toBe('limite_excedido');
  });

  it('500 não vaza mensagem nem stack', async () => {
    const res = await app.inject({ method: 'GET', url: '/teste/explode' });
    expect(res.statusCode).toBe(500);
    expect(res.json().erro.codigo).toBe('erro_interno');
    expect(res.body).not.toContain('senha');
    expect(res.body).not.toContain('at ');
  });

  it('corpo acima de 1 MB devolve 413 corpo_grande', async () => {
    const grande = JSON.stringify({ dados: 'x'.repeat(1024 * 1024 + 10) });
    const res = await app.inject({
      method: 'POST',
      url: '/teste/corpo',
      headers: { 'content-type': 'application/json' },
      payload: grande,
    });
    expect(res.statusCode).toBe(413);
    expect(res.json().erro.codigo).toBe('corpo_grande');
  });

  it('JSON malformado devolve 400 json_invalido', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/teste/corpo',
      headers: { 'content-type': 'application/json' },
      payload: '{"a":',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().erro.codigo).toBe('json_invalido');
  });
});
