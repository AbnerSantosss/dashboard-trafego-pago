/** Motor de regras: payload bruto + conjunto da fonte → eventos canônicos. */
import { JSONPath } from 'jsonpath-plus';
import { CANAIS_PADRAO, classificarCanal } from './canal.js';
import { fusoValido, lerData } from './tempo.js';
import {
  ErroDeRegra,
  EVENT_TYPES,
  FORMATOS_DATA,
  isEventType,
  type CondicaoMatch,
  type ConjuntoDeRegras,
  type EventoCanonico,
  type MapeamentoCampo,
  type Match,
  type Regra,
  type RegraDeCanal,
  type ResultadoRegras,
} from './tipos.js';

const CAMPOS_TEXTO = [
  'campaign',
  'page',
  'lead_key',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'referrer',
] as const;
const CAMPOS_ESPECIAIS = ['occurred_at', 'value', 'currency', 'channel', 'base'];

function consultar(payload: unknown, path: string): unknown {
  let r: unknown[];
  try {
    r = JSONPath({ path, json: payload as object, wrap: true }) as unknown[];
  } catch (e) {
    throw new ErroDeRegra(`JSONPath inválido "${path}": ${(e as Error).message}`);
  }
  return r.length === 0 ? undefined : r.length === 1 ? r[0] : r;
}

const vazio = (v: unknown) => v === undefined || v === null || v === '';

/** `path` e, se vier vazio, cada caminho de `coalesce` em ordem: o primeiro não vazio vence. */
function consultarComAlternativas(
  payload: unknown,
  path: string,
  coalesce: string[] | undefined,
): unknown {
  let v = consultar(payload, path);
  for (const p of coalesce ?? []) {
    if (!vazio(v)) break;
    v = consultar(payload, p);
  }
  return v;
}

function casaCondicao(payload: unknown, c: CondicaoMatch): boolean {
  const v = consultarComAlternativas(payload, c.path, c.coalesce);
  if (c.exists !== undefined && c.exists === vazio(v)) return false;
  if (c.equals !== undefined && v !== c.equals) return false;
  if (c.in && !c.in.includes(v)) return false;
  if (c.not_in && c.not_in.includes(v)) return false;
  if (c.regex !== undefined && (vazio(v) || !new RegExp(c.regex).test(String(v)))) return false;
  return true;
}

function casaMatch(payload: unknown, match: Match): boolean {
  const conds = Array.isArray(match) ? match : [match];
  return conds.every((c) => casaCondicao(payload, c));
}

function paraNumero(v: unknown, nomeCampo: string): number {
  if (typeof v === 'number') return v;
  let s = String(v).trim();
  // "1.234,56" → 1234.56; "12,5" → 12.5
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  const n = Number(s);
  if (s === '' || !Number.isFinite(n)) {
    throw new ErroDeRegra(`Campo "${nomeCampo}": "${String(v)}" não é um número.`);
  }
  return n;
}

/**
 * Extrai e transforma um campo. Ordem: path/const → coalesce → default → regex → trim → lower →
 * map → multiply → divide. `format` (datas) é aplicado por quem chama.
 */
function extrair(payload: unknown, m: MapeamentoCampo, nome: string): unknown {
  let v: unknown =
    m.path !== undefined ? consultarComAlternativas(payload, m.path, m.coalesce) : m.const;
  if (vazio(v) && m.default !== undefined) v = m.default;
  if (vazio(v)) return undefined;
  if (typeof v === 'object') {
    throw new ErroDeRegra(
      `Campo "${nome}": o caminho "${m.path ?? ''}" devolveu lista/objeto, não um valor.`,
    );
  }
  if (m.regex !== undefined) {
    const r = new RegExp(m.regex).exec(String(v));
    if (!r) return m.default;
    v = r[1] ?? r[0];
  }
  if (m.trim) v = String(v).trim();
  if (m.lower) v = String(v).toLowerCase();
  if (m.map && Object.hasOwn(m.map, String(v))) v = m.map[String(v)];
  if (m.multiply !== undefined) v = paraNumero(v, nome) * m.multiply;
  if (m.divide !== undefined) {
    if (m.divide === 0) throw new ErroDeRegra(`Campo "${nome}": divide não pode ser 0.`);
    v = paraNumero(v, nome) / m.divide;
  }
  return v;
}

function paraBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  return ['true', '1', 'sim', 'yes', 's'].includes(String(v).trim().toLowerCase());
}

