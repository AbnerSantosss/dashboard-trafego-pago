/**
 * Mock da API montado da fixture da imagem de referência. Só é usado com `WEB_MOCK_API=1`
 * (testes visuais e desenvolvimento sem a rota pronta); nunca como fallback de falha.
 */
import type {
  LinhaCanalMetrica,
  VisaoGeralQuery,
  VisaoGeralResposta,
  KpiId,
} from '@trafego/contratos';
import { referencia, type LinhaCanal } from '@trafego/fixtures';

const CORES: Record<string, string> = {
  Meta: '#0070F8',
  Email: '#04ADDF',
  SMS: '#24CCB6',
  Afiliados: '#00C98B',
  Outros: '#748BA5',
};

/** Curva da sparkline do protótipo (sobe ao longo do período). */
const SPARK = [2, 4, 3, 7, 11, 14, 13, 11, 9, 9, 12, 16, 18, 17, 18, 20, 22, 23];

function linha(l: LinhaCanal): LinhaCanalMetrica {
  return {
    canal: l.canal,
    cor: CORES[l.canal] ?? null,
    investimento: l.investimento,
    cliques: l.cliques,
    visitas: l.visitas,
    cadastros: l.cadastros,
    ftdsQtd: l.ftdsQtd,
    ftdsValor: l.ftdsValor,
    depositos: l.depositos,
    cpa: l.cpa,
    roas: l.roas,
  };
}

export function visaoGeralMock(q: VisaoGeralQuery): VisaoGeralResposta {
  const de = q.de ?? '2024-05-01';
  const ate = q.ate ?? '2024-05-24';
  let canais = referencia.tabela.linhas.map(linha);
  if (q.canal && q.canal !== 'todos') canais = canais.filter((c) => c.canal === q.canal);
  const comparar = q.comparar !== 'nenhum';
  return {
    periodo: { de, ate },
    comparacao: comparar ? { de: '2024-04-07', ate: '2024-04-30' } : null,
    atualizadoEm: '2024-05-24T11:30:00.000Z',
    apresentacao: {
      nomeExibicao: referencia.empresa,
      logoUrl: '/brand/pasio-logo.png',
      subtitulo: referencia.subtitulo,
      kpis: [],
      columns: [],
      channels: Object.entries(CORES).map(([canal, cor], ordem) => ({ canal, cor, ordem })),
      palette: {},
      currency: 'BRL',
      timezone: 'America/Sao_Paulo',
    },
    kpis: referencia.kpis.map((k) => ({
      id: k.id as KpiId,
      valor: k.valor,
      valorAnterior: comparar ? k.valor / (1 + k.variacaoPct / 100) : null,
      variacaoPct: comparar ? k.variacaoPct : null,
      sparkline: SPARK,
    })),
    funil: referencia.funil.etapas.map((e) => ({ id: e.id, valor: e.valor, taxaPct: e.taxaPct })),
    canais,
    total: linha(referencia.tabela.total),
    opcoes: {
      canais: referencia.tabela.linhas.map((l) => l.canal),
      campanhas: ['Lançamento Maio', 'Remarketing', 'Base fria'],
    },
  };
}
