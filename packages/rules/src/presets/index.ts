/** Presets de regras por plataforma: slug → função que devolve o conteúdo de `rules.mapping`. */
import { mapeamentoGtech } from './gtech.js';

export const PRESETS: Record<string, () => unknown> = {
  gtech: mapeamentoGtech,
};
