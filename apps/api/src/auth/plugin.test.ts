import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { presentation } from '../db/client.js';
import { appDeTeste } from '../teste-util.js';
import { appComBanco, bancoDisponivel, criarCenario, type Cenario } from './banco-teste.js';
import { emitirToken, papelAtende } from './plugin.js';

const UM_UUID = '11111111-1111-4111-8111-111111111111';
const SEGREDO_TESTE = 'segredo-de-teste-somente-local-0123456789abcdef';

/** Assina um JWT HS256 à mão (para simular outro segredo ou token expirado). */
function assinarHs256(segredo: string, payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64(payload);
  return corpo + '.' + createHmac('sha256', segredo).update(corpo).digest('base64url');
}

describe('hierarquia de papéis', () => {
  it('admin > analista > leitor', () => {
    expect(papelAtende('admin', 'analista')).toBe(true);
    expect(papelAtende('analista', 'analista')).toBe(true);
    expect(papelAtende('leitor', 'analista')).toBe(false);
    expect(papelAtende('analista', 'admin')).toBe(false);
  });
});

describe('autenticação por JWT (sem banco)', () => {
  let app: App;

  beforeAll(async () => {
    app = await appDeTeste();
    app.get('/teste/protegida', { preHandler: app.autenticar }, async (req) => req.usuario);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sem token → 401 nao_autenticado', async () => {
    const res = await app.inject({ method: 'GET', url: '/teste/protegida' });
    expect(res.statusCode).toBe(401);
    expect(res.json().erro.codigo).toBe('nao_autenticado');
  });

  it('token assinado com outro segredo → 401 token_invalido', async () => {
    const token = assinarHs256('outro-segredo-qualquer-0123456789abcdef', {
      sub: UM_UUID,
      email: 'a@teste.local',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/teste/protegida',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().erro.codigo).toBe('token_invalido');
  });

  it('token expirado → 401 token_invalido', async () => {
    const agora = Date.now();
    const expirado = assinarHs256(SEGREDO_TESTE, {
      sub: UM_UUID,
      email: 'a@teste.local',
      iat: Math.floor(agora / 1000) - 120,
      exp: Math.floor(agora / 1000) - 60,
    });
    const res = await app.inject({
      method: 'GET',
      url: '/teste/protegida',
      headers: { authorization: `Bearer ${expirado}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().erro).toMatchObject({
      codigo: 'token_invalido',
      mensagem: 'Token expirado.',
    });
  });

  it('token lixo → 401 token_invalido; claims inválidas → 401', async () => {
    const lixo = await app.inject({
      method: 'GET',
      url: '/teste/protegida',
      headers: { authorization: 'Bearer abc.def.ghi' },
    });
    expect(lixo.statusCode).toBe(401);
    expect(lixo.json().erro.codigo).toBe('token_invalido');

    const semSub = app.jwt.sign({ email: 'a@teste.local' } as never);
    const res = await app.inject({
      method: 'GET',
      url: '/teste/protegida',
      headers: { authorization: `Bearer ${semSub}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().erro.codigo).toBe('token_invalido');
  });
});

const disponivel = await bancoDisponivel('auth/plugin.test');

describe.skipIf(!disponivel)('papéis por empresa e isolamento (com banco)', () => {
  let app: App;
  let c: Cenario;
  let token = '';

  beforeAll(async () => {
    c = await criarCenario(['leitor', 'admin']);
    app = await appComBanco();
    app.get('/teste/protegida', { preHandler: app.autenticar }, async (req) => req.usuario);
    app.get('/teste/admin', { preHandler: app.exigirPapel('admin') }, async (req) => ({
      empresa: req.empresa,
    }));
    app.get('/teste/apresentacao', { preHandler: app.exigirEmpresa }, async (req) =>
      req.comTenant((tx) =>
        tx
          .select({ tenantId: presentation.tenantId, nome: presentation.nomeExibicao })
          .from(presentation),
      ),
    );
    await app.ready();
    token = emitirToken(app, { sub: c.usuario.id, email: c.usuario.email });
  });

  afterAll(async () => {
    await app?.close();
    await c?.limpar();
  });

  const pedir = (url: string, tenant?: string) =>
    app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}`, ...(tenant ? { 'x-tenant': tenant } : {}) },
    });

  it('token válido → 200 com request.usuario', async () => {
    const res = await pedir('/teste/protegida');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: c.usuario.id, email: c.usuario.email });
  });

  it('token bem assinado de usuário que não existe → 401 token_invalido', async () => {
    const fantasma = emitirToken(app, { sub: UM_UUID, email: 'a@teste.local' });
    const res = await app.inject({
      method: 'GET',
      url: '/teste/protegida',
      headers: { authorization: `Bearer ${fantasma}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().erro.codigo).toBe('token_invalido');
  });

  it('exigirPapel(admin) em T1 (leitor) → 403 acesso_negado', async () => {
    const res = await pedir('/teste/admin', c.t1.slug);
    expect(res.statusCode).toBe(403);
    expect(res.json().erro.codigo).toBe('acesso_negado');
  });

  it('exigirPapel(admin) em T2 (admin) → 200, por slug ou por id', async () => {
    for (const ref of [c.t2.slug, c.t2.id]) {
      const res = await pedir('/teste/admin', ref);
      expect(res.statusCode).toBe(200);
      expect(res.json().empresa).toMatchObject({ id: c.t2.id, papel: 'admin' });
    }
  });

  it('empresa sem membership → 403 acesso_negado', async () => {
    const res = await pedir('/teste/apresentacao', c.t3.slug);
    expect(res.statusCode).toBe(403);
    expect(res.json().erro.codigo).toBe('acesso_negado');
    const inexistente = await pedir('/teste/apresentacao', 'nao-existe-' + c.sufixo);
    expect(inexistente.statusCode).toBe(403);
  });

  it('sem empresa informada → 400 empresa_nao_informada', async () => {
    const res = await pedir('/teste/apresentacao');
    expect(res.statusCode).toBe(400);
    expect(res.json().erro.codigo).toBe('empresa_nao_informada');
  });

  it('isolamento: com T1 ativa, presentation nunca devolve a linha de T2 (nem de T3)', async () => {
    const res = await pedir('/teste/apresentacao', c.t1.slug);
    expect(res.statusCode).toBe(200);
    const linhas = res.json() as { tenantId: string }[];
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.tenantId).toBe(c.t1.id);
    expect(linhas.some((l) => l.tenantId === c.t2.id || l.tenantId === c.t3.id)).toBe(false);
  });

  it('claim tenant no token vale quando não há x-tenant', async () => {
    const comTenant = emitirToken(app, {
      sub: c.usuario.id,
      email: c.usuario.email,
      tenant: c.t2.id,
    });
    const res = await app.inject({
      method: 'GET',
      url: '/teste/apresentacao',
      headers: { authorization: `Bearer ${comTenant}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([expect.objectContaining({ tenantId: c.t2.id })]);
  });
});
