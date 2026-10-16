import { Painel } from '@/componentes/Painel';
import { lerContaSidebar, PularParaConteudo, Sidebar } from '@/componentes/Sidebar';
import { api } from '@/lib/api';
import { lerFiltros, paraQueryApi } from '@/lib/regras';

export const dynamic = 'force-dynamic';

type Busca = Promise<Record<string, string | string[] | undefined>>;

/** Visão Geral: busca no servidor (sem cache) e entrega os dados crus ao painel cliente. */
export default async function VisaoGeral({ searchParams }: { searchParams: Busca }) {
  const filtros = lerFiltros(await searchParams);
  const [r, conta] = await Promise.all([
    api().visaoGeral(paraQueryApi(filtros)),
    lerContaSidebar(),
  ]);
  const dados = r.ok ? r.dados : null;
  return (
    <div className="tela">
      <PularParaConteudo />
      <Sidebar
        ativo="visao-geral"
        conta={conta}
        {...(dados?.apresentacao.logoUrl ? { logoUrl: dados.apresentacao.logoUrl } : {})}
        {...(dados?.apresentacao.nomeExibicao
          ? { nomeEmpresa: dados.apresentacao.nomeExibicao }
          : {})}
      />
      <div className="divisor" />
      <Painel dados={dados} erro={r.ok ? null : r.mensagem} filtros={filtros} />
      <div className="faixa-topo" aria-hidden="true" />
      <div className="faixa-direita" aria-hidden="true" />
    </div>
  );
}
