import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.js';
import { bancoDisponivel, criarCenario, type Cenario } from '../auth/banco-teste.js';
import { emitirToken } from '../auth/plugin.js';
import { comTenant, webhookEvents, type Db } from '../db/client.js';
import type { FilaMemoria } from '../webhooks/fila.js';
import {
  appWebhooks,
  criarFonte,
  dbTeste,
  requisicaoAssinada,
  type FonteTeste,
} from '../webhooks/teste-util.js';

const disponivel = await bancoDisponivel('rotas/webhooks.test');

/** USER_CREATED no formato observado da GTech, com valores fictícios. */
const USER_CREATED_FICTICIO = {
  event: 'USER_CREATED',
  user_id: 90001,
  user_token: 'tok-ficticio-123',
  name: 'Jogador Teste',
  email: 'jogador.teste@example.com',
  user_birth_date: '1990-01-01',
  referral_code: 'REFFICTICIO',
  username: 'jogadorteste',
  phone: null,
  document: null,
  active: true,
  is_demo: false,
  created_at: '2026-10-20T13:29:25.123-03:00',
  domain: 'latam.gtech.uy',
  tracker: {
    utm_source: 'facebook',
    utm_campaign: 'campanha-teste',
    utm_term: null,
    utm_content: null,
    placement: null,
    utm_medium: 'cpc',
    fbp: 'fb.1.1700000000000.123456789',
    fbc: null,
    user_agent: 'Mozilla/5.0 (teste)',
    afp: null,
    shareCode: null,
    source_id: null,
    event_id: null,
    campaign_id: null,
  },
};

/** Requisição como a GTech envia: só `Authorization: Basic`, charset no Content-Type, sem UA. */
function requisicaoBasic(
  empresa: string,
  fonte: string,
  o: { corpo?: string | object; usuario?: string; senha?: string; authorization?: string } = {},
) {
  const corpo = typeof o.corpo === 'string' ? o.corpo : JSON.stringify(o.corpo ?? { a: 1 });
  const credencial = Buffer.from(`${o.usuario ?? fonte}:${o.senha ?? ''}`, 'utf8').toString(
    'base64',
  );
  return {
    method: 'POST' as const,
    url: `/webhooks/${empresa}/${fonte}`,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      authorization: o.authorization ?? `Basic ${credencial}`,
    } as Record<string, string>,
    payload: corpo,
  };
}

