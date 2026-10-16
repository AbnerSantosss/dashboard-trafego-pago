import Link from 'next/link';
import { lerContaSidebar, Sidebar } from '@/componentes/Sidebar';
import { api } from '@/lib/api';
import { Abas, SubInstalacao } from './Abas';
import './configuracoes.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configurações' };

/**
 * Casca das Configurações. Diferente do painel (tela fixa de 1315×710, comparada pixel a pixel),
 * aqui o layout é fluido: a sidebar fica numa coluna fixa ao rolar e, em telas estreitas, dá lugar
 * a uma barra no topo com o logo e o caminho de volta ao painel.
 */
export default async function LayoutConfiguracoes({ children }: { children: React.ReactNode }) {
  const [r, conta] = await Promise.all([api().apresentacao(), lerContaSidebar()]);
  const a = r.ok ? r.dados : null;
  // Sem logo enviado nem padrão: null faz a sidebar mostrar o nome em texto.
  const logo = a ? (a.logoUrl ?? a.logoPadraoUrl) : undefined;
  const nome = a?.nomeExibicao || 'Painel';
  return (
    <div className="cfg-tela">
      <div className="cfg-lateral">
        <Sidebar
          ativo="configuracoes"
          conta={conta}
          {...(logo !== undefined ? { logoUrl: logo } : {})}
          {...(a?.nomeExibicao ? { nomeEmpresa: a.nomeExibicao } : {})}
        />
      </div>
      <header className="cfg-barra">
        {logo ? (
          <img className="cfg-barra-logo" src={logo} alt={nome} />
        ) : (
          <span className="cfg-barra-nome">{nome}</span>
        )}
        <Link className="cfg-barra-voltar" href="/">
          Voltar ao painel
        </Link>
      </header>
      <main className="cfg-principal">
        <h1 className="cfg-titulo">Configurações</h1>
        <Abas />
        <SubInstalacao />
        <section className="cfg-conteudo">{children}</section>
      </main>
    </div>
  );
}
