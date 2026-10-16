'use server';
/**
 * Server actions das telas públicas de conta. O token devolvido pela API vai direto para o cookie
 * httpOnly `sessao`; o navegador não o vê.
 */
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { apagarSessao, gravarSessao } from '@/lib/sessao';
import type { EstadoAcao } from '../(admin)/configuracoes/validacao';

const SENHA_MINIMA = 8;

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === 'string' ? v : '';
}

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
  await gravarSessao(r.dados.token, r.dados.empresas[0]?.slug);
  redirect('/');
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
  await gravarSessao(r.dados.token, r.dados.empresas[0]?.slug);
  redirect('/');
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
  const token = texto(fd, 'token');
  const empresa = r.dados.empresas.find((e) => token.startsWith(`${e.id}.`)) ?? r.dados.empresas[0];
  await gravarSessao(r.dados.token, empresa?.slug);
  redirect('/');
}

export async function sair(): Promise<void> {
  await apagarSessao();
  redirect('/login');
}
