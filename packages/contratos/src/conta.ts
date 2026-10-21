/**
 * Contrato de conta, usuários e convites (rotas em `apps/api/src/conta/`).
 * Papéis e formatos espelham os schemas zod da API.
 */

export type Papel = 'admin' | 'analista' | 'leitor';

export interface UsuarioConta {
  id: string;
  email: string;
  nome: string;
  sobrenome: string;
}

export interface EmpresaDaSessao {
  id: string;
  slug: string;
  nome: string;
  papel: Papel;
}

/** Sessão aberta por `POST /auth/login`, `/auth/redefinir`, `/auth/duas-etapas` e o aceite de convite. */
export interface Sessao {
  /** JWT de 12 h. */
  token: string;
  usuario: UsuarioConta;
  empresas: EmpresaDaSessao[];
}

/**
 * Resposta de `POST /auth/login`, `POST /auth/redefinir` e `POST /convites/:token/aceitar` quando
 * o usuário ativou a verificação em duas etapas: a senha conferiu, mas a sessão só sai em
 * `POST /auth/duas-etapas` com o código do app autenticador. O desafio vale 5 min e não serve
 * como token de acesso.
 */
export interface DesafioDuasEtapas {
  segundoFator: true;
  desafio: string;
}

/** O que as rotas que abrem sessão devolvem com 200. */
export type RespostaEntrada = Sessao | DesafioDuasEtapas;

export function pedeSegundoFator(r: RespostaEntrada): r is DesafioDuasEtapas {
  return 'segundoFator' in r && r.segundoFator === true;
}

/**
 * `POST /auth/duas-etapas` `{ desafio, codigo }` → 200 `Sessao`.
 * 401 `nao_autenticado` com código errado; 401 `token_invalido` com desafio vencido; 429 no bloqueio.
 */
export interface ConfirmacaoDuasEtapas {
  desafio: string;
  /** 6 dígitos do app autenticador (espaços são ignorados). */
  codigo: string;
}

/**
 * `POST /me/duas-etapas/iniciar` `{ senhaAtual }` → 200. Gera um segredo pendente; só vale depois
 * de `POST /me/duas-etapas/ativar` `{ codigo }` (204). 403 com senha errada; 409 se já estiver ativa.
 * `POST /me/duas-etapas/desativar` `{ senhaAtual, codigo }` → 204; 403 com senha ou código errado.
 */
export interface InicioDuasEtapas {
  /** Segredo em base32, para digitar no app quando não der para ler o QR. */
  segredo: string;
  /** `otpauth://totp/...`, o conteúdo do QR code. */
  uri: string;
}

/** `GET /me` → 200 */
export interface MeResposta {
  usuario: UsuarioConta;
  empresas: EmpresaDaSessao[];
  empresaAtiva: string | null;
  /** Verificação em duas etapas ativa (opcional, cada usuário liga no próprio perfil). */
  duasEtapas: boolean;
}

/** `PATCH /me` → 200 `{ usuario }`; 403 se `senhaAtual` estiver errada. */
export interface MePatch {
  nome?: string;
  sobrenome?: string;
  senhaAtual?: string;
  novaSenha?: string;
}

export interface MembroResumo {
  id: string;
  email: string;
  nome: string;
  sobrenome: string;
  papel: Papel;
  desde: string;
  /** false enquanto o membro não criou a senha. */
  temSenha: boolean;
}

export interface ConviteResumo {
  id: string;
  email: string;
  papel: Papel;
  expiraEm: string;
  criadoEm: string;
}

/** `GET /empresas/atual/usuarios` (admin) → 200 */
export interface UsuariosResposta {
  membros: MembroResumo[];
  convites: ConviteResumo[];
}

/** `POST /empresas/atual/convites` (admin) → 201. 409 se o e-mail já for membro. */
export interface ConviteCriado {
  convite: ConviteResumo;
  /** Link de aceite; o admin pode copiar se o e-mail não chegar. */
  link: string;
  emailEnviado: boolean;
  /** Só quando `emailEnviado` é false: por que o e-mail não saiu (sem segredos). */
  motivoEmail?: string;
}

/** `GET /convites/:token` (público) → 200; 404 se usado, vencido ou inexistente. */
export interface ConvitePublico {
  empresa: string;
  email: string;
  papel: Papel;
  /** O e-mail já tem conta com senha: o aceite pede essa senha. */
  jaTemSenha: boolean;
}
