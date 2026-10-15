/**
 * Configuração opcional da ingestão, lida de `process.env` (não faz parte de `src/env.ts`).
 * Nenhuma é obrigatória; valores inválidos caem no default.
 */
export interface ConfigWebhooks {
  /** Janela do `X-Timestamp`, em segundos (`WEBHOOK_JANELA_SEGUNDOS`, padrão 300). */
  janelaSegundos: number;
  /** Requisições por minuto por fonte (`WEBHOOK_LIMITE_POR_MINUTO`, padrão 600). */
  limitePorMinuto: number;
  /** JSON `{ "<empresa>/<fonte>": "<segredo>" }` (`WEBHOOK_SEGREDOS`), nunca commitado. */
  segredosJson: string | undefined;
  /** URL da fila pg-boss: `DATABASE_ADMIN_URL` (app_user não cria schema). */
  urlFila: string | undefined;
}

function inteiro(valor: string | undefined, padrao: number): number {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : padrao;
}

export function lerConfigWebhooks(fonte: Record<string, string | undefined> = process.env) {
  return {
    janelaSegundos: inteiro(fonte['WEBHOOK_JANELA_SEGUNDOS'], 300),
    limitePorMinuto: inteiro(fonte['WEBHOOK_LIMITE_POR_MINUTO'], 600),
    segredosJson: fonte['WEBHOOK_SEGREDOS'],
    urlFila: fonte['DATABASE_ADMIN_URL']?.trim() || undefined,
  } satisfies ConfigWebhooks;
}
