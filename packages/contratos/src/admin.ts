/**
 * Contrato das rotas de administração por empresa (Fase 5 enxuta, D15/D18).
 * Dono: orquestrador. API e web importam daqui; nenhum dos dois altera este arquivo.
 *
 * Todas as rotas exigem token válido, cabeçalho `x-tenant` e papel `admin` na empresa ativa
 * (403 `acesso_negado` caso contrário). Erros seguem `{ erro: { codigo, mensagem, detalhes?, requestId } }`.
 */

// ---------------------------------------------------------------------------
// P5.1 — Apresentação (nome exibido e logo)
// ---------------------------------------------------------------------------

export const LOGO_TIPOS = ['image/png', 'image/svg+xml'] as const;
export type LogoTipo = (typeof LOGO_TIPOS)[number];
/** Limite do arquivo decodificado (bytes), conforme a wiki de administração. */
export const LOGO_TAMANHO_MAXIMO = 512 * 1024;
export const NOME_EXIBICAO_MAXIMO = 60;

/** `GET /empresas/atual/apresentacao` → 200 */
export interface ApresentacaoResposta {
  nomeExibicao: string;
  /** URL pública (`/brand/...`) ou `data:` com o logo enviado; `null` = sem logo (web mostra o nome). */
  logoUrl: string | null;
  /** Padrão desta empresa quando `logoUrl` é null (PASIO: `/brand/pasio-logo.png`; demais: null). */
  logoPadraoUrl: string | null;
  atualizadoEm: string | null;
}

/**
 * `PATCH /empresas/atual/apresentacao` — corpo JSON. Campos ausentes não mudam.
 * `logo: null` remove o logo enviado (volta ao padrão). O arquivo vai em base64 (sem prefixo `data:`);
 * a API valida tipo real (assinatura PNG / raiz `<svg`), rejeita SVG com `<script`, `on*=`,
 * `javascript:` ou `<foreignObject` (422 `logo_invalido`) e tamanho acima de LOGO_TAMANHO_MAXIMO
 * (413 `logo_grande`). Guarda como `data:<tipo>;base64,...` em `presentation.logo_url`.
 * Resposta 200: ApresentacaoResposta. Deve limpar o cache de métricas da empresa.
 */
export interface ApresentacaoPatch {
  nomeExibicao?: string;
  logo?: { tipo: LogoTipo; base64: string } | null;
}

// ---------------------------------------------------------------------------
// P5.2 — Fontes de webhook e segredo
// ---------------------------------------------------------------------------

export interface FonteResumo {
  id: string;
  slug: string;
  nome: string;
  ativo: boolean;
  /** Caminho de recebimento: `/webhooks/<empresa>/<fonte>` (sem host). */
  caminho: string;
  /** true quando a API consegue validar assinaturas desta fonte (segredo cifrado no banco ou em WEBHOOK_SEGREDOS). */
  segredoUtilizavel: boolean;
  criadoEm: string;
  atualizadoEm: string | null;
}

/** `GET /empresas/atual/fontes` → 200 */
export interface FontesResposta {
  fontes: FonteResumo[];
}

/** `POST /empresas/atual/fontes` → 201 FonteComSegredo. 409 `fonte_existente` se o slug repetir. */
export interface FonteCriar {
  /** kebab-case, 2–40 caracteres, `^[a-z0-9][a-z0-9-]*$`. */
  slug: string;
  nome: string;
}

/** `PATCH /empresas/atual/fontes/:id` → 200 FonteResumo. 404 `fonte_nao_encontrada`. */
export interface FonteAtualizar {
  nome?: string;
  ativo?: boolean;
}

/**
 * `POST /empresas/atual/fontes/:id/segredo` → 200 FonteComSegredo (rotação).
 * O segredo em claro aparece UMA vez nesta resposta; o banco guarda `secret_hash` (scrypt) e
 * `secret_enc` (AES-256-GCM com a chave de `WEBHOOK_CHAVE_CIFRA`). Nunca é logado.
 */
export interface FonteComSegredo {
  fonte: FonteResumo;
  /** 32 bytes aleatórios em base64url. */
  segredo: string;
}
