/**
 * Dados da empresa demo (PASIO) derivados de `@trafego/fixtures` (imagem de referência).
 * Funções puras e determinísticas: nenhuma aleatoriedade, somas exatas.
 */
import { referencia } from './referencia.js';
import type { NovaMetricaDiaria } from '../schema.js';

/** Canal reservado que guarda o funil ilustrativo da imagem (não entra na tabela nem nos KPIs). */
export const CANAL_FUNIL = '__funil__';

export const PERIODO_ATUAL = { inicio: '2024-05-01', fim: '2024-05-24' } as const;
/** Período anterior de mesma duração (24 dias). */
export const PERIODO_COMPARACAO = { inicio: '2024-04-07', fim: '2024-04-30' } as const;

/**
 * Totais do período de comparação. Investimento, FTDs e Depósitos reproduzem as variações da
 * imagem (+12,5%, +18,6%, +22,1%). CPA e ROAS são derivados deles e a imagem é inconsistente
 * nesses dois: com estes totais saem -5,1% e +8,5% (a imagem mostra -5,4% e +16,8%).
 */
export const TOTAIS_COMPARACAO = {
  investimento: 30080,
  ftds: 839,
  depositos: 185251,
  /** Métricas sem variação na imagem: 85% do período atual. */
  fator: 0.85,
} as const;

export interface LinhaCanal {
  canal: string;
  investimento: number | null;
  cliques: number;
  visitas: number;
  cadastros: number;
  ftds: number;
  ftdsValor: number;
  depositos: number;
  baseContatada: number;
}

type CampoInteiro = 'cliques' | 'visitas' | 'cadastros' | 'ftds' | 'ftdsValor' | 'depositos';

/** Lista de dias ISO (AAAA-MM-DD) de `inicio` a `fim`, inclusive. */
export function dias(inicio: string, fim: string): string[] {
  const saida: string[] = [];
  const d = new Date(`${inicio}T00:00:00Z`);
  const f = new Date(`${fim}T00:00:00Z`);
  while (d <= f) {
    saida.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return saida;
}

/** Divide um inteiro em `n` partes iguais (piso); o resto da divisão vai para a última. */
export function dividir(total: number, n: number): number[] {
  const parte = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? total - parte * (n - 1) : parte));
}

/** Reparte `total` proporcionalmente a `pesos` (piso); o resto vai para o último. */
export function repartir(total: number, pesos: number[]): number[] {
  const soma = pesos.reduce((a, b) => a + b, 0);
  const partes = pesos.map((p) => Math.floor((total * p) / soma));
  const resto = total - partes.reduce((a, b) => a + b, 0);
  partes[partes.length - 1] = (partes[partes.length - 1] ?? 0) + resto;
  return partes;
}

const centavos = (reais: number) => Math.round(reais * 100);
const emReais = (cent: number) => (cent / 100).toFixed(2);

/** Linhas por canal do período atual: exatamente as da tabela da imagem. */
export function canaisAtuais(): LinhaCanal[] {
  return referencia.tabela.linhas.map((l) => ({
    canal: l.canal,
    investimento: l.investimento,
    cliques: l.cliques,
    visitas: l.visitas,
    cadastros: l.cadastros,
    ftds: l.ftdsQtd,
    ftdsValor: l.ftdsValor,
    depositos: l.depositos,
    baseContatada: 0,
  }));
}

/** Linhas por canal do período de comparação, proporcionais às atuais. */
export function canaisComparacao(): LinhaCanal[] {
  const atuais = canaisAtuais();
  const t = TOTAIS_COMPARACAO;
  const comGasto = atuais.filter((l) => l.investimento !== null);
  const inv = repartir(
    t.investimento,
    comGasto.map((l) => l.investimento ?? 0),
  );
  const reparteCampo = (campo: CampoInteiro, total?: number) => {
    const alvo = total ?? Math.round(atuais.reduce((a, l) => a + l[campo], 0) * t.fator);
    return repartir(
      alvo,
      atuais.map((l) => l[campo]),
    );
  };
  const cliques = reparteCampo('cliques');
  const visitas = reparteCampo('visitas');
  const cadastros = reparteCampo('cadastros');
  const ftdsValor = reparteCampo('ftdsValor');
  const ftds = reparteCampo('ftds', t.ftds);
  const depositos = reparteCampo('depositos', t.depositos);
  return atuais.map((l, i) => ({
    canal: l.canal,
    investimento: l.investimento === null ? null : (inv[comGasto.indexOf(l)] ?? 0),
    cliques: cliques[i] ?? 0,
    visitas: visitas[i] ?? 0,
    cadastros: cadastros[i] ?? 0,
    ftds: ftds[i] ?? 0,
    ftdsValor: ftdsValor[i] ?? 0,
    depositos: depositos[i] ?? 0,
    baseContatada: 0,
  }));
}

