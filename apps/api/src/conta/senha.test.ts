/** Hash de senha: Argon2id no formato PHC, conferência do scrypt legado e quando refazer o hash. */
import { randomBytes, scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { conferirSenha, gerarHashSenha, precisaRefazerHash } from './senha.js';

describe('senha', () => {
  it('gera Argon2id (PHC) com sal próprio e confere só a senha certa', async () => {
    const a = await gerarHashSenha('senha-forte-123');
    const b = await gerarHashSenha('senha-forte-123');
    expect(a).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/);
    expect(a).not.toBe(b);
    expect(await conferirSenha('senha-forte-123', a)).toBe(true);
    expect(await conferirSenha('senha-forte-124', a)).toBe(false);
    expect(precisaRefazerHash(a)).toBe(false);
  });

  it('aceita o scrypt legado e pede para refazer em Argon2id', async () => {
    const sal = randomBytes(16);
    const hash = scryptSync('antiga-123', sal, 32, { N: 16384, r: 8, p: 1 });
    const legado = `s1$${sal.toString('base64url')}$${hash.toString('base64url')}`;
    expect(await conferirSenha('antiga-123', legado)).toBe(true);
    expect(await conferirSenha('antiga-124', legado)).toBe(false);
    expect(precisaRefazerHash(legado)).toBe(true);
  });

  it('sem hash, hash estranho ou parâmetros absurdos: recusa sem erro', async () => {
    expect(await conferirSenha('x', null)).toBe(false);
    expect(await conferirSenha('x', 'texto-qualquer')).toBe(false);
    expect(await conferirSenha('x', '$argon2id$v=19$m=99999999,t=2,p=1$AAAA$AAAA')).toBe(false);
    expect(precisaRefazerHash(null)).toBe(false);
    expect(precisaRefazerHash('$argon2id$v=19$m=4096,t=1,p=1$AAAA$AAAA')).toBe(true);
  });
});