describe.skipIf(!disponivel)('POST /webhooks/:empresa/:fonte', () => {
  let c: Cenario;
  let db: Db;
  let f: FonteTeste;
  let app: App;
  let fila: FilaMemoria;

  beforeAll(async () => {
    c = await criarCenario(['analista', 'admin']);
    db = dbTeste();
    f = await criarFonte(db, c.t1, 'demo');
    await criarFonte(db, c.t1, 'inativa', false);
    ({ app, fila } = await appWebhooks([f]));
  });

  afterAll(async () => {
    await app?.close();
    await db?.$client.end({ timeout: 5 });
    await c?.limpar();
  });

  const envio = (o: Parameters<typeof requisicaoAssinada>[3] = {}) =>
    requisicaoAssinada(f.tenantSlug, f.slug, f.segredo, o);

  it('202, grava bruto sem X-Signature e enfileira', async () => {
    const corpo = { event: 'first_deposit', amount: 5000, user: { id: 'u1' } };
    const res = await app.inject(envio({ corpo, eventId: 'evt-1' }));
    expect(res.statusCode).toBe(202);
    const { id, status } = res.json();
    expect(status).toBe('recebido');
    const [linha] = await comTenant(db, f.tenantId, (tx) =>
      tx.select().from(webhookEvents).where(eq(webhookEvents.id, id)),
    );
    expect(linha).toMatchObject({ eventKey: 'evt-1', status: 'recebido', payload: corpo });
    expect(linha!.headers).not.toHaveProperty('x-signature');
    expect(linha!.headers).toMatchObject({ 'x-event-id': 'evt-1' });
    expect(fila.processar).toContainEqual({ tenantId: f.tenantId, webhookEventId: id });
  });

  it('mesmo X-Event-Id → 200 duplicado, sem reenfileirar', async () => {
    const antes = fila.processar.length;
    const res = await app.inject(envio({ eventId: 'evt-1', corpo: { outro: true } }));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ duplicado: true });
    expect(fila.processar.length).toBe(antes);
  });

  it('sem X-Event-Id usa SHA-256 do corpo', async () => {
    const corpo = '{"event":"click","n":42}';
    const r1 = await app.inject(envio({ corpo, eventId: null }));
    expect(r1.statusCode).toBe(202);
    const r2 = await app.inject(envio({ corpo, eventId: null }));
    expect(r2.statusCode).toBe(200);
    expect(r2.json().id).toBe(r1.json().id);
  });

  it('assinatura errada → 401 assinatura_invalida', async () => {
    const res = await app.inject(envio({ segredo: 'outro-segredo' }));
    expect(res.statusCode).toBe(401);
    expect(res.json().erro.codigo).toBe('assinatura_invalida');
  });

  it('corpo alterado depois de assinar → 401', async () => {
    const req = envio({ corpo: { a: 1 } });
    const res = await app.inject({ ...req, payload: '{"a":2}' });
    expect(res.statusCode).toBe(401);
  });

  it('timestamp fora da janela → 401 timestamp_fora_da_janela', async () => {
    const res = await app.inject(envio({ timestamp: Math.floor(Date.now() / 1000) - 301 }));
    expect(res.statusCode).toBe(401);
    expect(res.json().erro.codigo).toBe('timestamp_fora_da_janela');
  });

  it('sem cabeçalhos → 400 cabecalho_ausente', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/webhooks/${f.tenantSlug}/demo`,
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().erro.codigo).toBe('cabecalho_ausente');
  });

  it('JSON inválido (assinado) → 400 json_invalido', async () => {
    const res = await app.inject(envio({ corpo: '{nao é json' }));
    expect(res.statusCode).toBe(400);
    expect(res.json().erro.codigo).toBe('json_invalido');
  });

  it('empresa, fonte ou fonte inativa desconhecida → 404 igual', async () => {
    for (const [e, fo] of [
      ['nao-existe', 'demo'],
      [f.tenantSlug, 'nao-existe'],
      [f.tenantSlug, 'inativa'],
    ] as const) {
      const res = await app.inject(requisicaoAssinada(e, fo, f.segredo));
      expect(res.statusCode).toBe(404);
      expect(res.json().erro).toMatchObject({
        codigo: 'nao_encontrado',
        mensagem: 'Empresa ou fonte não encontrada.',
      });
    }
  });

  it('corpo acima de 1 MB → 413 corpo_grande', async () => {
    const res = await app.inject(envio({ corpo: { x: 'a'.repeat(1024 * 1024) } }));
    expect(res.statusCode).toBe(413);
    expect(res.json().erro.codigo).toBe('corpo_grande');
  });

  it('limite por fonte → 429 limite_excedido', async () => {
    const { app: app2 } = await appWebhooks([f], { limitePorMinuto: 2 });
    for (let i = 0; i < 2; i++) await app2.inject(envio());
    const res = await app2.inject(envio());
    expect(res.statusCode).toBe(429);
    expect(res.json().erro.codigo).toBe('limite_excedido');
    await app2.close();
  });

  it('fonte sem segredo configurado no servidor → 401', async () => {
    const { app: app3 } = await appWebhooks([]);
    const res = await app3.inject(envio());
    expect(res.statusCode).toBe(401);
    expect(res.json().erro.codigo).toBe('assinatura_invalida');
    await app3.close();
  });

  describe('modo Basic (GTech)', () => {
    const basic = (o: Parameters<typeof requisicaoBasic>[2] = {}) =>
      requisicaoBasic(f.tenantSlug, f.slug, { senha: f.segredo, ...o });

    it('USER_CREATED com Basic correto → 202, chave sha256 do corpo bruto, sem Authorization', async () => {
      // Corpo com acento e charset=utf-8: a chave é o SHA-256 dos bytes recebidos.
      const corpo = JSON.stringify({ ...USER_CREATED_FICTICIO, name: 'Jogador Tésté' });
      const res = await app.inject(basic({ corpo }));
      expect(res.statusCode).toBe(202);
      const { id } = res.json();
      const [linha] = await comTenant(db, f.tenantId, (tx) =>
        tx.select().from(webhookEvents).where(eq(webhookEvents.id, id)),
      );
      const sha = 'sha256:' + createHash('sha256').update(corpo, 'utf8').digest('hex');
      expect(linha).toMatchObject({ eventKey: sha, status: 'recebido' });
      expect(linha!.payload).toMatchObject({ event: 'USER_CREATED', name: 'Jogador Tésté' });
      expect(linha!.headers).toMatchObject({ 'content-type': 'application/json; charset=utf-8' });
      expect(linha!.headers).not.toHaveProperty('authorization');
      expect(fila.processar).toContainEqual({ tenantId: f.tenantId, webhookEventId: id });

      // Reenvio idêntico → 200 duplicado, sem reenfileirar.
      const antes = fila.processar.length;
      const dup = await app.inject(basic({ corpo }));
      expect(dup.statusCode).toBe(200);
      expect(dup.json()).toEqual({ id, duplicado: true });
      expect(fila.processar.length).toBe(antes);
    });

    it('usuário é livre; X-Event-Id, se vier, é a chave', async () => {
      const req = basic({
        usuario: 'qualquer-coisa',
        corpo: { event: 'USER_CREATED', user_id: 1 },
      });
      const res = await app.inject({
        ...req,
        headers: { ...req.headers, 'x-event-id': 'gtech-evt-1' },
      });
      expect(res.statusCode).toBe(202);
      const [linha] = await comTenant(db, f.tenantId, (tx) =>
        tx.select().from(webhookEvents).where(eq(webhookEvents.id, res.json().id)),
      );
      expect(linha!.eventKey).toBe('gtech-evt-1');
    });

    it('senha errada → 401 assinatura_invalida', async () => {
      for (const senha of ['outra-senha', f.segredo + 'x', f.segredo.slice(1)]) {
        const res = await app.inject(basic({ senha }));
        expect(res.statusCode).toBe(401);
        expect(res.json().erro).toMatchObject({
          codigo: 'assinatura_invalida',
          mensagem: 'Assinatura do webhook não confere.',
        });
      }
    });

    it('Basic malformado → 401 assinatura_invalida', async () => {
      for (const authorization of [
        'Basic',
        'Basic !!!nao-base64',
        `Basic ${Buffer.from('sem-dois-pontos').toString('base64')}`,
        `Basic ${Buffer.from('usuario:').toString('base64')}`,
      ]) {
        const res = await app.inject(basic({ authorization }));
        expect(res.statusCode).toBe(401);
        expect(res.json().erro.codigo).toBe('assinatura_invalida');
      }
    });

    it('Authorization de outro esquema e sem HMAC → 400 cabecalho_ausente', async () => {
      const res = await app.inject(basic({ authorization: 'Bearer abc' }));
      expect(res.statusCode).toBe(400);
      expect(res.json().erro.codigo).toBe('cabecalho_ausente');
    });

    it('sem janela de tempo: o relógio do servidor não importa', async () => {
      const { app: app4 } = await appWebhooks([f], { agora: () => 0 });
      const res = await app4.inject(basic({ corpo: { event: 'USER_CREATED', user_id: 2 } }));
      expect(res.statusCode).toBe(202);
      await app4.close();
    });

    it('fonte desconhecida → 404; fonte sem segredo no servidor → 401', async () => {
      const res = await app.inject(requisicaoBasic(f.tenantSlug, 'nao-existe', { senha: 'x' }));
      expect(res.statusCode).toBe(404);
      const { app: app5 } = await appWebhooks([]);
      const r2 = await app5.inject(basic());
      expect(r2.statusCode).toBe(401);
      expect(r2.json().erro.codigo).toBe('assinatura_invalida');
      await app5.close();
    });

    it('com X-Timestamp/X-Signature presentes vale o HMAC, mesmo com Basic correto', async () => {
      const authorization = basic().headers.authorization!;
      const errada = envio({ segredo: 'outro-segredo' });
      const r1 = await app.inject({ ...errada, headers: { ...errada.headers, authorization } });
      expect(r1.statusCode).toBe(401);
      const certa = envio();
      const r2 = await app.inject({ ...certa, headers: { ...certa.headers, authorization } });
      expect(r2.statusCode).toBe(202);
    });

    it('HMAC com charset=utf-8 continua aceito', async () => {
      const req = envio({ corpo: { event: 'signup', nome: 'Ação' } });
      const res = await app.inject({
        ...req,
        headers: { ...req.headers, 'content-type': 'application/json; charset=utf-8' },
      });
      expect(res.statusCode).toBe(202);
    });
  });

  it('GET entregas (analista) lista sob RLS; POST reprocessar exige admin', async () => {
    const tok = emitirToken(app, { sub: c.usuario.id, email: c.usuario.email, tenant: c.t1.id });
    const h = { authorization: `Bearer ${tok}` };
    const lista = await app.inject({
      method: 'GET',
      url: `/webhooks/${f.tenantSlug}/demo/entregas?limite=10`,
      headers: h,
    });
    expect(lista.statusCode).toBe(200);
    expect(lista.json().entregas.length).toBeGreaterThanOrEqual(2);
    expect(lista.json().entregas[0]).toHaveProperty('eventKey');

    const negado = await app.inject({
      method: 'POST',
      url: `/webhooks/${f.tenantSlug}/demo/reprocessar`,
      headers: h,
      payload: {},
    });
    expect(negado.statusCode).toBe(403);
  });

  it('POST reprocessar como admin enfileira job', async () => {
    const f2 = await criarFonte(db, c.t2, 'demo');
    const tok = emitirToken(app, { sub: c.usuario.id, email: c.usuario.email, tenant: c.t2.id });
    const res = await app.inject({
      method: 'POST',
      url: `/webhooks/${c.t2.slug}/demo/reprocessar`,
      headers: { authorization: `Bearer ${tok}` },
      payload: { de: '2026-01-01T00:00:00Z' },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().status).toBe('enfileirado');
    expect(fila.reprocessar.at(-1)).toMatchObject({
      tenantId: c.t2.id,
      sourceId: f2.sourceId,
      de: '2026-01-01T00:00:00Z',
    });
    // URL de outra empresa que não a ativa → 404
    const outra = await app.inject({
      method: 'POST',
      url: `/webhooks/${c.t1.slug}/demo/reprocessar`,
      headers: { authorization: `Bearer ${tok}` },
      payload: {},
    });
    expect(outra.statusCode).toBe(404);
  });
});
