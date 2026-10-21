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

export const MSG_SUCESSO_APRESENTACAO = 'Salvo. O menu já mostra o nome e o logo novos.';
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
  /** Só na segunda etapa do login: o desafio venceu ou sumiu, e é preciso entrar de novo. */
  expirou?: boolean;
  /**
   * Só ao iniciar a verificação em duas etapas: segredo em base32 e o QR (SVG em base64) para o
   * app autenticador. Ficam só no estado desta resposta, como o segredo de webhook.
   */
  duasEtapas?: { segredo: string; qrSvgBase64: string };
}

export const ESTADO_INICIAL: EstadoAcao = { ok: true, mensagem: '' };

/** Segredo base32 em grupos de 4 ("JBSW Y3DP ..."), mais fácil de digitar no app autenticador. */
export function agruparSegredo(segredo: string): string {
  return (segredo.replace(/\s+/g, '').match(/.{1,4}/g) ?? []).join(' ');
}

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
    case 'custo_nao_encontrado':
      return 'Gasto não encontrado. Recarregue a página.';
    case 'meta_conta_nao_encontrada':
      return 'Conta do Meta não encontrada. Recarregue a página.';
    case 'meta_conta_existente':
      return 'Esta conta de anúncios já está conectada.';
    case 'meta_recusou':
      return semHttp(r.mensagem);
  }
  return `Não foi possível salvar agora. ${r.mensagem}`;
}

/** URL completa de recebimento: origem pública (sem barra final) + caminho, ou só o caminho. */
export function urlWebhook(caminho: string, origem: string | undefined): string {
  const o = (origem ?? '').trim().replace(/\/+$/, '');
  return o ? `${o}${caminho}` : caminho;
}

/** Tira o sufixo ` (HTTP 422)` que o cliente da API acrescenta às mensagens de erro. */
function semHttp(mensagem: string): string {
  return mensagem.replace(/\s*\(HTTP \d{3}\)$/, '');
}

/**
 * Lê um valor em reais digitado no formato brasileiro (`1.234,56`, `150,5`, `R$ 80`) ou com ponto
 * decimal (`150.25`). Devolve null se não for um número positivo com até 2 casas.
 */
export function lerValorReais(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

const REAIS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** `1234.5` → `R$ 1.234,50`. */
export function formatarReais(valor: number): string {
  return REAIS.format(valor).replace(/[\u00a0\u202f]/g, ' ');
}

/** `2026-03-09` → `09/03/2026`. */
export function formatarDia(dia: string): string {
  const [a, m, d] = dia.split('-');
  return a && m && d ? `${d}/${m}/${a}` : dia;
}

/** Aceita `act_123`, `123` ou com espaços; devolve `act_123` ou null (mesma regra da API). */
export function normalizarContaMeta(valor: string): string | null {
  const v = valor.trim().replace(/\s+/g, '');
  const id = /^\d+$/.test(v) ? `act_${v}` : v;
  return /^act_\d{3,20}$/.test(id) ? id : null;
}

/** Canais sugeridos no lançamento manual (o campo aceita qualquer outro). */
export const CANAIS_SUGERIDOS = ['Meta', 'Google', 'TikTok', 'Email', 'SMS', 'Afiliados', 'Outros'];
