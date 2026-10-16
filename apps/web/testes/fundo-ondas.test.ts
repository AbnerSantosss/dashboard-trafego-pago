/** Geometria do fundo de ondas: determinística (SSR e navegador iguais), leve e dentro da tela. */
import { describe, expect, it } from 'vitest';
import { ALTURA, gerarOndas, hash, LARGURA } from '@/componentes/fundo-ondas';

const numeros = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe('gerarOndas', () => {
  it('é determinística: duas chamadas dão o mesmo desenho', () => {
    expect(gerarOndas()).toEqual(gerarOndas());
    expect(hash(1, 2, 3)).toBe(hash(1, 2, 3));
    expect(hash(1, 2, 3)).not.toBe(hash(3, 2, 1));
  });

  it('tem as duas fitas, a crista e opacidades válidas', () => {
    const o = gerarOndas();
    expect(o.principal).toHaveLength(40);
    expect(o.fundo).toHaveLength(22);
    expect(o.crista).toMatch(/^M[\d.-]+ [\d.-]+C/);
    for (const f of [...o.principal, ...o.fundo]) {
      expect(f.d).toMatch(/^M[\d.-]+ [\d.-]+C.+C.+$/);
      expect(f.o).toBeGreaterThan(0);
      expect(f.o).toBeLessThanOrEqual(1);
    }
  });

  it('pontos ficam em três caminhos (não centenas de nós) e todos dentro da área', () => {
    const { pontos } = gerarOndas();
    expect(pontos).toHaveLength(3);
    let total = 0;
    for (const p of pontos) {
      const marcas = p.d.match(/M[\d.]+ [\d.]+h\.01/g) ?? [];
      expect(marcas.length).toBeGreaterThan(0);
      expect(marcas.join('')).toBe(p.d);
      total += marcas.length;
      for (const m of marcas) {
        const [x, y] = numeros(m);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(LARGURA);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(ALTURA);
      }
    }
    // Teto de peso: a grade é 12 × 48 e a rarefação corta parte dela.
    expect(total).toBeGreaterThan(100);
    expect(total).toBeLessThan(12 * 48);
  });
});
