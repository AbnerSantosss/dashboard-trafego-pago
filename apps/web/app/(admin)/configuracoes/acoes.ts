'use server';
/**
 * Server actions das Configurações. Rodam só no servidor do Next: o navegador nunca fala com a
 * API nem vê o token. O segredo de webhook volta apenas no estado desta resposta (não é logado,
 * não vai para URL nem para armazenamento persistente).
 */
import type { ApresentacaoPatch, MePatch, Papel } from '@trafego/contratos';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { gravarSessao, lerSessaoDoCookie } from '@/lib/sessao';
import {
  MSG_SUCESSO_APRESENTACAO,
  formatarReais,
  lerValorReais,
  mensagemErroApi,
  normalizarContaMeta,
  tipoDoLogo,
  validarLogo,
  validarNome,
  validarSlug,
  type EstadoAcao,
} from './validacao';

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === 'string' ? v : '';
}

/** Salva nome exibido e/ou logo. Campo `remover=1` envia `logo: null`. */
export async function salvarApresentacao(_anterior: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const nome = texto(fd, 'nomeExibicao').trim();
  const erroNome = validarNome(nome);
  if (erroNome) return { ok: false, mensagem: erroNome };
  const corpo: ApresentacaoPatch = { nomeExibicao: nome };

  if (texto(fd, 'remover') === '1') {
    corpo.logo = null;
  } else {
    const arquivo = fd.get('logo');
    if (arquivo instanceof File && arquivo.size > 0) {
      const erro = validarLogo(arquivo);
      const tipo = tipoDoLogo(arquivo);
      if (erro || !tipo) return { ok: false, mensagem: erro ?? 'Arquivo inválido.' };
      const base64 = Buffer.from(await arquivo.arrayBuffer()).toString('base64');
      corpo.logo = { tipo, base64 };
    }
  }

  const r = await api().salvarApresentacao(corpo);
  if (!r.ok) return { ok: false, mensagem: mensagemErroApi(r) };
  // 'layout' atualiza também a sidebar das Configurações, que lê o logo e o nome.
  revalidatePath('/', 'layout');
  return { ok: true, mensagem: MSG_SUCESSO_APRESENTACAO };
}

/**
 * Ação única da tela de webhooks, escolhida por `intencao`:
 * `criar` (slug + nome), `rotacionar` (id) ou `alternar` (id + ativo atual).
 */
export async function acaoWebhook(_anterior: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const intencao = texto(fd, 'intencao');
  const id = texto(fd, 'id');

  if (intencao === 'criar') {
    const slug = texto(fd, 'slug').trim();
    const nome = texto(fd, 'nome').trim();
    const erro = validarSlug(slug) ?? (nome ? null : 'Informe o nome da fonte.');
    if (erro) return { ok: false, mensagem: erro };
    const r = await api().criarFonte({ slug, nome });
    if (!r.ok) return { ok: false, mensagem: mensagemErroApi(r) };
    revalidatePath('/configuracoes/webhooks');
    return {
      ok: true,
      mensagem: `Fonte "${r.dados.fonte.nome}" criada.`,
      segredo: r.dados.segredo,
      slug: r.dados.fonte.slug,
    };
  }

  if (!id) return { ok: false, mensagem: 'Fonte não informada.' };

  if (intencao === 'rotacionar') {
    const r = await api().rotacionarSegredo(id);
    if (!r.ok) return { ok: false, mensagem: mensagemErroApi(r) };
    revalidatePath('/configuracoes/webhooks');
    return {
      ok: true,
      mensagem: `Segredo de "${r.dados.fonte.nome}" rotacionado.`,
      segredo: r.dados.segredo,
      slug: r.dados.fonte.slug,
    };
  }

  if (intencao === 'alternar') {
    const ativo = texto(fd, 'ativo') !== '1';
    const r = await api().atualizarFonte(id, { ativo });
    if (!r.ok) return { ok: false, mensagem: mensagemErroApi(r) };
    revalidatePath('/configuracoes/webhooks');
    return {
      ok: true,
      mensagem: `Fonte "${r.dados.nome}" ${r.dados.ativo ? 'ativada' : 'desativada'}.`,
    };
  }

  return { ok: false, mensagem: 'Ação desconhecida.' };
}

