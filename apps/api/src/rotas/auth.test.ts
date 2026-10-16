import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import {
  appComBanco,
  bancoDisponivel,
  criarCenario,
  URL_APP,
  type Cenario,
} from '../auth/banco-teste.js';
import { emitirToken } from '../auth/plugin.js';
import { schemaEmpresaAtual, schemaMe, schemaSessaoDev, schemaTrocaEmpresa } from './auth.js';

describe('GET /ready com banco fora', () => {
  let app: App;

  beforeAll(async () => {
    // Porta 1 em localhost: conexão recusada na hora.
    app = await appComBanco('postgres://ninguem:nada@127.0.0.1:1/inexistente');
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('503 servico_indisponivel', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(503);
    expect(res.json().erro.codigo).toBe('servico_indisponivel');
  });

  it('/me sem token → 401 nao_autenticado (sem tocar no banco)', async () => {
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().erro.codigo).toBe('nao_autenticado');
  });
});

describe('CORS e rate limit', () => {
  it('CORS libera só WEB_URL, com credenciais', async () => {
    const app = await appComBanco();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/me',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'authorization,x-tenant',
      },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    const outro = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://malicioso.example' },
    });
    expect(outro.headers['access-control-allow-origin']).not.toBe('https://malicioso.example');
    await app.close();
  });

  it('acima do limite → 429 limite_excedido no contrato', async () => {
    const { buildApp } = await import('../app.js');
    const { carregarEnv } = await import('../env.js');
    const app = await buildApp({
      env: carregarEnv({ NODE_ENV: 'test' }),
      logger: false,
      limiteTaxa: 2,
    });
    for (let i = 0; i < 2; i++) await app.inject({ method: 'GET', url: '/health' });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(429);
    expect(res.json().erro).toMatchObject({ codigo: 'limite_excedido' });
    expect(res.json().erro.requestId).toBeTruthy();
    await app.close();
  });
});

const disponivel = await bancoDisponivel('rotas/auth.test');

describe.skipIf(!disponivel)('rotas de autenticação (com banco)', () => {
  let app: App;
  let c: Cenario;
  let token = '';

  beforeAll(async () => {
    c = await criarCenario(['leitor', 'admin']);
    app = await appComBanco();
    await app.ready();
    token = emitirToken(app, { sub: c.usuario.id, email: c.usuario.email, tenant: c.t1.id });
  });

  afterAll(async () => {
    await app?.close();
    await c?.limpar();
  });

  const auth = (t: string) => ({ authorization: `Bearer ${t}` });

  it('GET /ready → 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', banco: 'ok' });
  });

  it('GET /me lista as duas empresas com papel', async () => {
    const res = await app.inject({ method: 'GET', url: '/me', headers: auth(token) });
    expect(res.statusCode).toBe(200);
    const corpo = schemaMe.parse(res.json());
    expect(corpo.usuario.id).toBe(c.usuario.id);
    expect(corpo.empresaAtiva).toBe(c.t1.id);
    expect(corpo.empresas.map((e) => [e.id, e.papel]).sort()).toEqual(
      [
        [c.t1.id, 'leitor'],
        [c.t2.id, 'admin'],
      ].sort(),
    );
  });

  it('GET /empresas/atual reflete T1 (claim) e lê presentation sob RLS', async () => {
    const res = await app.inject({ method: 'GET', url: '/empresas/atual', headers: auth(token) });
    expect(res.statusCode).toBe(200);
    const corpo = schemaEmpresaAtual.parse(res.json());
    expect(corpo.empresa).toMatchObject({ id: c.t1.id, papel: 'leitor' });
    expect(corpo.apresentacao?.nomeExibicao).toBe(`Apres ${c.t1.slug}`);
  });

  it('POST /me/empresa troca para T2 e o /empresas/atual seguinte reflete T2', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/me/empresa',
      headers: auth(token),
      payload: { empresa: c.t2.slug },
    });
    expect(res.statusCode).toBe(200);
    const corpo = schemaTrocaEmpresa.parse(res.json());
    expect(corpo.empresa).toMatchObject({ id: c.t2.id, papel: 'admin' });
    expect(app.jwt.decode<{ tenant: string }>(corpo.token)?.tenant).toBe(c.t2.id);

    const atual = await app.inject({
      method: 'GET',
      url: '/empresas/atual',
      headers: auth(corpo.token),
    });
    expect(atual.statusCode).toBe(200);
    const a = schemaEmpresaAtual.parse(atual.json());
    expect(a.empresa).toMatchObject({ id: c.t2.id, papel: 'admin' });
    expect(a.apresentacao?.nomeExibicao).toBe(`Apres ${c.t2.slug}`);
  });

  it('POST /me/empresa para empresa sem membership → 403; corpo vazio → 400', async () => {
    const negado = await app.inject({
      method: 'POST',
      url: '/me/empresa',
      headers: auth(token),
      payload: { empresa: c.t3.slug },
    });
    expect(negado.statusCode).toBe(403);
    expect(negado.json().erro.codigo).toBe('acesso_negado');

    const invalido = await app.inject({
      method: 'POST',
      url: '/me/empresa',
      headers: auth(token),
      payload: {},
    });
    expect(invalido.statusCode).toBe(400);
    expect(invalido.json().erro.codigo).toBe('validacao_invalida');
  });

  it('x-tenant sobrepõe a claim; sem empresa → 400 empresa_nao_informada', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/empresas/atual',
      headers: { ...auth(token), 'x-tenant': c.t2.slug },
    });
    expect(res.json().empresa.id).toBe(c.t2.id);

    const semTenant = emitirToken(app, { sub: c.usuario.id, email: c.usuario.email });
    const vazio = await app.inject({
      method: 'GET',
      url: '/empresas/atual',
      headers: auth(semTenant),
    });
    expect(vazio.statusCode).toBe(400);
    expect(vazio.json().erro.codigo).toBe('empresa_nao_informada');
  });
});

describe.skipIf(!disponivel)('POST /auth/sessao-dev', () => {
  let app: App;
  let c: Cenario;

  beforeAll(async () => {
    c = await criarCenario(['leitor', 'admin']);
    app = await appComBanco();
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await c?.limpar();
  });

  it('devolve token aceito em /me', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/sessao-dev',
      payload: { email: c.usuario.email },
    });
    expect(res.statusCode).toBe(200);
    const corpo = schemaSessaoDev.parse(res.json());
    expect(corpo.usuario.id).toBe(c.usuario.id);
    expect(corpo.empresas).toHaveLength(2);
    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${corpo.token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().empresaAtiva).toBeNull();
  });

  it('e-mail desconhecido → 404 nao_encontrado', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/sessao-dev',
      payload: { email: 'ninguem-existe@teste.local' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().erro.codigo).toBe('nao_encontrado');
  });

  it('em produção a rota não existe', async () => {
    const { buildApp } = await import('../app.js');
    const { carregarEnv } = await import('../env.js');
    const prod = await buildApp({
      env: carregarEnv({
        NODE_ENV: 'production',
        DATABASE_URL: URL_APP,
        AUTH_SECRET: 'segredo-de-teste-somente-local-0123456789abcdef',
      }),
      logger: false,
    });
    const res = await prod.inject({
      method: 'POST',
      url: '/auth/sessao-dev',
      payload: { email: c.usuario.email },
    });
    expect(res.statusCode).toBe(404);
    await prod.close();
  });
});
