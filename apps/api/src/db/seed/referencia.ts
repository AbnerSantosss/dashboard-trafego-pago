/**
 * Dados da imagem de referência. Importa o JSON de `@trafego/fixtures` diretamente porque o
 * `index.ts` do pacote usa imports sem extensão, que o `moduleResolution: NodeNext` da API
 * não aceita; o tipo vem de `tipos.ts`, que não tem imports.
 */
import type { Referencia } from '@trafego/fixtures/src/tipos.js';
import json from '@trafego/fixtures/referencia.json' with { type: 'json' };

export const referencia: Referencia = json as Referencia;