/** Perfil: nome e sobrenome; troca a senha só se `novaSenha` vier preenchida. */
export async function salvarPerfil(_anterior: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const nome = texto(fd, 'nome').trim();
  if (!nome) return { ok: false, mensagem: 'Informe o nome.' };
  const corpo: MePatch = { nome, sobrenome: texto(fd, 'sobrenome').trim() };
  const novaSenha = texto(fd, 'novaSenha');
  if (novaSenha) {
    if (novaSenha.length < 8)
      return { ok: false, mensagem: 'A nova senha precisa de 8 caracteres.' };
    if (novaSenha !== texto(fd, 'confirmacao'))
      return { ok: false, mensagem: 'As duas senhas não são iguais.' };
    corpo.novaSenha = novaSenha;
    corpo.senhaAtual = texto(fd, 'senhaAtual');
  }
  const r = await api().atualizarMe(corpo);
  if (!r.ok) {
    return {
      ok: false,
      mensagem:
        r.status === 403
          ? 'A senha atual está incorreta.'
          : `Não foi possível salvar. ${r.mensagem}`,
    };
  }
  // A troca de senha encerra as outras sessões; esta segue com o token novo.
  if (r.dados.token) await gravarSessao(r.dados.token, (await lerSessaoDoCookie()).empresa);
  revalidatePath('/configuracoes/perfil');
  return { ok: true, mensagem: novaSenha ? 'Perfil e senha salvos.' : 'Perfil salvo.' };
}

const PAPEIS: readonly Papel[] = ['admin', 'analista', 'leitor'];
const papelDe = (v: string): Papel =>
  (PAPEIS as readonly string[]).includes(v) ? (v as Papel) : 'leitor';

/** Usuários (admin): `convidar` (email, papel), `cancelar` (id), `papel` (id, papel), `remover` (id). */
export async function acaoUsuarios(_anterior: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const intencao = texto(fd, 'intencao');
  const id = texto(fd, 'id');
  const falha = (r: { mensagem: string; codigo?: string; status?: number }): EstadoAcao => ({
    ok: false,
    mensagem:
      r.status === 409
        ? 'Este e-mail já faz parte da empresa.'
        : r.mensagem.includes('próprio acesso')
          ? 'Você não pode mudar o próprio acesso.'
          : mensagemErroApi(r),
  });

  if (intencao === 'convidar') {
    const email = texto(fd, 'email').trim();
    if (!email) return { ok: false, mensagem: 'Informe o e-mail.' };
    const r = await api().convidar(email, papelDe(texto(fd, 'papel')));
    if (!r.ok) return falha(r);
    revalidatePath('/configuracoes/usuarios');
    return {
      ok: true,
      mensagem: r.dados.emailEnviado
        ? `Convite enviado para ${r.dados.convite.email}.`
        : `Convite criado, mas o e-mail não foi enviado. Mande o link abaixo para ${r.dados.convite.email}.`,
      link: r.dados.link,
      emailEnviado: r.dados.emailEnviado,
    };
  }
  if (!id) return { ok: false, mensagem: 'Item não informado.' };
  const r =
    intencao === 'cancelar'
      ? await api().cancelarConvite(id)
      : intencao === 'papel'
        ? await api().mudarPapel(id, papelDe(texto(fd, 'papel')))
        : intencao === 'remover'
          ? await api().removerMembro(id)
          : null;
  if (!r) return { ok: false, mensagem: 'Ação desconhecida.' };
  if (!r.ok) return falha(r);
  revalidatePath('/configuracoes/usuarios');
  const feito = {
    cancelar: 'Convite cancelado.',
    papel: 'Papel alterado.',
    remover: 'Membro removido.',
  };
  return { ok: true, mensagem: feito[intencao as keyof typeof feito] };
}

