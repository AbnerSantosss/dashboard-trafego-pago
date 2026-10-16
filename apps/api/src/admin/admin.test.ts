/**
 * Rotas de administração (P5.1 e P5.2) contra o Postgres local. Pula com aviso sem banco.
 * Cenário: usuário `leitor` em T1, `admin` em T2; T3 é de outra empresa (sem membership).
 */
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../app.js';
import { carregarEnv } from '../env.js';
import {
  appComBanco,
  URL_APP,
  bancoDisponivel,
  criarCenario,
  type Cenario,
} from '../auth/banco-teste.js';
import { emitirToken } from '../auth/plugin.js';
import { comTenant, sources, users, type Db } from '../db/client.js';
import { executarSeed } from '../db/seed.js';
import { gravarCache, lerCache } from '../metricas/cache.js';
import { segredoConfereComHash } from '../webhooks/segredos.js';
import { criarFonte, dbTeste, requisicaoAssinada } from '../webhooks/teste-util.js';

const disponivel = await bancoDisponivel('admin/admin.test');

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  randomBytes(16),
]).toString('base64');

describe.skipIf(!disponivel)('administração por empresa', () => {
  let c: Cenario;
  let db: Db;
  let app: App;
  let token = '';
  let fonteT3 = '';

  beforeAll(async () => {
    c = await criarCenario(['leitor', 'admin']);
    db = dbTeste();
    fonteT3 = (await criarFonte(db, c.t3, 'alheia')).sourceId;
    app = await appComBanco();
    await app.ready();
    token = emitirToken(app, { sub: c.usuario.id, email: c.usuario.email });
  });

  afterAll(async () => {
    await app?.close();
    await db?.$client.end({ timeout: 5 });
    await c?.limpar();
  });

  const req = (method: 'GET' | 'POST' | 'PATCH', url: string, tenant: string, payload?: object) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}`, 'x-tenant': tenant },
      ...(payload ? { payload } : {}),
    });

  describe('papel', () => {
    it.each([
      ['GET', '/empresas/atual/apresentacao'],
      ['PATCH', '/empresas/atual/apresentacao'],
      ['GET', '/empresas/atual/fontes'],
      ['POST', '/empresas/atual/fontes'],
    ] as const)('leitor recebe 403 acesso_negado em %s %s', async (m, url) => {
      const res = await req(m, url, c.t1.slug, m === 'GET' ? undefined : { nome: 'x', slug: 'xx' });
      expect(res.statusCode).toBe(403);
      expect(res.json().erro.codigo).toBe('acesso_negado');
    });

    it('sem token → 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/empresas/atual/fontes' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('apresentação', () => {
    it('GET devolve o contrato; empresa sem padrão tem logoPadraoUrl null', async () => {
      const res = await req('GET', '/empresas/atual/apresentacao', c.t2.slug);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        nomeExibicao: `Apres ${c.t2.slug}`,
        logoUrl: null,
        logoPadraoUrl: null,
      });
      expect(new Date(res.json().atualizadoEm).toISOString()).toBe(res.json().atualizadoEm);
    });

    it('PATCH nome (trim) e logo PNG; limpa o cache de métricas da empresa', async () => {
      gravarCache(`${c.t2.id}|x`, 1);
      const res = await req('PATCH', '/empresas/atual/apresentacao', c.t2.slug, {
        nomeExibicao: '  Nova Marca  ',
        logo: { tipo: 'image/png', base64: PNG },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        nomeExibicao: 'Nova Marca',
        logoUrl: `data:image/png;base64,${PNG}`,
      });
      expect(lerCache(`${c.t2.id}|x`)).toBeUndefined();

      const so = await req('PATCH', '/empresas/atual/apresentacao', c.t2.slug, { logo: null });
      expect(so.json()).toMatchObject({ nomeExibicao: 'Nova Marca', logoUrl: null });
    });

    it('nome vazio → 400; SVG com script → 422; > 512 KB → 413', async () => {
      const vazio = await req('PATCH', '/empresas/atual/apresentacao', c.t2.slug, {
        nomeExibicao: '   ',
      });
      expect(vazio.statusCode).toBe(400);
      const svg = await req('PATCH', '/empresas/atual/apresentacao', c.t2.slug, {
        logo: {
          tipo: 'image/svg+xml',
          base64: Buffer.from('<svg><script>x</script></svg>').toString('base64'),
        },
      });
      expect(svg.statusCode).toBe(422);
      expect(svg.json().erro.codigo).toBe('logo_invalido');
      const grande = Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(513 * 1024)]);
      const g = await req('PATCH', '/empresas/atual/apresentacao', c.t2.slug, {
        logo: { tipo: 'image/png', base64: grande.toString('base64') },
      });
      expect(g.statusCode).toBe(413);
      expect(g.json().erro.codigo).toBe('logo_grande');
    });

    it('PASIO tem logoPadraoUrl /brand/pasio-logo.png', async () => {
      const seed = await executarSeed(db);
      const [u] = await db.select().from(users).where(eq(users.id, seed.userId));
      const t = emitirToken(app, { sub: seed.userId, email: u!.email });
      const res = await app.inject({
        method: 'GET',
        url: '/empresas/atual/apresentacao',
        headers: { authorization: `Bearer ${t}`, 'x-tenant': 'pasio' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().logoPadraoUrl).toBe('/brand/pasio-logo.png');
    });
  });

  describe('fontes', () => {
    let id = '';
    let segredo = '';

    it('POST cria (201), grava hash + cifra e devolve o segredo uma vez', async () => {
      const res = await req('POST', '/empresas/atual/fontes', c.t2.slug, {
        slug: 'meta-ads',
        nome: 'Meta Ads',
      });
      expect(res.statusCode).toBe(201);
      const corpo = res.json();
      expect(corpo.fonte).toMatchObject({
        slug: 'meta-ads',
        nome: 'Meta Ads',
        ativo: true,
        caminho: `/webhooks/${c.t2.slug}/meta-ads`,
        segredoUtilizavel: true,
      });
      expect(Buffer.from(corpo.segredo, 'base64url')).toHaveLength(32);
      id = corpo.fonte.id;
      segredo = corpo.segredo;
      const [linha] = await comTenant(db, c.t2.id, (tx) =>
        tx.select().from(sources).where(eq(sources.id, id)),
      );
      expect(linha!.secretEnc).toMatch(/^v1\$/);
      expect(linha!.secretEnc).not.toContain(segredo);
      expect(await segredoConfereComHash(segredo, linha!.secretHash)).toBe(true);
    });

    it('slug repetido → 409 fonte_existente; slug inválido → 400', async () => {
      const dup = await req('POST', '/empresas/atual/fontes', c.t2.slug, {
        slug: 'meta-ads',
        nome: 'x',
      });
      expect(dup.statusCode).toBe(409);
      expect(dup.json().erro.codigo).toBe('fonte_existente');
      const inv = await req('POST', '/empresas/atual/fontes', c.t2.slug, { slug: 'A', nome: 'x' });
      expect(inv.statusCode).toBe(400);
    });

    it('GET lista; PATCH renomeia e desativa', async () => {
      const lista = await req('GET', '/empresas/atual/fontes', c.t2.slug);
      expect(lista.json().fontes.map((f: { slug: string }) => f.slug)).toEqual(['meta-ads']);
      const res = await req('PATCH', `/empresas/atual/fontes/${id}`, c.t2.slug, {
        nome: 'Meta',
        ativo: false,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ nome: 'Meta', ativo: false });
      await req('PATCH', `/empresas/atual/fontes/${id}`, c.t2.slug, { ativo: true });
    });

    it('webhook assinado valida pelo segredo do banco; rotação invalida o antigo', async () => {
      const ok = await app.inject(requisicaoAssinada(c.t2.slug, 'meta-ads', segredo));
      expect(ok.statusCode).toBe(202);

      const rot = await req('POST', `/empresas/atual/fontes/${id}/segredo`, c.t2.slug);
      expect(rot.statusCode).toBe(200);
      const novo = rot.json().segredo as string;
      expect(novo).not.toBe(segredo);
      expect(rot.json().fonte.id).toBe(id);

      const antigo = await app.inject(requisicaoAssinada(c.t2.slug, 'meta-ads', segredo));
      expect(antigo.statusCode).toBe(401);
      expect(antigo.json().erro.codigo).toBe('assinatura_invalida');
      const atual = await app.inject(requisicaoAssinada(c.t2.slug, 'meta-ads', novo));
      expect(atual.statusCode).toBe(202);
    });

    it('isolamento: admin de T2 não vê nem altera fonte de T3', async () => {
      const lista = await req('GET', '/empresas/atual/fontes', c.t2.slug);
      expect(lista.json().fontes.some((f: { id: string }) => f.id === fonteT3)).toBe(false);
      const p = await req('PATCH', `/empresas/atual/fontes/${fonteT3}`, c.t2.slug, { nome: 'x' });
      expect(p.statusCode).toBe(404);
      expect(p.json().erro.codigo).toBe('fonte_nao_encontrada');
      const s = await req('POST', `/empresas/atual/fontes/${fonteT3}/segredo`, c.t2.slug);
      expect(s.statusCode).toBe(404);
      const outra = await req('GET', '/empresas/atual/fontes', c.t3.slug);
      expect(outra.statusCode).toBe(403);
    });
  });

  it('segredo criado/rotacionado nunca aparece no log (nível trace)', async () => {
    const linhas: string[] = [];
    const appLog = await buildApp({
      env: carregarEnv({ NODE_ENV: 'test', LOG_LEVEL: 'trace', DATABASE_URL: URL_APP }),
      destinoLog: { write: (msg) => void linhas.push(msg) },
    });
    await appLog.ready();
    const h = { authorization: `Bearer ${token}`, 'x-tenant': c.t2.slug };
    const cr = await appLog.inject({
      method: 'POST',
      url: '/empresas/atual/fontes',
      headers: h,
      payload: { slug: 'log-teste', nome: 'Log' },
    });
    const rot = await appLog.inject({
      method: 'POST',
      url: `/empresas/atual/fontes/${cr.json().fonte.id}/segredo`,
      headers: h,
    });
    await appLog.close();
    const texto = linhas.join('');
    expect(texto).toContain('fonte criada');
    expect(texto).not.toContain(cr.json().segredo);
    expect(texto).not.toContain(rot.json().segredo);
  });
});
