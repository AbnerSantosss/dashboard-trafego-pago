/**
 * Converte a resposta da API (números crus) no conteúdo da tela (strings formatadas em pt-BR).
 * Sem dados (falha da API), devolve os blocos vazios: rótulos fixos e "–" nos valores.
 */
import type { KpiId, LinhaCanalMetrica, VisaoGeralResposta } from '@trafego/contratos';
import { formatarInteiro, formatarPercentual, NULO, referencia } from '@trafego/fixtures';
import type { EtapaFunilProps } from '@trafego/graficos';
import {
  COLUNAS_DADO,
  formatarCelula,
  formatarDataIso,
  formatarDelta,
  formatarKpi,
  textoAtualizacao,
  tomDelta,
  type Filtros,
} from './regras';
import type { ConteudoTela, KpiTela } from './tela';

const ORDEM_KPIS: KpiId[] = ['investimento', 'ftds', 'cpa', 'depositos', 'roas'];

function rotuloKpi(id: KpiId): string {
  return referencia.kpis.find((k) => k.id === id)?.rotulo ?? id;
}

export function textoPeriodo(de: string | undefined, ate: string | undefined): string {
  if (!de || !ate) return NULO;
  return `${formatarDataIso(de)} – ${formatarDataIso(ate)}`;
}

export function montarConteudo(
  dados: VisaoGeralResposta | null,
  filtros: Filtros,
  linhasOrdenadas: LinhaCanalMetrica[],
): ConteudoTela {
  const R = referencia;
  const de = dados?.periodo.de ?? filtros.de;
  const ate = dados?.periodo.ate ?? filtros.ate;

  const idsKpi = dados?.apresentacao.kpis.length ? dados.apresentacao.kpis : ORDEM_KPIS;
  const kpis: KpiTela[] = idsKpi.map((id) => {
    const k = dados?.kpis.find((m) => m.id === id);
    const valor = k?.valor ?? null;
    const variacao = k?.variacaoPct ?? null;
    return {
      id,
      rotulo: rotuloKpi(id),
      valor,
      valorTexto: valor === null ? NULO : formatarKpi(id, valor),
      deltaTexto: formatarDelta(variacao),
      direcao: (variacao ?? 0) < 0 ? 'baixa' : 'alta',
      tom: tomDelta(id, variacao),
      sparkline: k ? k.sparkline : null,
    };
  });

  const comparar = filtros.comparar === 'nenhum' ? 'Nenhum' : 'Período anterior';
  return {
    titulo: R.titulo,
    subtitulo: dados?.apresentacao.subtitulo || R.subtitulo,
    atualizadoRotulo: R.atualizadoEm.rotulo,
    atualizadoValor:
      dados && ate ? textoAtualizacao(dados.atualizadoEm, ate, dados.apresentacao.timezone) : NULO,
    exportar: R.botoes.exportar,
    limpar: R.botoes.limparFiltros,
    filtros: [
      { id: 'periodo', rotulo: 'Período.', valor: textoPeriodo(de, ate) },
      { id: 'comparar', rotulo: 'Comparar com', valor: comparar },
      { id: 'canal', rotulo: 'Canal', valor: filtros.canal === 'todos' ? 'Todos' : filtros.canal },
      {
        id: 'campanha',
        rotulo: 'Campanha',
        valor: filtros.campanha === 'todas' ? 'Todas' : filtros.campanha,
      },
    ],
    kpis,
    legendaVariacao: R.legendaVariacao,
    funil: {
      titulo: R.funil.titulo,
      etapas: R.funil.etapas.map((e) => ({ rotulo: e.rotulo, valor: '', taxa: '' })),
    },
    tabela: {
      titulo: R.tabela.titulo,
      cabecalhos: R.tabela.cabecalhos,
      linhas: linhasOrdenadas.map((l) => ({
        canal: l.canal,
        cor: l.cor,
        celulas: COLUNAS_DADO.map((c) => formatarCelula(c, l)),
      })),
      total: dados ? COLUNAS_DADO.map((c) => formatarCelula(c, dados.total)) : null,
    },
  };
}

/** Etapas no formato do componente Funil. */
/** Etapas que não existem na imagem de referência (só aparecem com dados reais). */
const ROTULO_FUNIL_EXTRA: Record<string, string> = { redeposito: 'Redepósito' };

export function etapasFunil(dados: VisaoGeralResposta | null): EtapaFunilProps[] {
  if (!dados) return [];
  return dados.funil.map((e, i) => ({
    id: e.id,
    rotulo:
      referencia.funil.etapas.find((r) => r.id === e.id)?.rotulo ??
      ROTULO_FUNIL_EXTRA[e.id] ??
      e.id,
    valor: e.valor,
    valorFormatado: formatarInteiro(e.valor),
    taxaFormatada:
      e.taxaPct === null ? NULO : formatarPercentual(e.taxaPct, { casas: i === 0 ? 0 : 1 }),
    legenda: i === 0 ? referencia.funil.legendaBase : referencia.funil.legendaConversao,
  }));
}
