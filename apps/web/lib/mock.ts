/**
 * Mock da API montado da fixture da imagem de referência. Só é usado com `WEB_MOCK_API=1`
 * (testes visuais e desenvolvimento sem a rota pronta); nunca como fallback de falha.
 */
import type {
  ApresentacaoPatch,
  ApresentacaoResposta,
  FonteAtualizar,
  FonteComSegredo,
  FonteCriar,
  FonteResumo,
  FontesResposta,
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

// ---------------------------------------------------------------------------
// Administração (Fase 5): estado em memória do processo, só para WEB_MOCK_API=1.
// ---------------------------------------------------------------------------

type R<T> =
  { ok: true; dados: T } | { ok: false; mensagem: string; codigo?: string; status?: number };

function fonteBase(slug: string, nome: string, n: number): FonteResumo {
  return {
    id: `mock-${n}`,
    slug,
    nome,
    ativo: true,
    caminho: `/webhooks/pasio/${slug}`,
    segredoUtilizavel: true,
    criadoEm: '2024-05-01T12:00:00.000Z',
    atualizadoEm: null,
  };
}

function estadoInicial() {
  const apresentacao: ApresentacaoResposta = {
    nomeExibicao: referencia.empresa,
    logoUrl: null,
    logoPadraoUrl: '/brand/pasio-logo.png',
    atualizadoEm: null,
  };
  return {
    apresentacao,
    fontes: [fonteBase('hotmart', 'Hotmart', 1), fonteBase('plataforma', 'Plataforma', 2)],
    seq: 2,
  };
}

let estado = estadoInicial();

/** Segredo falso e previsível: o mock não protege nada. */
function segredoFalso(): string {
  return `mock-segredo-${Date.now().toString(36)}`;
}

const naoEncontrada = {
  ok: false as const,
  mensagem: 'Fonte não encontrada.',
  codigo: 'fonte_nao_encontrada',
  status: 404,
};

export const adminMock = {
  reiniciar() {
    estado = estadoInicial();
  },
  async apresentacao(): Promise<R<ApresentacaoResposta>> {
    return { ok: true, dados: { ...estado.apresentacao } };
  },
  async salvarApresentacao(p: ApresentacaoPatch): Promise<R<ApresentacaoResposta>> {
    const a = { ...estado.apresentacao, atualizadoEm: new Date().toISOString() };
    if (p.nomeExibicao !== undefined) a.nomeExibicao = p.nomeExibicao;
    if (p.logo === null) a.logoUrl = null;
    else if (p.logo) a.logoUrl = `data:${p.logo.tipo};base64,${p.logo.base64}`;
    estado.apresentacao = a;
    return { ok: true, dados: { ...a } };
  },
  async fontes(): Promise<R<FontesResposta>> {
    return { ok: true, dados: { fontes: estado.fontes.map((f) => ({ ...f })) } };
  },
  async criarFonte(p: FonteCriar): Promise<R<FonteComSegredo>> {
    if (estado.fontes.some((f) => f.slug === p.slug))
      return { ok: false, mensagem: 'Slug já existe.', codigo: 'fonte_existente', status: 409 };
    const fonte = {
      ...fonteBase(p.slug, p.nome, ++estado.seq),
      criadoEm: new Date().toISOString(),
    };
    estado.fontes.push(fonte);
    return { ok: true, dados: { fonte: { ...fonte }, segredo: segredoFalso() } };
  },
  async atualizarFonte(id: string, p: FonteAtualizar): Promise<R<FonteResumo>> {
    const f = estado.fontes.find((x) => x.id === id);
    if (!f) return naoEncontrada;
    if (p.nome !== undefined) f.nome = p.nome;
    if (p.ativo !== undefined) f.ativo = p.ativo;
    f.atualizadoEm = new Date().toISOString();
    return { ok: true, dados: { ...f } };
  },
  async rotacionarSegredo(id: string): Promise<R<FonteComSegredo>> {
    const f = estado.fontes.find((x) => x.id === id);
    if (!f) return naoEncontrada;
    f.segredoUtilizavel = true;
    return { ok: true, dados: { fonte: { ...f }, segredo: segredoFalso() } };
  },
};
