import Link from 'next/link';
import { ROTULO_ETAPA } from '@/componentes/FichaLead';
import { lerMarcaSidebar } from '@/componentes/EmConstrucao';
import { lerContaSidebar, Sidebar } from '@/componentes/Sidebar';
import { api } from '@/lib/api';
import { consultaLeads, lerFiltrosLeads, mensagemLeads } from '@/lib/leads';
import { TelaLeads } from './TelaLeads';
import '../(admin)/configuracoes/configuracoes.css';
import '@/componentes/gaveta-funil.css';
import './leads.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leads' };

/**
 * Tela expandida da lista por etapa (aberta pelo botão Expandir da gaveta do funil e da tabela por
 * canal). Fluida como as Configurações; os filtros moram na URL, então o endereço pode ser
 * compartilhado e o voltar do navegador desfaz cada filtro.
 */
export default async function PaginaLeads({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filtros = lerFiltrosLeads(await searchParams);
  const [marca, lista, ficha, conta] = await Promise.all([
    lerMarcaSidebar(),
    api().eventosEtapa(consultaLeads(filtros)),
    filtros.lead ? api().lead(filtros.lead) : Promise.resolve(null),
    lerContaSidebar(),
  ]);
  const nome = marca.nomeEmpresa || 'Painel';
  return (
    <div className="cfg-tela">
      <div className="cfg-lateral">
        <Sidebar ativo="visao-geral" conta={conta} {...marca} />
      </div>
      <header className="cfg-barra">
        {marca.logoUrl ? (
          <img className="cfg-barra-logo" src={marca.logoUrl} alt={nome} />
        ) : (
          <span className="cfg-barra-nome">{nome}</span>
        )}
        <Link className="cfg-barra-voltar" href="/">
          Voltar ao painel
        </Link>
      </header>
      <main className="cfg-principal lp-principal">
        <Link className="lp-voltar" href="/">
          ← Visão geral
        </Link>
        <h1 className="cfg-titulo">Leads · {ROTULO_ETAPA[filtros.etapa]}</h1>
        <TelaLeads
          filtros={filtros}
          lista={lista.ok ? lista : { ok: false, mensagem: mensagemLeads(lista, 'a lista') }}
          ficha={
            ficha === null
              ? null
              : ficha.ok
                ? ficha
                : { ok: false, mensagem: mensagemLeads(ficha, 'a ficha') }
          }
        />
      </main>
    </div>
  );
}
