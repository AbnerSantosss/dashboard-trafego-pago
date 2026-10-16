/**
 * Contrato do gasto em anúncios: lançamentos manuais (aba Gastos) e contas do Meta Ads (aba Meta Ads).
 * Os dois gravam na tabela `custos` e entram no Investimento do painel (agregação diária).
 *
 * Papéis: listar e lançar gasto manual exige `analista` ou acima; conectar, sincronizar e remover
 * contas do Meta exige `admin`. Erros seguem `{ erro: { codigo, mensagem, detalhes?, requestId } }`.
 */

export const ORIGENS_CUSTO = ['manual', 'meta'] as const;
export type OrigemCusto = (typeof ORIGENS_CUSTO)[number];

/** Um lançamento de gasto. `valor` em reais (2 casas). */
export interface CustoResumo {
  id: string;
  dia: string;
  canal: string;
  campanha: string;
  valor: number;
  origem: OrigemCusto;
  /** Nome da conta do Meta (só `origem = 'meta'`). */
  conta: string | null;
  descricao: string | null;
  criadoEm: string;
}

/** `GET /empresas/atual/custos?de=AAAA-MM-DD&ate=AAAA-MM-DD` → 200. Sem datas: últimos 30 dias. */
export interface CustosResposta {
  de: string;
  ate: string;
  /** Mais recentes primeiro; até 1000 linhas. */
  custos: CustoResumo[];
  total: number;
  /** Total por canal, na ordem de maior gasto. */
  porCanal: Array<{ canal: string; total: number }>;
}

/** `POST /empresas/atual/custos` → 201 CustoResumo. Recalcula o dia no painel. */
export interface CustoCriar {
  dia: string;
  canal: string;
  campanha?: string;
  /** Maior que zero, até 2 casas. */
  valor: number;
  descricao?: string;
}

/** `GET /empresas/atual/meta/contas` → 200. O token nunca volta. */
export interface MetaContaResumo {
  id: string;
  contaId: string;
  nome: string;
  moeda: string | null;
  canal: string;
  ativo: boolean;
  ultimaSync: string | null;
  ultimoErro: string | null;
  criadoEm: string;
}

export interface MetaContasResposta {
  contas: MetaContaResumo[];
  /** Moeda da empresa, para a tela avisar contas em outra moeda (o painel não converte). */
  moedaEmpresa: string;
}

/**
 * `POST /empresas/atual/meta/contas` → 201 `{ conta, sincronizacao }`.
 * A API valida o token lendo a conta no Meta (422 `meta_recusou` com a mensagem traduzida) e já
 * lê os últimos 30 dias. 409 `meta_conta_existente` se a conta já estiver ligada à empresa.
 */
export interface MetaContaCriar {
  /** `act_123...` ou só os números. */
  contaId: string;
  token: string;
  /** Canal do painel; padrão `Meta`. */
  canal?: string;
}

export type MetaSincronizacao =
  | { ok: true; de: string; ate: string; linhas: number; total: number }
  | { ok: false; mensagem: string };

export interface MetaContaCriada {
  conta: MetaContaResumo;
  sincronizacao: MetaSincronizacao;
}

/** `POST /empresas/atual/meta/contas/:id/sincronizar` corpo opcional `{ dias }` (1 a 90, padrão 30). */
export interface MetaSincronizarPedido {
  dias?: number;
}

/**
 * `PATCH /empresas/atual/meta/contas/:id` → 200 MetaContaResumo. Troca o token (validado no Meta),
 * o canal ou ativa/desativa a sincronização automática.
 */
export interface MetaContaAtualizar {
  token?: string;
  canal?: string;
  ativo?: boolean;
}
