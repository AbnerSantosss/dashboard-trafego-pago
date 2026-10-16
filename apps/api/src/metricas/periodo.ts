/** Datas AAAA-MM-DD tratadas como dias de calendário (aritmética em UTC, sem fuso). */

/** Duração padrão da Visão Geral: 24 dias (01/05–24/05/2024 na imagem de referência). */
export const DIAS_PADRAO = 24;
/** Maior período aceito pela rota, em dias (inclusivo). */
export const DIAS_MAXIMO = 400;

export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Quantidade de dias de `de` a `ate`, inclusive. */
export function duracaoDias(de: string, ate: string): number {
  return (
    Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000) + 1
  );
}

export function listarDias(de: string, ate: string): string[] {
  const n = duracaoDias(de, ate);
  return Array.from({ length: Math.max(n, 0) }, (_, i) => somarDias(de, i));
}

/** Hoje (AAAA-MM-DD) no fuso IANA informado. */
export function hojeNoFuso(fuso: string, agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

/** Período imediatamente anterior com a mesma duração. */
export function periodoAnterior(de: string, ate: string): { de: string; ate: string } {
  const n = duracaoDias(de, ate);
  return { de: somarDias(de, -n), ate: somarDias(de, -1) };
}
