/** @trafego/rules — motor de regras, classificador de canal e agregação diária (puro, sem banco). */
export * from './tipos.js';
export { aplicarRegras, validarConjunto, type PadroesConjunto } from './motor.js';
export { CANAIS_PADRAO, CANAL_FALLBACK, classificarCanal } from './canal.js';
export {
  agregarEventos,
  derivar,
  taxasDoFunil,
  type Derivados,
  type LinhaDiaria,
  type OpcoesAgregacao,
} from './agregar.js';
export { diaNoFuso, lerData, localParaUtc } from './tempo.js';
