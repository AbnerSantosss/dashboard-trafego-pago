/**
 * Filtros da tela expandida de leads (/leads): leitura segura da URL e consulta para a API.
 * Tudo que vem da URL é tratado como não confiável; o que não valida volta ao padrão.
 */
import {
  ETAPAS_LISTA,
  ORDENS_LISTA,
  type EtapaLista,
  type EventosEtapaQuery,
  type OrdemLista,
} from '@trafego/contratos';
import type { Resultado } from './api';

/** Linhas por página na tela expandida. */
export const POR_PAGINA = 50;

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export interface FiltrosLeadsLidos {
  etapa: EtapaLista;
  de?: string;
  ate?: string;
  canal: string | null;
  campanha: string | null;
  busca: string;
  ordem: OrdemLista;
  offset: number;
  lead: string | null;
}

type Params = Record<string, string | string[] | undefined>;

function um(sp: Params, chave: string): string {
  const v = sp[chave];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
}

function dataValida(s: string): boolean {
  if (!DATA_ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

/** Lê os filtros da URL. Sem etapa válida, abre em FTD. */
export function lerFiltrosLeads(sp: Params): FiltrosLeadsLidos {
  const etapa = um(sp, 'etapa');
  const ordem = um(sp, 'ordem');
  const de = um(sp, 'de');
  const ate = um(sp, 'ate');
  const canal = um(sp, 'canal').slice(0, 80);
  const campanha = um(sp, 'campanha').slice(0, 200);
  const offset = Number.parseInt(um(sp, 'offset'), 10);
  const lead = um(sp, 'lead').slice(0, 200);
  const datas = dataValida(de) && dataValida(ate) && de > ate ? { de: ate, ate: de } : { de, ate };
  return {
    etapa: (ETAPAS_LISTA as readonly string[]).includes(etapa) ? (etapa as EtapaLista) : 'ftd',
    ...(dataValida(datas.de) ? { de: datas.de } : {}),
    ...(dataValida(datas.ate) ? { ate: datas.ate } : {}),
    canal: canal && canal !== 'todos' ? canal : null,
    campanha: campanha && campanha !== 'todas' ? campanha : null,
    busca: um(sp, 'busca').slice(0, 100),
    ordem: (ORDENS_LISTA as readonly string[]).includes(ordem) ? (ordem as OrdemLista) : 'recentes',
    offset:
      Number.isFinite(offset) && offset > 0
        ? Math.min(Math.floor(offset / POR_PAGINA) * POR_PAGINA, 100_000)
        : 0,
    lead: lead || null,
  };
}

/** Consulta da página atual para `GET /empresas/atual/eventos`. */
export function consultaLeads(f: FiltrosLeadsLidos): EventosEtapaQuery {
  return {
    etapa: f.etapa,
    ...(f.de ? { de: f.de } : {}),
    ...(f.ate ? { ate: f.ate } : {}),
    ...(f.canal ? { canal: f.canal } : {}),
    ...(f.campanha ? { campanha: f.campanha } : {}),
    ...(f.busca ? { busca: f.busca } : {}),
    ...(f.ordem !== 'recentes' ? { ordem: f.ordem } : {}),
    ...(f.offset ? { offset: f.offset } : {}),
    limite: POR_PAGINA,
  };
}

/** Mensagem para a pessoa quando a API recusa ou falha. */
export function mensagemLeads(r: Extract<Resultado<unknown>, { ok: false }>, alvo: string): string {
  if (r.status === 403 || r.codigo === 'acesso_negado')
    return 'Só analistas e administradores veem os dados de cada pessoa.';
  if (r.status === 404 || r.codigo === 'lead_nao_encontrado')
    return 'Não há mais registros deste usuário.';
  return `Não foi possível carregar ${alvo} agora. ${r.mensagem}`;
}
