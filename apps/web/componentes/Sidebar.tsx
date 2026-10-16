import { referencia } from '@trafego/fixtures';
import type { UsuarioConta } from '@trafego/contratos';
import Link from 'next/link';
import { sair } from '@/app/(conta)/acoes';
import { api } from '@/lib/api';
import { ID_CONTEUDO, ITEM_CONFIGURACOES, montarSidebar, NAV_Y } from '@/lib/tela';
import { Icone, Nos } from './Nos';

export const ROTAS: Record<string, string> = {
  'visao-geral': '/',
  'gestao-custos': '/gestao-de-custos',
  relatorios: '/relatorios',
  configuracoes: '/configuracoes',
};

/**
 * Link "Pular para o conteúdo": primeiro item focável da tela, fora da área visível até receber
 * foco (classe .pular-link em tela.css), então não aparece na captura comparada com a referência.
 */
export function PularParaConteudo({ alvo = ID_CONTEUDO }: { alvo?: string }) {
  return (
    <a className="pular-link" href={`#${alvo}`}>
      Pular para o conteúdo
    </a>
  );
}

export type ContaSidebar = Pick<UsuarioConta, 'nome' | 'sobrenome' | 'email'> | null;

/** Usuário da sessão para o rodapé da sidebar; sem sessão (ou no modo mock) volta null. */
export async function lerContaSidebar(): Promise<ContaSidebar> {
  try {
    const r = await api().me();
    return r.ok ? r.dados.usuario : null;
  } catch {
    return null;
  }
}

const iniciais = (c: NonNullable<ContaSidebar>) =>
  `${c.nome.trim()[0] ?? ''}${c.sobrenome.trim()[0] ?? ''}`.toUpperCase() ||
  (c.email[0] ?? '?').toUpperCase();

/**
 * Conta no rodapé: avatar com as iniciais e nome (link para o Perfil) e o botão Sair (apaga a
 * sessão e vai ao login). Fica colada ao fim da sidebar, qualquer que seja a altura da moldura.
 * Sem sessão, o mesmo lugar vira o atalho para entrar.
 */
function RodapeConta({ conta }: { conta: ContaSidebar }) {
  if (!conta) {
    return (
      <Link href="/login" className="sb-conta sb-conta-entrar">
        <span className="sb-avatar" aria-hidden="true">
          <Icone nome="usuario" className="sb-avatar-ic" />
        </span>
        <span className="sb-conta-nome">Entrar</span>
      </Link>
    );
  }
  const nome = `${conta.nome} ${conta.sobrenome}`.trim() || conta.email;
  return (
    <div className="sb-conta">
      {/* Avatar e nome levam ao Perfil; o Sair fica fora do link, como ação própria. */}
      <Link
        href="/configuracoes/perfil"
        className="sb-conta-link"
        title={`${nome}: abrir o perfil`}
      >
        <span className="sb-avatar" aria-hidden="true">
          {iniciais(conta)}
        </span>
        <span className="sb-conta-texto">
          <span className="sb-conta-nome">{nome}</span>
          <span className="sb-conta-email">{conta.email}</span>
        </span>
      </Link>
      <form action={sair}>
        <button type="submit" className="sb-sair" title="Sair">
          <Icone nome="sair" className="sb-sair-ic" />
          <span className="so-leitor">Sair da plataforma</span>
        </button>
      </form>
    </div>
  );
}

/** Sidebar de 180 px: logo, menu (com Configurações logo abaixo de Relatórios) e a conta no rodapé. */
export function Sidebar({
  ativo,
  logoUrl = '/brand/pasio-logo.png',
  nomeEmpresa = referencia.empresa,
  conta = null,
}: {
  ativo: string;
  /** Usuário da sessão (lerContaSidebar); null mostra o atalho Entrar. */
  conta?: ContaSidebar;
  /** `null` = sem logo nem padrão: mostra o nome exibido em texto na mesma caixa. */
  logoUrl?: string | null;
  nomeEmpresa?: string;
}) {
  return (
    <aside className="sidebar" aria-label="Menu principal">
      {logoUrl === null ? (
        <span
          className="logo-texto"
          title={nomeEmpresa}
          style={{
            left: 16,
            top: 26,
            height: 36,
            maxWidth: 148,
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {nomeEmpresa}
        </span>
      ) : (
        <img className="logo logo-pasio" src={logoUrl} alt={nomeEmpresa} />
      )}
      <Nos nos={montarSidebar(referencia.menu, ativo)} />
      <nav aria-label="Seções">
        {[...referencia.menu.filter((m) => m.posicao === 'topo'), ITEM_CONFIGURACOES].map((m) => (
          <Link
            key={m.id}
            href={ROTAS[m.id] ?? '/'}
            className="alvo nav-link"
            style={{ left: 8, top: (NAV_Y[m.id] ?? 0) - 20, width: 160, height: 40 }}
            aria-current={m.id === ativo ? 'page' : undefined}
          >
            <span className="so-leitor">{m.rotulo}</span>
          </Link>
        ))}
      </nav>
      <RodapeConta conta={conta} />
    </aside>
  );
}
