import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashSegredo } from '../db/seed.js';
import { assinar, assinaturaConfere, chaveEvento, timestampNaJanela } from './assinatura.js';
import { lerConfigWebhooks } from './config.js';
import { lerMapaSegredos, obterSegredoDeMapa, segredoConfereComHash } from './segredos.js';

describe('assinatura', () => {
  it('HMAC-SHA256 hex de timestamp.corpo', () => {
    const esperado = createHmac('sha256', 's').update('123.{"a":1}').digest('hex');
    expect(assinar('s', 123, '{"a":1}')).toBe(esperado);
    expect(assinaturaConfere('s', '123', '{"a":1}', esperado)).toBe(true);
    expect(assinaturaConfere('s', '124', '{"a":1}', esperado)).toBe(false);
    expect(assinaturaConfere('s', '123', '{"a":1}', 'zz')).toBe(false);
  });

  it('janela de timestamp', () => {
    const agora = 1_700_000_000_000;
    expect(timestampNaJanela('1700000000', 300, agora)).toBe(true);
    expect(timestampNaJanela('1699999700', 300, agora)).toBe(true);
    expect(timestampNaJanela('1699999699', 300, agora)).toBe(false);
    expect(timestampNaJanela('1700000301', 300, agora)).toBe(false);
    expect(timestampNaJanela('abc', 300, agora)).toBe(false);
  });

  it('chave de evento', () => {
    expect(chaveEvento(' e1 ', 'x')).toBe('e1');
    expect(chaveEvento(undefined, 'x')).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('segredos', () => {
  const fonte = (hash: string) => ({
    tenantId: 't',
    tenantSlug: 'pasio',
    sourceId: 's',
    fonteSlug: 'demo',
    secretHash: hash,
  });

  it('confere com o hash scrypt do seed', async () => {
    const h = hashSegredo('abc');
    expect(await segredoConfereComHash('abc', h)).toBe(true);
    expect(await segredoConfereComHash('abd', h)).toBe(false);
    expect(await segredoConfereComHash('abc', 'lixo')).toBe(false);
  });

  it('mapa do env só vale se bater com o hash', async () => {
    const obter = obterSegredoDeMapa(lerMapaSegredos('{"pasio/demo":"abc"}'));
    expect(await obter(fonte(hashSegredo('abc')))).toBe('abc');
    expect(await obterSegredoDeMapa({ 'pasio/demo': 'x' })(fonte(hashSegredo('abc')))).toBeNull();
    expect(lerMapaSegredos('nao json')).toEqual({});
  });

  it('config com defaults', () => {
    expect(lerConfigWebhooks({})).toMatchObject({ janelaSegundos: 300, limitePorMinuto: 600 });
    expect(lerConfigWebhooks({ WEBHOOK_JANELA_SEGUNDOS: '60' }).janelaSegundos).toBe(60);
  });
});
