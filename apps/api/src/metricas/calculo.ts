/**
 * Cálculo puro da Visão Geral a partir das somas por (dia, canal) já lidas do banco.
 * Derivados (CPA, ROAS, taxas do funil) sempre depois da soma, via `@trafego/rules`.
 */
import { derivar, taxasDoFunil } from '@trafego/rules';
import type {
  Apresentacao,
  EtapaFunilMetrica,
  KpiId,
  KpiMetrica,
  LinhaCanalMetrica,
  Periodo,
  VisaoGeralResposta,
} from '@trafego/contratos';
import { listarDias } from './periodo.js';

export const ORDEM_KPIS: KpiId[] = ['investimento', 'ftds', 'cpa', 'depositos', 'roas'];

/** Canais com prefixo `__` são reservados (funil ilustrativo, D11): nunca aparecem como canal. */
export const ehCanalReservado = (canal: string) => canal.startsWith('__');

export interface Somas {
  investimento: number | null;
  base: number;
  cliques: number;
  visitas: number;
  cadastros: number;
  ftds: number;
  ftdsValor: number;
  depositos: number;
}

export interface SomaDiaCanal extends Somas {
  dia: string;
  canal: string;
}

export const SOMAS_ZERO: Somas = {
  investimento: null,
  base: 0,
  cliques: 0,
  visitas: 0,
  cadastros: 0,
  ftds: 0,
  ftdsValor: 0,
  depositos: 0,
};

/** Soma em centavos para não acumular erro de ponto flutuante nos valores em reais. */
const cent = (v: number) => Math.round(v * 100);

export function somar(a: Somas, b: Somas): Somas {
  return {
    investimento:
      a.investimento === null && b.investimento === null
        ? null
        : (cent(a.investimento ?? 0) + cent(b.investimento ?? 0)) / 100,
    base: a.base + b.base,
    cliques: a.cliques + b.cliques,
    visitas: a.visitas + b.visitas,
    cadastros: a.cadastros + b.cadastros,
    ftds: a.ftds + b.ftds,
    ftdsValor: (cent(a.ftdsValor) + cent(b.ftdsValor)) / 100,
    depositos: (cent(a.depositos) + cent(b.depositos)) / 100,
  };
}

const somarTodas = (linhas: Somas[]) => linhas.reduce(somar, SOMAS_ZERO);

function valorKpi(id: KpiId, s: Somas): number | null {
  const d = derivar({ investimento: s.investimento, ftds: s.ftds, depositos: s.depositos });
  switch (id) {
    case 'investimento':
      return s.investimento;
    case 'ftds':
      return s.ftds;
    case 'depositos':
      return s.depositos;
    case 'cpa':
      return d.cpa;
    default:
      return d.roas;
  }
}

function linhaCanal(canal: string, cor: string | null, s: Somas): LinhaCanalMetrica {
  const d = derivar({ investimento: s.investimento, ftds: s.ftds, depositos: s.depositos });
  return {
    canal,
    cor,
    investimento: s.investimento,
    cliques: s.cliques,
    visitas: s.visitas,
    cadastros: s.cadastros,
    ftdsQtd: s.ftds,
    ftdsValor: s.ftdsValor,
    depositos: s.depositos,
    cpa: d.cpa,
    roas: d.roas,
  };
}

const dentro = (dia: string, p: Periodo) => dia >= p.de && dia <= p.ate;

export interface EntradaCalculo {
  periodo: Periodo;
  comparacao: Periodo | null;
  /** Somas por (dia, canal) cobrindo período e comparação, já com filtro de campanha. */
  linhas: SomaDiaCanal[];
  /** Filtro de canal (`todos` = sem filtro). */
  canal: string;
  canaisVisiveis: string[];
  campanhas: string[];
  apresentacao: Apresentacao;
  atualizadoEm: string | null;
}

/** Ordena por `presentation.channels[].ordem` e depois alfabeticamente. */
export function ordenarCanais(canais: string[], apres: Apresentacao): string[] {
  const ordem = new Map(apres.channels.map((c) => [c.canal, c.ordem]));
  return [...canais].sort((a, b) => {
    const oa = ordem.get(a) ?? Number.POSITIVE_INFINITY;
    const ob = ordem.get(b) ?? Number.POSITIVE_INFINITY;
    if (oa !== ob) return oa < ob ? -1 : 1;
    return a.localeCompare(b, 'pt-BR');
  });
}

export function calcularVisaoGeral(e: EntradaCalculo): VisaoGeralResposta {
  const { periodo, comparacao, apresentacao } = e;
  const filtrada = (l: SomaDiaCanal) =>
    !ehCanalReservado(l.canal) && (e.canal === 'todos' || l.canal === e.canal);

  const atuais = e.linhas.filter((l) => dentro(l.dia, periodo));
  const visiveisAtuais = atuais.filter(filtrada);
  const total = somarTodas(visiveisAtuais);

  // KPIs
  const totalComp = comparacao
    ? somarTodas(e.linhas.filter((l) => filtrada(l) && dentro(l.dia, comparacao)))
    : null;
  const porDia = new Map<string, Somas>();
  for (const l of visiveisAtuais) porDia.set(l.dia, somar(porDia.get(l.dia) ?? SOMAS_ZERO, l));
  const diasPeriodo = listarDias(periodo.de, periodo.ate);
  const kpis: KpiMetrica[] = ORDEM_KPIS.map((id) => {
    const valor = valorKpi(id, total);
    const valorAnterior = totalComp ? valorKpi(id, totalComp) : null;
    const variacaoPct =
      valor === null || valorAnterior === null || valorAnterior === 0
        ? null
        : ((valor - valorAnterior) / valorAnterior) * 100;
    const sparkline =
      visiveisAtuais.length === 0
        ? []
        : diasPeriodo.map((dia) => valorKpi(id, porDia.get(dia) ?? SOMAS_ZERO) ?? 0);
    return { id, valor, valorAnterior, variacaoPct, sparkline };
  });

  // Funil: se houver canal reservado no período, só ele (empresa demo, D11).
  const reservadas = atuais.filter((l) => ehCanalReservado(l.canal));
  const f = reservadas.length > 0 ? somarTodas(reservadas) : total;
  const valoresFunil = [f.base, f.cliques, f.visitas, f.cadastros, f.ftds];
  const taxas = taxasDoFunil(valoresFunil);
  const idsFunil = ['base', 'cliques', 'visitas', 'cadastro', 'ftd'] as const;
  const funil: EtapaFunilMetrica[] = idsFunil.map((id, i) => {
    const taxa = taxas[i] ?? null;
    return { id, valor: valoresFunil[i] ?? 0, taxaPct: taxa === null ? null : taxa * 100 };
  });

  // Tabela por canal
  const cores = new Map(apresentacao.channels.map((c) => [c.canal, c.cor]));
  const porCanal = new Map<string, Somas>();
  for (const l of visiveisAtuais) {
    porCanal.set(l.canal, somar(porCanal.get(l.canal) ?? SOMAS_ZERO, l));
  }
  const canais = ordenarCanais([...porCanal.keys()], apresentacao).map((c) =>
    linhaCanal(c, cores.get(c) ?? null, porCanal.get(c)!),
  );

  return {
    periodo,
    comparacao,
    atualizadoEm: e.atualizadoEm,
    apresentacao,
    kpis,
    funil,
    canais,
    total: linhaCanal('Total', null, total),
    opcoes: {
      canais: ordenarCanais(
        e.canaisVisiveis.filter((c) => !ehCanalReservado(c)),
        apresentacao,
      ),
      campanhas: [...e.campanhas].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    },
  };
}