/** Funil ilustrativo da imagem (não concilia com a tabela; ver wiki dados-de-referencia). */
export function linhaFunil(): LinhaCanal {
  const valor = (id: string) => referencia.funil.etapas.find((e) => e.id === id)?.valor ?? 0;
  return {
    canal: CANAL_FUNIL,
    investimento: null,
    baseContatada: valor('base'),
    cliques: valor('cliques'),
    visitas: valor('visitas'),
    cadastros: valor('cadastro'),
    ftds: valor('ftd'),
    ftdsValor: 0,
    depositos: 0,
  };
}

/** Espalha uma linha de período pelos dias (inteiros e centavos; resto no último dia). */
export function linhasDiarias(
  tenantId: string,
  linha: LinhaCanal,
  listaDias: string[],
): NovaMetricaDiaria[] {
  const n = listaDias.length;
  const inv = linha.investimento === null ? null : dividir(centavos(linha.investimento), n);
  const cliques = dividir(linha.cliques, n);
  const visitas = dividir(linha.visitas, n);
  const cadastros = dividir(linha.cadastros, n);
  const ftds = dividir(linha.ftds, n);
  const ftdsValor = dividir(centavos(linha.ftdsValor), n);
  const depositos = dividir(centavos(linha.depositos), n);
  const base = dividir(linha.baseContatada, n);
  return listaDias.map((day, i) => ({
    tenantId,
    day,
    channel: linha.canal,
    campaign: '',
    page: '',
    investimento: inv === null ? null : emReais(inv[i] ?? 0),
    cliques: cliques[i] ?? 0,
    visitas: visitas[i] ?? 0,
    cadastros: cadastros[i] ?? 0,
    ftds: ftds[i] ?? 0,
    ftdsValor: emReais(ftdsValor[i] ?? 0),
    depositos: emReais(depositos[i] ?? 0),
    baseContatada: base[i] ?? 0,
  }));
}

/** Todas as linhas de `metrics_daily` da empresa demo. */
export function metricasDemo(tenantId: string): NovaMetricaDiaria[] {
  const atual = dias(PERIODO_ATUAL.inicio, PERIODO_ATUAL.fim);
  const comp = dias(PERIODO_COMPARACAO.inicio, PERIODO_COMPARACAO.fim);
  return [
    ...canaisAtuais().flatMap((l) => linhasDiarias(tenantId, l, atual)),
    ...linhasDiarias(tenantId, linhaFunil(), atual),
    ...canaisComparacao().flatMap((l) => linhasDiarias(tenantId, l, comp)),
  ];
}

/** Cores dos canais (tokens de acento da imagem; editáveis em Configurações → Apresentação). */
export const CANAIS_APRESENTACAO = [
  { nome: 'Meta', cor: '#0070F8', ordem: 1 },
  { nome: 'Email', cor: '#04ADDF', ordem: 2 },
  { nome: 'SMS', cor: '#24CCB6', ordem: 3 },
  { nome: 'Afiliados', cor: '#00C98B', ordem: 4 },
  { nome: 'Outros', cor: '#748BA5', ordem: 5 },
] as const;

export const COLUNAS_APRESENTACAO = [
  'canal',
  'investimento',
  'cliques',
  'visitas',
  'cadastros',
  'ftdsQtd',
  'ftdsValor',
  'depositos',
  'cpa',
  'roas',
] as const;

/** Logo padrão: `packages/design/brand/pasio-logo.png`, servido pelo web como `/brand/pasio-logo.png`. */
export const LOGO_PADRAO = '/brand/pasio-logo.png';

export function apresentacaoDemo() {
  return {
    nomeExibicao: referencia.empresa,
    logoUrl: LOGO_PADRAO,
    subtitulo: referencia.subtitulo,
    kpis: referencia.kpis.map((k, i) => ({
      id: k.id,
      rotulo: k.rotulo,
      visivel: true,
      ordem: i + 1,
    })),
    columns: COLUNAS_APRESENTACAO.map((id, i) => ({ id, visivel: true, ordem: i + 1 })),
    channels: CANAIS_APRESENTACAO.map((c) => ({ ...c })),
    palette: Object.fromEntries(referencia.kpis.map((k) => [k.id, k.cor])),
    currency: 'BRL',
    timezone: 'America/Sao_Paulo',
  };
}