/** Gastos (analista ou acima): `lancar` (dia, canal, campanha, valor, descricao) ou `remover` (id). */
export async function acaoGastos(_anterior: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const intencao = texto(fd, 'intencao');
  if (intencao === 'lancar') {
    const dia = texto(fd, 'dia');
    const canal = texto(fd, 'canal').trim();
    const valor = lerValorReais(texto(fd, 'valor'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { ok: false, mensagem: 'Informe a data.' };
    if (!canal) return { ok: false, mensagem: 'Informe o canal.' };
    if (valor === null)
      return { ok: false, mensagem: 'Informe um valor maior que zero, como 150,00.' };
    const campanha = texto(fd, 'campanha').trim();
    const descricao = texto(fd, 'descricao').trim();
    const r = await api().lancarCusto({
      dia,
      canal,
      valor,
      ...(campanha ? { campanha } : {}),
      ...(descricao ? { descricao } : {}),
    });
    if (!r.ok) return { ok: false, mensagem: mensagemErroApi(r) };
    revalidatePath('/configuracoes/gastos');
    return { ok: true, mensagem: `Gasto de ${formatarReais(valor)} lançado em ${canal}.` };
  }
  if (intencao === 'remover') {
    const id = texto(fd, 'id');
    if (!id) return { ok: false, mensagem: 'Gasto não informado.' };
    const r = await api().removerCusto(id);
    if (!r.ok) return { ok: false, mensagem: mensagemErroApi(r) };
    revalidatePath('/configuracoes/gastos');
    return { ok: true, mensagem: 'Gasto removido.' };
  }
  return { ok: false, mensagem: 'Ação desconhecida.' };
}

/**
 * Meta Ads (admin): `conectar` (contaId, token), `sincronizar` (id), `alternar` (id + ativo atual),
 * `token` (id, token) ou `remover` (id). O token só passa por aqui a caminho da API; não volta no estado.
 */
export async function acaoMeta(_anterior: EstadoAcao, fd: FormData): Promise<EstadoAcao> {
  const intencao = texto(fd, 'intencao');
  const id = texto(fd, 'id');
  const token = texto(fd, 'token').trim();
  const pronto = (mensagem: string): EstadoAcao => {
    revalidatePath('/configuracoes/meta-ads');
    revalidatePath('/configuracoes/gastos');
    return { ok: true, mensagem };
  };

  if (intencao === 'conectar') {
    const contaId = normalizarContaMeta(texto(fd, 'contaId'));
    if (!contaId)
      return { ok: false, mensagem: 'ID da conta inválido. Use act_ seguido dos números.' };
    if (token.length < 20) return { ok: false, mensagem: 'Cole o token de acesso completo.' };
    const r = await api().conectarMeta({ contaId, token });
    if (!r.ok) return { ok: false, mensagem: mensagemErroApi(r) };
    const s = r.dados.sincronizacao;
    const nome = r.dados.conta.nome || contaId;
    return pronto(
      s.ok
        ? `Conta "${nome}" conectada. ${formatarReais(s.total)} de gasto lido dos últimos 30 dias.`
        : `Conta "${nome}" conectada, mas a leitura do gasto falhou: ${s.mensagem}`,
    );
  }
  if (!id) return { ok: false, mensagem: 'Conta não informada.' };

  if (intencao === 'sincronizar') {
    const r = await api().sincronizarMeta(id, 30);
    if (!r.ok) return { ok: false, mensagem: mensagemErroApi(r) };
    if (!r.dados.ok) {
      revalidatePath('/configuracoes/meta-ads');
      return { ok: false, mensagem: r.dados.mensagem };
    }
    return pronto(`Sincronizado: ${formatarReais(r.dados.total)} nos últimos 30 dias.`);
  }
  if (intencao === 'alternar') {
    const r = await api().atualizarMeta(id, { ativo: texto(fd, 'ativo') !== '1' });
    if (!r.ok) return { ok: false, mensagem: mensagemErroApi(r) };
    return pronto(
      r.dados.ativo ? 'Sincronização automática ligada.' : 'Sincronização automática pausada.',
    );
  }
  if (intencao === 'token') {
    if (token.length < 20) return { ok: false, mensagem: 'Cole o token de acesso completo.' };
    const r = await api().atualizarMeta(id, { token });
    if (!r.ok) return { ok: false, mensagem: mensagemErroApi(r) };
    return pronto('Token trocado. Clique em Sincronizar para ler o gasto agora.');
  }
  if (intencao === 'remover') {
    const r = await api().removerMeta(id);
    if (!r.ok) return { ok: false, mensagem: mensagemErroApi(r) };
    return pronto('Conta desconectada e gasto dela removido do painel.');
  }
  return { ok: false, mensagem: 'Ação desconhecida.' };
}
