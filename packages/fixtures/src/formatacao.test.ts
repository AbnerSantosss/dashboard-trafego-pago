import { describe, expect, it } from 'vitest';
import {
  NULO,
  formatarInteiro,
  formatarMoeda,
  formatarNulo,
  formatarNumero,
  formatarNumeroManual,
  formatarPercentual,
  formatarRoas,
} from './formatacao';

describe('formatarMoeda', () => {
  it('sem centavos por padrão, milhar com ponto', () => {
    expect(formatarMoeda(33840)).toBe('R$ 33.840');
    expect(formatarMoeda(226190)).toBe('R$ 226.190');
    expect(formatarMoeda(950)).toBe('R$ 950');
  });
  it('com centavos, decimal com vírgula', () => {
    expect(formatarMoeda(33.97, { centavos: true })).toBe('R$ 33,97');
    expect(formatarMoeda(102.82, { centavos: true })).toBe('R$ 102,82');
  });
  it('usa espaço comum (não NBSP) após R$', () => {
    expect(formatarMoeda(1)).toBe('R$ 1');
  });
});

describe('formatarInteiro', () => {
  it('agrupa milhar', () => {
    expect(formatarInteiro(320840)).toBe('320.840');
    expect(formatarInteiro(1900)).toBe('1.900');
    expect(formatarInteiro(995)).toBe('995');
  });
});

describe('formatarPercentual', () => {
  it('uma casa por padrão, sem sinal', () => {
    expect(formatarPercentual(12.5)).toBe('12,5%');
    expect(formatarPercentual(75)).toBe('75,0%');
  });
  it('com sinal', () => {
    expect(formatarPercentual(22.1, { sinal: true })).toBe('+22,1%');
    expect(formatarPercentual(-5.4, { sinal: true })).toBe('-5,4%');
    expect(formatarPercentual(0, { sinal: true })).toBe('0,0%');
  });
  it('negativo usa hífen, como na imagem', () => {
    expect(formatarPercentual(-5.4)).toBe('-5,4%');
  });
  it('casas configuráveis', () => {
    expect(formatarPercentual(100, { casas: 0 })).toBe('100%');
  });
});

describe('formatarRoas e formatarNulo', () => {
  it('ROAS com duas casas e x', () => {
    expect(formatarRoas(6.68)).toBe('6,68x');
    expect(formatarRoas(4.2)).toBe('4,20x');
  });
  it('nulo é travessão', () => {
    expect(formatarNulo()).toBe('–');
    expect(NULO).toBe('–');
  });
});

describe('fallback manual é idêntico ao Intl', () => {
  const casos: [number, number][] = [
    [0, 0],
    [950, 0],
    [1900, 0],
    [320840, 0],
    [1234567, 0],
    [33.97, 2],
    [102.82, 2],
    [-5.4, 1],
    [12.5, 1],
    [6.684, 2],
    [-0.01, 0],
  ];
  it.each(casos)('%d com %d casas', (n, casas) => {
    const manual = formatarNumeroManual(n, casas);
    expect(manual).toBe(formatarNumero(n, casas).replace(/^-(0(,0+)?)$/, '$1'));
  });
});
