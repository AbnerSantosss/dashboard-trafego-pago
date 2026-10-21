'use server';
/**
 * Server actions das telas públicas de conta. O token devolvido pela API vai direto para o cookie
 * httpOnly `sessao`; o navegador não o vê. Com a verificação em duas etapas ativa, a API devolve um
 * desafio no lugar da sessão: ele vai para o cookie httpOnly `duas_etapas` (nunca para a URL) e a
 * tela /login/codigo pede o código do app.
 */
import { pedeSegundoFator, type RespostaEntrada, type Sessao } from '@trafego/contratos';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import {
  apagarDesafio,
  apagarSessao,
  gravarDesafio,
  gravarSessao,
  lerDesafio,
  lerSessaoDoCookie,
} from '@/lib/sessao';
import type { EstadoAcao } from '../(admin)/configuracoes/validacao';

const SENHA_MINIMA = 8;
/** Server actions só exportam funções assíncronas: a mensagem fica local. */
const MSG_VERIFICACAO_EXPIRADA = 'A verificação expirou. Entre de novo.';

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === 'string' ? v : '';
}

/**
 * Senha conferida: abre a sessão (na empresa dada ou na primeira) ou, se a conta pede a segunda
 * etapa, guarda o desafio e manda para a tela do código. Nos dois casos termina em `redirect`.
 */
async function concluirEntrada(
  r: RespostaEntrada,
  escolherEmpresa: (s: Sessao) => string | undefined,
  empresaDoConvite?: string,
): Promise<never> {
  if (pedeSegundoFator(r)) {
    await gravarDesafio({
      desafio: r.desafio,
      ...(empresaDoConvite ? { empresa: empresaDoConvite } : {}),
    });
    redirect('/login/codigo');
  } else {
    await gravarSessao(r.token, escolherEmpresa(r));
    redirect('/');
  }
}

const primeiraEmpresa = (s: Sessao) => s.empresas[0]?.slug;

function conferirSenha(senha: string, confirmacao: string): string | null {
  if (senha.length < SENHA_MINIMA)
    return `A senha precisa ter no mínimo ${SENHA_MINIMA} caracteres.`;
  if (senha !== confirmacao) return 'As duas senhas não são iguais.';
  return null;
}

export async function entrar(_a: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const r = await api().entrar(
    texto(fd, 'email').trim(),
    texto(fd, 'senha'),
    fd.get('lembrar') === 'on',
  );
  if (!r.ok) {
    return {
      ok: false,
      mensagem: r.status === 401 ? 'E-mail ou senha incorretos.' : r.mensagem,
    };
  }
  return concluirEntrada(r.dados, primeiraEmpresa);
}

export async function recuperar(_a: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const email = texto(fd, 'email').trim();
  if (!email) return { ok: false, mensagem: 'Informe o e-mail.' };
  const r = await api().recuperar(email);
  if (!r.ok && r.status !== 429) return { ok: false, mensagem: r.mensagem };
  return {
    ok: true,
    mensagem: 'Se o e-mail estiver cadastrado, enviamos um link para criar uma nova senha.',
  };
}

export async function redefinir(_a: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const senha = texto(fd, 'senha');
  const erro = conferirSenha(senha, texto(fd, 'confirmacao'));
  if (erro) return { ok: false, mensagem: erro };
  const r = await api().redefinir(texto(fd, 'token'), senha);
  if (!r.ok) {
    return {
      ok: false,
      mensagem: r.status === 401 ? 'Este link já foi usado ou venceu. Peça um novo.' : r.mensagem,
    };
  }
  return concluirEntrada(r.dados, primeiraEmpresa);
}

export async function aceitarConvite(_a: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const senha = texto(fd, 'senha');
  const jaTemSenha = texto(fd, 'jaTemSenha') === '1';
  const erro = jaTemSenha ? null : conferirSenha(senha, texto(fd, 'confirmacao'));
  if (erro) return { ok: false, mensagem: erro };
  const nome = texto(fd, 'nome').trim();
  if (!nome) return { ok: false, mensagem: 'Informe o nome.' };
  const r = await api().aceitarConvite(texto(fd, 'token'), {
    nome,
    sobrenome: texto(fd, 'sobrenome').trim(),
    senha,
  });
  if (!r.ok) {
    return {
      ok: false,
      mensagem:
        r.status === 404
          ? 'Convite já usado ou vencido. Peça um novo ao administrador.'
          : r.status === 401
            ? 'Senha incorreta para esta conta.'
            : r.mensagem,
    };
  }
  // O token do convite começa pelo id da empresa (`<empresaId>.<aleatório>`): a sessão abre nela.
  const token = texto(fd, 'token');
  const ponto = token.indexOf('.');
  const empresaId = ponto > 0 ? token.slice(0, ponto) : undefined;
  return concluirEntrada(r.dados, (s) => empresaDaSessao(s, empresaId), empresaId);
}

function empresaDaSessao(s: Sessao, empresaId: string | undefined): string | undefined {
  return (s.empresas.find((e) => e.id === empresaId) ?? s.empresas[0])?.slug;
}

/**
 * Segunda etapa: troca o desafio do cookie e o código do app pela sessão. Código errado mantém o
 * desafio para tentar de novo (a API bloqueia no excesso, 429); desafio vencido ou ausente pede
 * para entrar de novo.
 */
export async function confirmarCodigo(_a: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const pendente = await lerDesafio();
  if (!pendente) return { ok: false, mensagem: MSG_VERIFICACAO_EXPIRADA, expirou: true };
  const codigo = texto(fd, 'codigo').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(codigo)) {
    return { ok: false, mensagem: 'Digite os 6 dígitos do código.' };
  }
  const r = await api().confirmarDuasEtapas(pendente.desafio, codigo);
  if (!r.ok) {
    if (r.status === 401 && r.codigo === 'token_invalido') {
      await apagarDesafio();
      return { ok: false, mensagem: MSG_VERIFICACAO_EXPIRADA, expirou: true };
    }
    if (r.status === 401) return { ok: false, mensagem: 'Código incorreto.' };
    return { ok: false, mensagem: r.mensagem };
  }
  await apagarDesafio();
  await gravarSessao(r.dados.token, empresaDaSessao(r.dados, pendente.empresa));
  redirect('/');
}

/**
 * Invalida o token na API antes de apagar os cookies, para que uma cópia dele não siga valendo. Se
 * a API falhar ou estiver fora, apaga os cookies e sai do mesmo jeito: nunca prende o usuário.
 */
export async function sair(): Promise<void> {
  const { token } = await lerSessaoDoCookie();
  if (token) {
    try {
      await api().sair(token);
    } catch {
      // o cliente já devolve a falha sem lançar; isto só cobre o imprevisto
    }
  }
  await apagarSessao();
  redirect('/login');
}
