/** Classificador de canal: lista ordenada, a primeira regra que casa vence, fallback `Outros`. */
import type { EventoCanonico, RegraDeCanal } from './tipos.js';

export const CANAL_FALLBACK = 'Outros';

/** Tabela da wiki (motor-de-regras.md → Classificador de canal); `Outros` é o fallback. */
export const CANAIS_PADRAO: RegraDeCanal[] = [
  { canal: 'Afiliados', se: { campo_presente: ['affiliate_id'], utm_medium_in: ['affiliate'] } },
  {
    canal: 'Meta',
    se: { utm_source_in: ['facebook', 'instagram', 'meta'], referrer_contem: ['facebook.com'] },
  },
  { canal: 'Email', se: { utm_medium_in: ['email'] } },
  { canal: 'SMS', se: { utm_medium_in: ['sms'] } },
];

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

function campo(evento: EventoCanonico, nome: string): unknown {
  const canonico = (evento as unknown as Record<string, unknown>)[nome];
  return canonico ?? evento.extras?.[nome];
}

/** Dentro de uma regra, basta uma condição casar (OU). */
function casa(evento: EventoCanonico, regra: RegraDeCanal): boolean {
  const se = regra.se;
  const medium = norm(evento.utm_medium);
  const source = norm(evento.utm_source);
  const referrer = norm(evento.referrer);
  if (medium && se.utm_medium_in?.some((v) => norm(v) === medium)) return true;
  if (source && se.utm_source_in?.some((v) => norm(v) === source)) return true;
  if (referrer && se.referrer_contem?.some((v) => referrer.includes(norm(v)))) return true;
  return (
    se.campo_presente?.some((nome) => {
      const v = campo(evento, nome);
      return v !== undefined && v !== null && v !== '';
    }) ?? false
  );
}

export function classificarCanal(
  evento: EventoCanonico,
  regrasDeCanal: RegraDeCanal[] = CANAIS_PADRAO,
): string {
  for (const r of regrasDeCanal) if (casa(evento, r)) return r.canal;
  return CANAL_FALLBACK;
}
