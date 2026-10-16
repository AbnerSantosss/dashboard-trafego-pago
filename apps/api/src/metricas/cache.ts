/**
 * Cache em memória da Visão Geral, por (empresa + query normalizada).
 * TTL de 15 s e no máximo 500 entradas (descarta a mais antiga). É por processo: com várias
 * instâncias da API cada uma tem o seu, e uma escrita só some do cache das outras pelo TTL.
 */
export const TTL_CACHE_MS = 15_000;
export const MAX_ENTRADAS_CACHE = 500;

interface Entrada {
  expiraEm: number;
  valor: unknown;
}

const entradas = new Map<string, Entrada>();
const estatisticas = { acertos: 0, faltas: 0 };

export function chaveCache(tenantId: string, query: Record<string, unknown>): string {
  const ordenada = Object.keys(query)
    .sort()
    .map((k) => [k, query[k] ?? null]);
  return `${tenantId}|${JSON.stringify(ordenada)}`;
}

export function lerCache<T>(chave: string, agora = Date.now()): T | undefined {
  const e = entradas.get(chave);
  if (!e) {
    estatisticas.faltas++;
    return undefined;
  }
  if (e.expiraEm <= agora) {
    entradas.delete(chave);
    estatisticas.faltas++;
    return undefined;
  }
  estatisticas.acertos++;
  return e.valor as T;
}

export function gravarCache(chave: string, valor: unknown, agora = Date.now()): void {
  entradas.delete(chave);
  while (entradas.size >= MAX_ENTRADAS_CACHE) {
    const primeira = entradas.keys().next().value;
    if (primeira === undefined) break;
    entradas.delete(primeira);
  }
  entradas.set(chave, { expiraEm: agora + TTL_CACHE_MS, valor });
}

/** Invalida o cache de uma empresa (ou de todas, sem argumento). */
export function limparCacheMetricas(tenantId?: string): void {
  if (tenantId === undefined) {
    entradas.clear();
    return;
  }
  for (const chave of [...entradas.keys()]) {
    if (chave.startsWith(`${tenantId}|`)) entradas.delete(chave);
  }
}

/** Contadores de acerto/falta (diagnóstico e testes). */
export function estatisticasCacheMetricas() {
  return { ...estatisticas, entradas: entradas.size };
}
