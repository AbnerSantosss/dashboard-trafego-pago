import { describe, expect, it } from 'vitest';
import {
  base32,
  codigoTotp,
  conferirTotp,
  deBase32,
  gerarSegredoTotp,
  passoAtual,
  uriTotp,
} from './totp.js';

// Vetores do RFC 6238 (SHA1, segredo ASCII "12345678901234567890"), truncados em 6 dígitos.
const SEGREDO_RFC = base32(Buffer.from('12345678901234567890'));

describe('TOTP', () => {
  it('base32 ida e volta', () => {
    const b = Buffer.from('qualquer coisa com acento: ção');
    expect(deBase32(base32(b)).equals(b)).toBe(true);
    expect(base32(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
  });

  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('vetor do RFC 6238 em t=%i', (t, esperado) => {
    expect(codigoTotp(SEGREDO_RFC, Math.floor(t / 30))).toBe(esperado);
  });

  it('aceita o passo vizinho, recusa o resto e código repetido', () => {
    const segredo = gerarSegredoTotp();
    const agoraMs = 1_800_000_000_000;
    const p = passoAtual(agoraMs);
    expect(conferirTotp(segredo, codigoTotp(segredo, p), { agoraMs })).toBe(p);
    expect(conferirTotp(segredo, codigoTotp(segredo, p - 1), { agoraMs })).toBe(p - 1);
    expect(conferirTotp(segredo, codigoTotp(segredo, p + 3), { agoraMs })).toBeNull();
    expect(conferirTotp(segredo, codigoTotp(segredo, p), { agoraMs, ultimoPasso: p })).toBeNull();
    const comEspaco = codigoTotp(segredo, p).replace(/^(\d{3})/, '$1 ');
    expect(conferirTotp(segredo, comEspaco, { agoraMs })).toBe(p);
    expect(conferirTotp(segredo, 'abcdef', { agoraMs })).toBeNull();
  });

  it('URI otpauth com emissor e segredo', () => {
    const uri = uriTotp('ABCD', 'a@b.com');
    expect(uri.startsWith('otpauth://totp/Painel%20de%20Tr%C3%A1fego%3Aa%40b.com?')).toBe(true);
    expect(new URL(uri).searchParams.get('secret')).toBe('ABCD');
  });
});
