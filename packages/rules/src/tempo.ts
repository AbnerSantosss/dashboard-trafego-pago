/** Datas e fuso: conversões sem dependências (Intl). */
import { ErroDeRegra, type FormatoData } from './tipos.js';

const cacheFmt = new Map<string, Intl.DateTimeFormat>();
function fmt(fuso: string): Intl.DateTimeFormat {
  let f = cacheFmt.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: fuso,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    cacheFmt.set(fuso, f);
  }
  return f;
}

export function fusoValido(fuso: string): boolean {
  try {
    fmt(fuso);
    return true;
  } catch {
    return false;
  }
}

function partes(data: Date, fuso: string) {
  const p: Record<string, number> = {};
  for (const x of fmt(fuso).formatToParts(data)) {
    if (x.type !== 'literal') p[x.type] = Number(x.value);
  }
  return p as {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
}

/** Diferença (ms) entre a hora local no fuso e UTC naquele instante. */
function deslocamento(data: Date, fuso: string): number {
  const p = partes(data, fuso);
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return comoUtc - Math.floor(data.getTime() / 1000) * 1000;
}

/** Hora de parede no fuso → instante UTC. */
export function localParaUtc(
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
  segundo: number,
  fuso: string,
): Date {
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo);
  let t = palpite - deslocamento(new Date(palpite), fuso);
  const ajuste = palpite - deslocamento(new Date(t), fuso);
  if (ajuste !== t) t = ajuste;
  return new Date(t);
}

/** Dia (AAAA-MM-DD) do instante no fuso da empresa. */
export function diaNoFuso(data: Date, fuso: string): string {
  const p = partes(data, fuso);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

const ISO_SEM_FUSO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/;
const BR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

function invalida(bruto: unknown, formato: string): never {
  throw new ErroDeRegra(`Data "${String(bruto)}" não está no formato ${formato}.`);
}

/** Converte um valor bruto em Date. Datas sem fuso explícito são lidas no fuso da empresa. */
export function lerData(bruto: unknown, formato: FormatoData, fuso: string): Date {
  let d: Date;
  if (formato === 'epoch_s' || formato === 'epoch_ms') {
    const n = typeof bruto === 'number' ? bruto : Number(String(bruto).trim());
    if (!Number.isFinite(n) || String(bruto).trim() === '') invalida(bruto, formato);
    d = new Date(formato === 'epoch_s' ? n * 1000 : n);
  } else if (formato === 'dd/mm/yyyy') {
    const m = BR.exec(String(bruto).trim());
    if (!m) invalida(bruto, formato);
    const [, dd, mm, aaaa, hh, mi, ss] = m;
    if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31)
      invalida(bruto, formato);
    d = localParaUtc(
      Number(aaaa),
      Number(mm),
      Number(dd),
      Number(hh ?? 0),
      Number(mi ?? 0),
      Number(ss ?? 0),
      fuso,
    );
  } else {
    const s = String(bruto).trim();
    const m = ISO_SEM_FUSO.exec(s);
    if (m) {
      const [, aaaa, mm, dd, hh, mi, ss] = m;
      d = localParaUtc(
        Number(aaaa),
        Number(mm),
        Number(dd),
        Number(hh ?? 0),
        Number(mi ?? 0),
        Number(ss ?? 0),
        fuso,
      );
    } else if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
      d = new Date(s);
    } else {
      invalida(bruto, 'iso');
    }
  }
  if (Number.isNaN(d.getTime())) invalida(bruto, formato);
  return d;
}
