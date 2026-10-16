/**
 * Toques de atribuição (tag do GTM) e o cruzamento com os eventos dos webhooks.
 *
 * Um evento de webhook com `lead_key` mas sem utm/campanha herda os dados do último toque
 * daquele lead que tenha atribuição. O canal só é trocado quando a regra deixou `Outros`.
 */
import {
  CANAL_FALLBACK,
  classificarCanal,
  type EventoCanonico,
  type RegraDeCanal,
} from '@trafego/rules';
import { and, desc, eq, inArray, isNotNull, or } from 'drizzle-orm';
import { attributionTouches, type NovoEvento, type Tx } from '../db/client.js';

export interface DadosToque {
  gclid?: string | null | undefined;
  gbraid?: string | null | undefined;
  wbraid?: string | null | undefined;
  fbclid?: string | null | undefined;
  fbp?: string | null | undefined;
  ttclid?: string | null | undefined;
  ttp?: string | null | undefined;
  kwaiClickId?: string | null | undefined;
  tblci?: string | null | undefined;
  utmSource?: string | null | undefined;
  utmMedium?: string | null | undefined;
  utmCampaign?: string | null | undefined;
  referrer?: string | null | undefined;
}

/** Canal pelo click id (mais confiável que utm); depois as regras de canal pelos utms. */
export function canalDoToque(t: DadosToque, canais?: RegraDeCanal[]): string {
  if (t.gclid || t.gbraid || t.wbraid) return 'Google';
  if (t.fbclid || t.fbp) return 'Meta';
  if (t.ttclid || t.ttp) return 'TikTok';
  if (t.kwaiClickId) return 'Kwai';
  if (t.tblci) return 'Taboola';
  const evento = {
    utm_source: t.utmSource ?? undefined,
    utm_medium: t.utmMedium ?? undefined,
    referrer: t.referrer ?? undefined,
  } as EventoCanonico;
  return classificarCanal(evento, canais);
}

const temAtribuicao = or(
  isNotNull(attributionTouches.utmSource),
  isNotNull(attributionTouches.utmCampaign),
  isNotNull(attributionTouches.gclid),
  isNotNull(attributionTouches.gbraid),
  isNotNull(attributionTouches.wbraid),
  isNotNull(attributionTouches.fbclid),
  isNotNull(attributionTouches.ttclid),
  isNotNull(attributionTouches.kwaiClickId),
  isNotNull(attributionTouches.tblci),
);

/** Último toque com atribuição de cada lead (uma consulta para o lote inteiro). */
export async function ultimosToques(tx: Tx, tenantId: string, leads: string[]) {
  const mapa = new Map<string, DadosToque>();
  if (leads.length === 0) return mapa;
  const linhas = await tx
    .selectDistinctOn([attributionTouches.leadKey])
    .from(attributionTouches)
    .where(
      and(
        eq(attributionTouches.tenantId, tenantId),
        inArray(attributionTouches.leadKey, leads),
        temAtribuicao,
      ),
    )
    .orderBy(attributionTouches.leadKey, desc(attributionTouches.recebidoEm));
  for (const l of linhas) if (l.leadKey) mapa.set(l.leadKey, l);
  return mapa;
}

/** Preenche utm/campanha/canal dos eventos sem atribuição a partir dos toques do lead. */
export async function enriquecerComToques(
  tx: Tx,
  tenantId: string,
  linhas: NovoEvento[],
  canais?: RegraDeCanal[],
): Promise<number> {
  const semAtribuicao = linhas.filter(
    (l) => l.leadKey && !l.utmSource && !l.utmCampaign && !l.campaign,
  );
  if (semAtribuicao.length === 0) return 0;
  const leads = [...new Set(semAtribuicao.map((l) => l.leadKey!))];
  const toques = await ultimosToques(tx, tenantId, leads);
  let n = 0;
  for (const l of semAtribuicao) {
    const t = toques.get(l.leadKey!);
    if (!t) continue;
    l.utmSource = t.utmSource ?? null;
    l.utmMedium = t.utmMedium ?? null;
    l.utmCampaign = t.utmCampaign ?? null;
    l.campaign = t.utmCampaign ?? null;
    if (!l.channel || l.channel === CANAL_FALLBACK) l.channel = canalDoToque(t, canais);
    n++;
  }
  return n;
}
