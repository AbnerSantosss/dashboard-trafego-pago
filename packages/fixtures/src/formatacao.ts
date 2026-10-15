/**
 * Formatação pt-BR pura e determinística.
 * Usa Intl.NumberFormat('pt-BR') quando disponível; senão, um fallback manual
 * com o mesmo resultado (milhar com ponto, decimal com vírgula).
 */

/** Travessão exibido para valores ausentes (canal sem gasto). */
export const NULO = '–';

function temIntlPtBr(): boolean {
  try {
    return new Intl.NumberFormat('pt-BR').format(1234.5) === '1.234,5';
  } catch {
    return false;
  }
}

const INTL_OK = temIntlPtBr();

function agruparMilhar(inteiro: string): string {
  return inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Fallback sem Intl; exportado para ser testado diretamente. */
export function formatarNumeroManual(n: number, casas: number): string {
  const absoluto = Math.abs(n).toFixed(casas);
  const negativo = n < 0 && Number(absoluto) !== 0;
  const [inteiro = '0', decimal] = absoluto.split('.');
  const corpo = agruparMilhar(inteiro) + (decimal ? `,${decimal}` : '');
  return (negativo ? '-' : '') + corpo;
}

/** Número com `casas` decimais fixas, no padrão pt-BR. */
export function formatarNumero(n: number, casas = 0): string {
  if (INTL_OK) {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    }).format(n);
  }
  return formatarNumeroManual(n, casas);
}

/** "R$ 33.840" (padrão) ou "R$ 33,97" com `centavos: true`. Espaço comum após o símbolo. */
export function formatarMoeda(n: number, opcoes: { centavos?: boolean } = {}): string {
  return `R$ ${formatarNumero(n, opcoes.centavos ? 2 : 0)}`;
}

/** "320.840" */
export function formatarInteiro(n: number): string {
  return formatarNumero(Math.round(n), 0);
}

/**
 * "12,5%" ou, com `sinal: true`, "+12,5%". Negativos usam hífen ("-5,4%"), como na imagem.
 * `casas` padrão 1; o "100%" da base do funil usa `casas: 0`.
 */
export function formatarPercentual(
  n: number,
  opcoes: { sinal?: boolean; casas?: number } = {},
): string {
  const corpo = formatarNumero(n, opcoes.casas ?? 1);
  const prefixo = opcoes.sinal && n > 0 ? '+' : '';
  return `${prefixo}${corpo}%`;
}

/** "6,68x" */
export function formatarRoas(n: number): string {
  return `${formatarNumero(n, 2)}x`;
}

/** "–" */
export function formatarNulo(): string {
  return NULO;
}
