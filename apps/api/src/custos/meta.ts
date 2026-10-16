/**
 * Cliente mínimo da Marketing API do Meta (Graph API), só leitura:
 * - `lerConta`: nome, moeda e situação da conta de anúncios (valida o token na hora de conectar);
 * - `lerGastos`: gasto diário por campanha (`insights`, `level=campaign`, `time_increment=1`).
 *
 * O token vai no cabeçalho `Authorization`, nunca na URL, para não aparecer em log nem nos links
 * de paginação. As datas do insights estão no fuso da conta de anúncios.
 */

export const VERSAO_GRAPH_PADRAO = 'v23.0';
const BASE = 'https://graph.facebook.com';
const TEMPO_LIMITE_MS = 20_000;
/** Teto de páginas por leitura (500 linhas cada): evita laço infinito se a API repetir o cursor. */
const MAX_PAGINAS = 40;

export const CONTA_ID_RE = /^act_\d{3,20}$/;

/** Aceita `act_123`, `123` ou com espaços; devolve `act_123` ou null. */
export function normalizarContaId(valor: string): string | null {
  const v = valor.trim().replace(/\s+/g, '');
  const id = /^\d+$/.test(v) ? `act_${v}` : v;
  return CONTA_ID_RE.test(id) ? id : null;
}

export interface ContaMeta {
  nome: string;
  moeda: string | null;
  /** `account_status` do Meta: 1 = ativa; 2 = desativada; 3 = pendência de pagamento etc. */
  status: number | null;
}

export interface GastoMeta {
  dia: string;
  campanhaId: string;
  campanha: string;
  /** Em reais (ou na moeda da conta), com 2 casas, como texto do Meta convertido em número. */
  valor: number;
}

/** Falha da Graph API já traduzida; `codigo` é o `error.code` do Meta quando houver. */
export class ErroMeta extends Error {
  constructor(
    mensagem: string,
    readonly codigo?: number,
  ) {
    super(mensagem);
    this.name = 'ErroMeta';
  }
}

type Fetch = typeof fetch;

export interface OpcoesMeta {
  versao?: string;
  fetch?: Fetch;
}

/** Mensagem em português para os erros mais comuns da Graph API. */
export function traduzirErroMeta(codigo: number | undefined, mensagem: string): string {
  switch (codigo) {
    case 190:
      return 'O token do Meta é inválido ou expirou. Gere um token novo e conecte a conta de novo.';
    case 10:
    case 200:
    case 294:
      return 'O token não tem permissão de leitura nesta conta (precisa de ads_read e acesso à conta).';
    case 100:
      return 'Conta de anúncios não encontrada para este token. Confira o ID (act_...).';
    case 4:
    case 17:
    case 32:
    case 613:
    case 80004:
      return 'O Meta limitou as consultas agora. A próxima sincronização tenta de novo.';
  }
  return `O Meta recusou a consulta: ${mensagem.slice(0, 200)}`;
}

export function criarClienteMeta(opcoes: OpcoesMeta = {}) {
  const versao = opcoes.versao ?? VERSAO_GRAPH_PADRAO;
  const f = opcoes.fetch ?? fetch;

  async function get(url: string, token: string): Promise<unknown> {
    let r: Response;
    try {
      r = await f(url, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
    } catch (e) {
      throw new ErroMeta(`Sem resposta do Meta: ${e instanceof Error ? e.message : String(e)}`);
    }
    let corpo: unknown = null;
    try {
      corpo = await r.json();
    } catch {
      // corpo vazio ou não JSON
    }
    if (!r.ok) {
      const erro = (corpo as { error?: { code?: unknown; message?: unknown } } | null)?.error;
      const codigo = typeof erro?.code === 'number' ? erro.code : undefined;
      const msg = typeof erro?.message === 'string' ? erro.message : `HTTP ${r.status}`;
      throw new ErroMeta(traduzirErroMeta(codigo, msg), codigo);
    }
    return corpo;
  }

  return {
    async lerConta(contaId: string, token: string): Promise<ContaMeta> {
      const url = `${BASE}/${versao}/${contaId}?fields=name,currency,account_status`;
      const c = (await get(url, token)) as {
        name?: unknown;
        currency?: unknown;
        account_status?: unknown;
      };
      return {
        nome: typeof c.name === 'string' ? c.name : '',
        moeda: typeof c.currency === 'string' ? c.currency : null,
        status: typeof c.account_status === 'number' ? c.account_status : null,
      };
    },

    /** Gasto por dia e campanha entre `de` e `ate` (inclusive, AAAA-MM-DD). Só linhas com gasto > 0. */
    async lerGastos(contaId: string, token: string, de: string, ate: string): Promise<GastoMeta[]> {
      const busca = new URLSearchParams({
        level: 'campaign',
        fields: 'campaign_id,campaign_name,spend',
        time_increment: '1',
        time_range: JSON.stringify({ since: de, until: ate }),
        limit: '500',
      });
      let url: string | null = `${BASE}/${versao}/${contaId}/insights?${busca}`;
      const linhas: GastoMeta[] = [];
      for (let pagina = 0; url && pagina < MAX_PAGINAS; pagina++) {
        const corpo = (await get(url, token)) as {
          data?: Array<Record<string, unknown>>;
          paging?: { next?: unknown };
        };
        for (const l of corpo.data ?? []) {
          const valor = Number(l.spend);
          const dia = typeof l.date_start === 'string' ? l.date_start : '';
          if (!Number.isFinite(valor) || valor <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) continue;
          linhas.push({
            dia,
            campanhaId: String(l.campaign_id ?? ''),
            campanha: typeof l.campaign_name === 'string' ? l.campaign_name : '',
            valor: Math.round(valor * 100) / 100,
          });
        }
        const proxima = corpo.paging?.next;
        url = typeof proxima === 'string' && proxima.startsWith(`${BASE}/`) ? proxima : null;
      }
      return linhas;
    },
  };
}

export type ClienteMeta = ReturnType<typeof criarClienteMeta>;
