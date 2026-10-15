import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { assinar, CANAIS, enviar, EVENTOS, gerarPayloads, montarEnvio } from './index.js';

describe('webhook-sim', () => {
  it('assina como a API: HMAC-SHA256 hex de timestamp.corpo', () => {
    const esperado = createHmac('sha256', 'k').update('10.{}').digest('hex');
    expect(assinar('k', 10, '{}')).toBe(esperado);
  });

  it('lote de 30 cobre os 5 canais × 6 tipos, com a forma da wiki', () => {
    const lista = gerarPayloads({ quantidade: 30, semente: 1 });
    const eventos = new Set(lista.map((p) => p.event));
    expect(eventos).toEqual(new Set(Object.values(EVENTOS)));
    expect(lista.some((p) => p.affiliate_id)).toBe(true);
    expect(lista.some((p) => p.utm.medium === 'email')).toBe(true);
    expect(lista.some((p) => p.utm.medium === 'sms')).toBe(true);
    expect(lista.some((p) => p.utm.source?.toLowerCase() === 'instagram')).toBe(true);
    expect(lista.some((p) => p.utm.source === 'google')).toBe(true);
    expect(CANAIS).toHaveLength(5);
    for (const p of lista) {
      expect(Date.parse(p.created_at)).not.toBeNaN();
      expect(p.user.id).toBeTruthy();
      if (p.amount !== undefined) expect(Number.isInteger(p.amount)).toBe(true);
    }
    expect(lista.find((p) => p.event === 'first_deposit')?.amount).toBeGreaterThan(0);
    const ate = new Date('2026-10-15T12:00:00Z');
    expect(gerarPayloads({ semente: 1, ate })).toEqual(gerarPayloads({ semente: 1, ate }));
  });

  it('montarEnvio e modos inválidos', () => {
    const base = {
      url: 'http://x/',
      empresa: 'pasio',
      fonte: 'demo',
      segredo: 's',
      payload: { a: 1 },
      agora: 1_000_000,
    };
    const ok = montarEnvio(base);
    expect(ok.url).toBe('http://x/webhooks/pasio/demo');
    expect(ok.headers['x-signature']).toBe(assinar('s', ok.headers['x-timestamp']!, ok.corpo));
    const ts = montarEnvio({ ...base, invalido: 'timestamp' });
    expect(Number(ts.headers['x-timestamp'])).toBe(1000 - 3600);
    const sig = montarEnvio({ ...base, invalido: 'assinatura' });
    expect(sig.headers['x-signature']).not.toBe(
      assinar('s', sig.headers['x-timestamp']!, sig.corpo),
    );
  });

  it('enviar usa POST com o corpo bruto assinado', async () => {
    const e = montarEnvio({
      url: 'http://x',
      empresa: 'a',
      fonte: 'b',
      segredo: 's',
      payload: { z: 1 },
    });
    let recebido: RequestInit | undefined;
    const falso = (async (_u: string, init: RequestInit) => {
      recebido = init;
      return new Response('{"status":"recebido"}', { status: 202 });
    }) as unknown as typeof fetch;
    const r = await enviar(e, falso);
    expect(r.status).toBe(202);
    expect(recebido?.body).toBe(e.corpo);
  });
});