function montarEvento(
  payload: unknown,
  regra: Regra,
  conjunto: ConjuntoDeRegras,
  canais: RegraDeCanal[],
  indice: number,
  avisos: string[],
): EventoCanonico {
  const f = regra.fields;
  const rotulo = `Bloco ${indice + 1} (${regra.type})`;
  const dataMap = f.occurred_at;
  if (!dataMap) throw new ErroDeRegra(`${rotulo}: falta o campo "occurred_at" na regra.`);
  const dataBruta = extrair(payload, dataMap, 'occurred_at');
  if (vazio(dataBruta)) {
    throw new ErroDeRegra(
      `${rotulo}: data do evento ausente no payload (caminho ${dataMap.path ?? '(const)'}).`,
    );
  }
  let occurred_at: Date;
  try {
    occurred_at = lerData(dataBruta, dataMap.format ?? 'iso', conjunto.fuso);
  } catch (e) {
    throw new ErroDeRegra(`${rotulo}: ${(e as Error).message}`);
  }

  const evento: EventoCanonico = {
    type: regra.type,
    occurred_at,
    currency: conjunto.moeda_padrao,
    channel: '',
  };

  if (f.value) {
    const v = extrair(payload, f.value, 'value');
    if (!vazio(v)) evento.value = Math.round(paraNumero(v, 'value') * 100) / 100;
  }
  if (evento.value === undefined && ['gasto', 'ftd', 'deposito'].includes(regra.type)) {
    avisos.push(`${rotulo}: evento sem valor (value); conta como 0.`);
  }
  if (f.currency) {
    const c = extrair(payload, f.currency, 'currency');
    if (!vazio(c)) evento.currency = String(c).trim().toUpperCase();
  }
  for (const nome of CAMPOS_TEXTO) {
    const m = f[nome];
    if (!m) continue;
    const v = extrair(payload, m, nome);
    if (!vazio(v)) evento[nome] = String(v);
  }
  if (f.base) {
    const b = extrair(payload, f.base, 'base');
    if (!vazio(b)) evento.base = paraBool(b);
  }
  for (const [nome, m] of Object.entries(f)) {
    if ((CAMPOS_TEXTO as readonly string[]).includes(nome) || CAMPOS_ESPECIAIS.includes(nome)) {
      continue;
    }
    const v = extrair(payload, m, nome);
    if (!vazio(v)) (evento.extras ??= {})[nome] = String(v);
  }
  if ((regra.type === 'cadastro' || regra.type === 'ftd') && !evento.lead_key) {
    avisos.push(`${rotulo}: lead_key ausente; não será possível deduplicar este lead.`);
  }

  // `fields.channel` fixa o canal; sem ele, o classificador decide.
  const canalFixo = f.channel ? extrair(payload, f.channel, 'channel') : undefined;
  evento.channel = vazio(canalFixo) ? classificarCanal(evento, canais) : String(canalFixo);
  return evento;
}

/**
 * Aplica o conjunto ao payload. Cada bloco que casa gera um evento (vários por payload é
 * intencional). Payload que casa com `ignorar` devolve zero eventos sem erro. Lança
 * `ErroDeRegra` com motivo legível se nada casar ou se um campo não converter.
 */
export function aplicarRegras(payload: unknown, conjunto: ConjuntoDeRegras): ResultadoRegras {
  if (payload === null || typeof payload !== 'object') {
    throw new ErroDeRegra('O payload precisa ser um objeto JSON.');
  }
  const ignorado = (conjunto.ignorar ?? []).findIndex((m) => casaMatch(payload, m));
  if (ignorado >= 0) {
    return {
      eventos: [],
      avisos: [`Payload ignorado por "ignorar[${ignorado}]"; nenhum evento gerado.`],
    };
  }
  const avisos: string[] = [];
  const canais = conjunto.canais ?? CANAIS_PADRAO;
  const eventos: EventoCanonico[] = [];
  conjunto.regras.forEach((regra, i) => {
    if (casaMatch(payload, regra.match)) {
      eventos.push(montarEvento(payload, regra, conjunto, canais, i, avisos));
    }
  });
  if (eventos.length === 0) {
    throw new ErroDeRegra(
      `Nenhum bloco de regra (versão ${conjunto.version}) casou com o payload; confira os "match".`,
    );
  }
  return { eventos, avisos };
}

// ---------------------------------------------------------------------------
// Validação (editor de regras e teste ao vivo)
// ---------------------------------------------------------------------------

