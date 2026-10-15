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
