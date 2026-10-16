/**
 * Regras puras das telas de Configurações (sem React nem Next): validação no cliente,
 * tradução de erros da API e montagem de URLs. Testadas em `testes/configuracoes.test.ts`.
 */
import type { LogoTipo } from '@trafego/contratos';

/*
 * Cópias locais das constantes do contrato (admin.ts). O index de @trafego/contratos reexporta com
 * sufixo `.js`, que o webpack do Next não resolve para `.ts`; por isso o web só importa tipos de lá.
 * `testes/configuracoes.test.ts` garante que estes valores batem com o contrato.
 */
export const LOGO_TIPOS: readonly LogoTipo[] = ['image/png', 'image/svg+xml'];
export const LOGO_TAMANHO_MAXIMO = 512 * 1024;
export const NOME_EXIBICAO_MAXIMO = 60;

export const MSG_SUCESSO_APRESENTACAO = 'Salvo. Recarregue o painel para ver a mudança.';
export const MSG_SO_ADMIN = 'Só administradores da empresa podem alterar as configurações.';
export const AVISO_SEGREDO = 'Guarde agora: ele não será mostrado de novo.';

/** Estado devolvido pelas server actions para o formulário. */
export interface EstadoAcao {
  ok: boolean;
  mensagem: string;
  /** Só em criar/rotacionar: segredo em claro, exibido uma vez e nunca persistido. */
  segredo?: string;
  /** Fonte a que o segredo pertence. */
  slug?: string;
  /** Só no convite: link de aceite, para copiar se o e-mail não chegar. */
  link?: string;
  emailEnviado?: boolean;
}

export const ESTADO_INICIAL: EstadoAcao = { ok: true, mensagem: '' };

export function formatarBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Deduz o tipo do logo pelo MIME ou, se vazio, pela extensão. */
export function tipoDoLogo(arquivo: { name: string; type: string }): LogoTipo | null {
  if ((LOGO_TIPOS as readonly string[]).includes(arquivo.type)) return arquivo.type as LogoTipo;
  if (!arquivo.type) {
    const nome = arquivo.name.toLowerCase();
    if (nome.endsWith('.png')) return 'image/png';
    if (nome.endsWith('.svg')) return 'image/svg+xml';
  }
  return null;
}

/** Valida o arquivo antes do envio. Devolve a mensagem de erro ou null se estiver ok. */
export function validarLogo(arquivo: { name: string; type: string; size: number }): string | null {
  if (!tipoDoLogo(arquivo)) return 'O logo precisa ser um arquivo PNG ou SVG.';
  if (arquivo.size > LOGO_TAMANHO_MAXIMO)
    return `O logo tem ${formatarBytes(arquivo.size)}; o limite é ${formatarBytes(LOGO_TAMANHO_MAXIMO)}.`;
  if (arquivo.size === 0) return 'O arquivo do logo está vazio.';
  return null;
}

export function validarNome(nome: string): string | null {
  const t = nome.trim();
  if (!t) return 'Informe o nome exibido.';
  if (t.length > NOME_EXIBICAO_MAXIMO)
    return `O nome exibido pode ter até ${NOME_EXIBICAO_MAXIMO} caracteres.`;
  return null;
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export function validarSlug(slug: string): string | null {
  if (slug.length < 2 || slug.length > 40) return 'O slug precisa ter de 2 a 40 caracteres.';
  if (!SLUG_RE.test(slug))
    return 'Use só letras minúsculas, números e hífen, começando por letra ou número.';
  return null;
}

/** Traduz o resultado de erro da API para uma mensagem amigável em português. */
export function mensagemErroApi(r: { mensagem: string; codigo?: string; status?: number }): string {
  if (r.codigo === 'acesso_negado' || r.status === 403) return MSG_SO_ADMIN;
  switch (r.codigo) {
    case 'logo_invalido':
      return 'O logo foi recusado: envie um PNG ou SVG válido, sem scripts.';
    case 'logo_grande':
      return `O logo passa do limite de ${formatarBytes(LOGO_TAMANHO_MAXIMO)}.`;
    case 'fonte_existente':
      return 'Já existe uma fonte com esse slug.';
    case 'fonte_nao_encontrada':
      return 'Fonte não encontrada. Recarregue a página.';
  }
  return `Não foi possível salvar agora. ${r.mensagem}`;
}

/** URL completa de recebimento: origem pública (sem barra final) + caminho, ou só o caminho. */
export function urlWebhook(caminho: string, origem: string | undefined): string {
  const o = (origem ?? '').trim().replace(/\/+$/, '');
  return o ? `${o}${caminho}` : caminho;
}