const OPERADORES_CAMPO = [
  'path',
  'coalesce',
  'const',
  'format',
  'divide',
  'multiply',
  'lower',
  'trim',
  'default',
  'regex',
  'map',
];
const OPERADORES_MATCH = ['path', 'coalesce', 'equals', 'in', 'not_in', 'exists', 'regex'];
const CONDICOES_CANAL = ['utm_medium_in', 'utm_source_in', 'referrer_contem', 'campo_presente'];

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function regexOk(r: unknown, onde: string, erros: string[]): void {
  if (typeof r !== 'string') {
    erros.push(`${onde}: "regex" deve ser texto.`);
    return;
  }
  try {
    new RegExp(r);
  } catch {
    erros.push(`${onde}: regex inválida "${r}".`);
  }
}

function pathOk(p: unknown, onde: string, erros: string[]): void {
  if (typeof p !== 'string' || !p.startsWith('$')) {
    erros.push(`${onde}: "path" deve ser um JSONPath começando com "$".`);
  }
}

function coalesceOk(c: Record<string, unknown>, onde: string, erros: string[]): void {
  if (c.coalesce === undefined) return;
  if (c.path === undefined) erros.push(`${onde}: "coalesce" exige "path".`);
  if (
    !Array.isArray(c.coalesce) ||
    c.coalesce.length === 0 ||
    c.coalesce.some((p) => typeof p !== 'string' || !p.startsWith('$'))
  ) {
    erros.push(`${onde}: "coalesce" deve ser uma lista de JSONPaths começando com "$".`);
  }
}

function validarMatch(m: unknown, onde: string, erros: string[]): void {
  const lista = Array.isArray(m) ? m : [m];
  if (lista.length === 0) erros.push(`${onde}: "match" vazio.`);
  lista.forEach((c: unknown, j) => {
    const o = Array.isArray(m) ? `${onde}.match[${j}]` : `${onde}.match`;
    if (!ehObjeto(c)) {
      erros.push(`${o}: deve ser um objeto.`);
      return;
    }
    pathOk(c.path, o, erros);
    for (const k of Object.keys(c)) {
      if (!OPERADORES_MATCH.includes(k)) erros.push(`${o}: operador desconhecido "${k}".`);
    }
    coalesceOk(c, o, erros);
    for (const k of ['in', 'not_in'] as const) {
      if (c[k] !== undefined && !Array.isArray(c[k]))
        erros.push(`${o}: "${k}" deve ser uma lista.`);
    }
    if (c.exists !== undefined && typeof c.exists !== 'boolean') {
      erros.push(`${o}: "exists" deve ser true ou false.`);
    }
    if (c.regex !== undefined) regexOk(c.regex, o, erros);
    if (
      c.equals === undefined &&
      c.in === undefined &&
      c.not_in === undefined &&
      c.exists === undefined &&
      c.regex === undefined
    ) {
      erros.push(`${o}: use "equals", "in", "not_in", "exists" ou "regex".`);
    }
  });
}

function validarCampo(nome: string, m: unknown, onde: string, erros: string[]): void {
  const o = `${onde}.fields.${nome}`;
  if (!ehObjeto(m)) {
    erros.push(`${o}: deve ser um objeto.`);
    return;
  }
  for (const k of Object.keys(m)) {
    if (!OPERADORES_CAMPO.includes(k)) erros.push(`${o}: operador desconhecido "${k}".`);
  }
  if (m.path === undefined && m.const === undefined && m.default === undefined) {
    erros.push(`${o}: informe "path", "const" ou "default".`);
  }
  if (m.path !== undefined && m.const !== undefined) {
    erros.push(`${o}: use "path" ou "const", não os dois.`);
  }
  if (m.path !== undefined) pathOk(m.path, o, erros);
  coalesceOk(m, o, erros);
  if (m.map !== undefined && !ehObjeto(m.map)) {
    erros.push(`${o}: "map" deve ser um objeto { "de": "para" }.`);
  }
  if (m.format !== undefined && !(FORMATOS_DATA as readonly unknown[]).includes(m.format)) {
    erros.push(`${o}: formato "${String(m.format)}" inválido (use ${FORMATOS_DATA.join(', ')}).`);
  }
  for (const k of ['divide', 'multiply'] as const) {
    if (m[k] !== undefined && (typeof m[k] !== 'number' || m[k] === 0)) {
      erros.push(`${o}: "${k}" deve ser um número diferente de 0.`);
    }
  }
  for (const k of ['lower', 'trim'] as const) {
    if (m[k] !== undefined && typeof m[k] !== 'boolean') {
      erros.push(`${o}: "${k}" deve ser true ou false.`);
    }
  }
  if (m.regex !== undefined) regexOk(m.regex, o, erros);
}

