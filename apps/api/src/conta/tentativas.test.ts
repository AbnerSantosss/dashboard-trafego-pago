import { describe, expect, it } from 'vitest';
import { chaveConta, criarTentativas } from './tentativas.js';

describe('criarTentativas', () => {
  it('bloqueia na N-ésima falha, libera depois da janela e zera no acerto', () => {
    let t = 0;
    const tent = criarTentativas({ maxFalhas: 3, janelaMs: 1000, agora: () => t });
    tent.falhou('a');
    tent.falhou('a');
    expect(tent.bloqueio('a')).toBe(0);
    tent.falhou('a');
    expect(tent.bloqueio('a')).toBe(1000);
    expect(tent.bloqueio('b')).toBe(0);
    t = 1000;
    expect(tent.bloqueio('a')).toBe(0);

    tent.falhou('c');
    tent.falhou('c');
    tent.acertou('c');
    tent.falhou('c');
    expect(tent.bloqueio('c')).toBe(0);
  });

  it('falhas espalhadas além da janela não somam', () => {
    let t = 0;
    const tent = criarTentativas({ maxFalhas: 2, janelaMs: 100, agora: () => t });
    tent.falhou('a');
    t = 500;
    tent.falhou('a');
    expect(tent.bloqueio('a')).toBe(0);
  });

  it('descarta chaves vencidas quando passa do teto', () => {
    let t = 0;
    const tent = criarTentativas({ maxFalhas: 5, janelaMs: 10, maxChaves: 2, agora: () => t });
    tent.falhou('a');
    tent.falhou('b');
    t = 100;
    tent.falhou('c');
    expect(tent.bloqueio('a')).toBe(0);
  });

  it('chaveConta normaliza o e-mail', () => {
    expect(chaveConta('  Ana@Exemplo.COM ')).toBe('ana@exemplo.com');
  });
});
