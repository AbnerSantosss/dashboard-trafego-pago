import { Sidebar } from '@/componentes/Sidebar';
import { api } from '@/lib/api';
import { Abas } from './Abas';
import './configuracoes.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configurações' };

/** Casca das Configurações: sidebar (sem item ativo) e área de conteúdo com abas. */
export default async function LayoutConfiguracoes({ children }: { children: React.ReactNode }) {
  const r = await api().apresentacao();
  const a = r.ok ? r.dados : null;
  // Sem logo enviado nem padrão: null faz a sidebar mostrar o nome em texto.
  const logo = a ? (a.logoUrl ?? a.logoPadraoUrl) : undefined;
  return (
    <div className="tela">
      <Sidebar
        ativo=""
        {...(logo !== undefined ? { logoUrl: logo } : {})}
        {...(a?.nomeExibicao ? { nomeEmpresa: a.nomeExibicao } : {})}
      />
      <div className="divisor" />
      <main className="cfg-principal">
        <h1 className="cfg-titulo">Configurações da empresa</h1>
        <Abas />
        <section className="cfg-conteudo">{children}</section>
      </main>
    </div>
  );
}