function validarCanais(c: unknown, erros: string[]): void {
  if (!Array.isArray(c)) {
    erros.push('"canais" deve ser uma lista.');
    return;
  }
  c.forEach((r: unknown, i) => {
    const o = `canais[${i}]`;
    if (!ehObjeto(r)) {
      erros.push(`${o}: deve ser um objeto.`);
      return;
    }
    if (typeof r.canal !== 'string' || r.canal.trim() === '') {
      erros.push(`${o}: "canal" precisa de um nome.`);
    } else if (r.canal.startsWith('__')) {
      erros.push(`${o}: nomes começando com "__" são reservados.`);
    }
    const se = r.se;
    if (!ehObjeto(se)) {
      erros.push(`${o}: "se" deve ser um objeto com condições.`);
      return;
    }
    const chaves = Object.keys(se);
    if (chaves.length === 0) erros.push(`${o}: "se" sem condições.`);
    for (const k of chaves) {
      const v = se[k];
      if (!CONDICOES_CANAL.includes(k)) erros.push(`${o}: condição desconhecida "${k}".`);
      else if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
        erros.push(`${o}: "${k}" deve ser uma lista de textos.`);
      }
    }
  });
}

export interface PadroesConjunto {
  moeda_padrao?: string;
  fuso?: string;
}

/**
 * Valida o JSON de um conjunto de regras. `moeda_padrao` e `fuso` ausentes caem nos padrões
 * informados (da empresa) ou em BRL e America/Sao_Paulo.
 */
export function validarConjunto(
  json: unknown,
  padroes: PadroesConjunto = {},
): { ok: true; conjunto: ConjuntoDeRegras } | { ok: false; erros: string[] } {
  const erros: string[] = [];
  if (!ehObjeto(json)) {
    return { ok: false, erros: ['O conjunto de regras deve ser um objeto JSON.'] };
  }
  if (!Number.isInteger(json.version) || (json.version as number) < 1) {
    erros.push('"version" deve ser um inteiro maior ou igual a 1.');
  }
  if (!Array.isArray(json.regras) || json.regras.length === 0) {
    erros.push('"regras" deve ser uma lista com pelo menos um bloco.');
  } else {
    json.regras.forEach((r: unknown, i) => {
      const o = `regras[${i}]`;
      if (!ehObjeto(r)) {
        erros.push(`${o}: deve ser um objeto.`);
        return;
      }
      if (typeof r.type !== 'string' || !isEventType(r.type)) {
        erros.push(`${o}: "type" deve ser um de ${EVENT_TYPES.join(', ')}.`);
      }
      validarMatch(r.match, o, erros);
      const fields = r.fields;
      if (!ehObjeto(fields)) {
        erros.push(`${o}: "fields" deve ser um objeto.`);
        return;
      }
      if (!fields.occurred_at) erros.push(`${o}: falta "fields.occurred_at".`);
      for (const [nome, m] of Object.entries(fields)) validarCampo(nome, m, o, erros);
    });
  }
  if (json.canais !== undefined) validarCanais(json.canais, erros);
  if (json.ignorar !== undefined) {
    if (!Array.isArray(json.ignorar)) erros.push('"ignorar" deve ser uma lista de "match".');
    else json.ignorar.forEach((m: unknown, i) => validarMatch(m, `ignorar[${i}]`, erros));
  }
  const moeda = json.moeda_padrao ?? padroes.moeda_padrao ?? 'BRL';
  if (typeof moeda !== 'string' || !/^[A-Za-z]{3}$/.test(moeda)) {
    erros.push('"moeda_padrao" deve ser um código de 3 letras (ex.: BRL).');
  }
  const fuso = json.fuso ?? padroes.fuso ?? 'America/Sao_Paulo';
  if (typeof fuso !== 'string' || !fusoValido(fuso)) {
    erros.push(`"fuso" inválido: "${String(fuso)}" (use um fuso IANA, ex.: America/Sao_Paulo).`);
  }
  if (erros.length > 0) return { ok: false, erros };
  const conjunto: ConjuntoDeRegras = {
    version: json.version as number,
    regras: json.regras as Regra[],
    moeda_padrao: (moeda as string).toUpperCase(),
    fuso: fuso as string,
  };
  if (json.canais !== undefined) conjunto.canais = json.canais as RegraDeCanal[];
  if (json.ignorar !== undefined) conjunto.ignorar = json.ignorar as Match[];
  return { ok: true, conjunto };
}
