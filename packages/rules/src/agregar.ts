/** Agregação diária pura e derivados (CPA, ROAS, taxas do funil). */
import { diaNoFuso } from './tempo.js';
import type { EventoCanonico } from './tipos.js';

export interface LinhaDiaria {
  /** AAAA-MM-DD no fuso da empresa. */
  dia: string;
  canal: string;
  /** `''` = sem campanha. */
  campaign: string;
  /** `''` = sem página. */
  page: string;
  /** `null` quando não houve evento `gasto` (CPA e ROAS ficam nulos). */
  investimento: number | null;
  cliques: number;
  visitas: number;
  cadastros: number;
  ftds: number;
  ftds_valor: number;
  depositos: number;
  base_contatada: number;
}

export interface OpcoesAgregacao {
  fuso: string;
  /** Depósitos incluem o valor dos FTDs (padrão true, como na imagem de referência). */
  depositosIncluemFtd?: boolean;
}

interface Acumulador {
  linha: LinhaDiaria;
  inv: number | null;
  ftdv: number;
  dep: number;
}

const centavos = (v: number | undefined) => Math.round((v ?? 0) * 100);

/**
 * Agrupa por (dia no fuso, canal, campanha, página), somando em centavos inteiros.
 * Cliques com `base=true` contam em `base_contatada` (envios para a base), não em `cliques`.
 */
export function agregarEventos(eventos: EventoCanonico[], opcoes: OpcoesAgregacao): LinhaDiaria[] {
  const incluiFtd = opcoes.depositosIncluemFtd ?? true;
  const mapa = new Map<string, Acumulador>();
  for (const e of eventos) {
    const dia = diaNoFuso(e.occurred_at, opcoes.fuso);
    const campaign = e.campaign ?? '';
    const page = e.page ?? '';
    const chave = JSON.stringify([dia, e.channel, campaign, page]);
    let a = mapa.get(chave);
    if (!a) {
      a = {
        linha: {
          dia,
          canal: e.channel,
          campaign,
          page,
          investimento: null,
          cliques: 0,
          visitas: 0,
          cadastros: 0,
          ftds: 0,
          ftds_valor: 0,
          depositos: 0,
          base_contatada: 0,
        },
        inv: null,
        ftdv: 0,
        dep: 0,
      };
      mapa.set(chave, a);
    }
    const l = a.linha;
    switch (e.type) {
      case 'gasto':
        a.inv = (a.inv ?? 0) + centavos(e.value);
        break;
      case 'clique':
        if (e.base) l.base_contatada++;
        else l.cliques++;
        break;
      case 'visita':
        l.visitas++;
        break;
      case 'cadastro':
        l.cadastros++;
        break;
      case 'ftd':
        l.ftds++;
        a.ftdv += centavos(e.value);
        if (incluiFtd) a.dep += centavos(e.value);
        break;
      case 'deposito':
        a.dep += centavos(e.value);
        break;
    }
  }
  const linhas = [...mapa.values()].map((a) => ({
    ...a.linha,
    investimento: a.inv === null ? null : a.inv / 100,
    ftds_valor: a.ftdv / 100,
    depositos: a.dep / 100,
  }));
  const ordem = (l: LinhaDiaria) => `${l.dia}|${l.canal}|${l.campaign}|${l.page}`;
  return linhas.sort((a, b) => (ordem(a) < ordem(b) ? -1 : ordem(a) > ordem(b) ? 1 : 0));
}

export interface Derivados {
  /** Σ gasto / Σ ftds; null sem gasto ou sem FTD. */
  cpa: number | null;
  /** Σ depósitos / Σ gasto; null sem gasto. */
  roas: number | null;
}

/** Derivados calculados depois da soma (nunca média de razões). Sem gasto: nulos, nunca zero. */
export function derivar(t: {
  investimento: number | null;
  ftds: number;
  depositos: number;
}): Derivados {
  const inv = t.investimento;
  if (inv === null || inv <= 0) return { cpa: null, roas: null };
  return { cpa: t.ftds > 0 ? inv / t.ftds : null, roas: t.depositos / inv };
}

/** Taxa de cada etapa = etapa / anterior; a primeira é 1 (100%); anterior zero → null. */
export function taxasDoFunil(etapas: number[]): (number | null)[] {
  return etapas.map((v, i) => {
    if (i === 0) return 1;
    const ant = etapas[i - 1]!;
    return ant > 0 ? v / ant : null;
  });
}
