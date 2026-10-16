'use server';
/**
 * Server actions do clique no funil: lista da etapa e ficha do lead. Rodam só no servidor do Next
 * (o navegador não vê token nem fala com a API). A API exige papel analista ou acima.
 */
import {
  ETAPAS_LISTA,
  type EtapaLista,
  type EventosEtapaResposta,
  type FichaLead,
} from '@trafego/contratos';
import { api } from '@/lib/api';
import { mensagemLeads as mensagem } from '@/lib/leads';

export type RespostaFunil<T> = { ok: true; dados: T } | { ok: false; mensagem: string };

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export interface PedidoEtapa {
  etapa: string;
  de?: string;
  ate?: string;
  canal?: string;
  campanha?: string;
}

/** Eventos da etapa no período e nos filtros do painel (mais recentes primeiro). */
export async function buscarEtapa(p: PedidoEtapa): Promise<RespostaFunil<EventosEtapaResposta>> {
  if (!(ETAPAS_LISTA as readonly string[]).includes(p.etapa))
    return { ok: false, mensagem: 'Etapa desconhecida.' };
  const r = await api().eventosEtapa({
    etapa: p.etapa as EtapaLista,
    ...(p.de && DATA_ISO.test(p.de) ? { de: p.de } : {}),
    ...(p.ate && DATA_ISO.test(p.ate) ? { ate: p.ate } : {}),
    ...(p.canal ? { canal: p.canal } : {}),
    ...(p.campanha ? { campanha: p.campanha } : {}),
  });
  return r.ok ? r : { ok: false, mensagem: mensagem(r, 'a lista') };
}

/** Ficha do lead: eventos, toques da tag e corpo dos webhooks (campos sensíveis já mascarados). */
export async function buscarLead(leadKey: string): Promise<RespostaFunil<FichaLead>> {
  const chave = leadKey.trim();
  if (!chave || chave.length > 200) return { ok: false, mensagem: 'Usuário inválido.' };
  const r = await api().lead(chave);
  return r.ok ? r : { ok: false, mensagem: mensagem(r, 'a ficha') };
}
