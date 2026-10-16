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

/** `POST /auth/login`, `POST /auth/redefinir`, `POST /convites/:token/aceitar` → 200 */
export interface Sessao {
  /** JWT de 12 h. */
  token: string;
  usuario: UsuarioConta;
  empresas: EmpresaDaSessao[];
}

/** `GET /me` → 200 */
export interface MeResposta {
  usuario: UsuarioConta;
  empresas: EmpresaDaSessao[];
  empresaAtiva: string | null;
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
}

/** `GET /convites/:token` (público) → 200; 404 se usado, vencido ou inexistente. */
export interface ConvitePublico {
  empresa: string;
  email: string;
  papel: Papel;
  /** O e-mail já tem conta com senha: o aceite pede essa senha. */
  jaTemSenha: boolean;
}
