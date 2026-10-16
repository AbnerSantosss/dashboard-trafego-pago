import { api } from '@/lib/api';
import { ID_CONTEUDO, montarCabecalho } from '@/lib/tela';
import { FundoOndas } from './FundoOndas';
import { Nos } from './Nos';
import { lerContaSidebar, PularParaConteudo, Sidebar } from './Sidebar';

/**
 * Logo e nome exibido da empresa para a sidebar, lidos de Configurações → Apresentação. Se a leitura
 * falhar, devolve vazio e a Sidebar usa o padrão (logo PASIO e nome da referência).
 */
export async function lerMarcaSidebar(): Promise<{
  logoUrl?: string | null;
  nomeEmpresa?: string;
}> {
  try {
    const r = await api().apresentacao();
    if (!r.ok) return {};
    const a = r.dados;
    // Sem logo enviado nem padrão: null faz a sidebar mostrar o nome em texto.
    return {
      logoUrl: a.logoUrl ?? a.logoPadraoUrl,
      ...(a.nomeExibicao ? { nomeEmpresa: a.nomeExibicao } : {}),
    };
  } catch {
    return {};
  }
}

/** Casca das seções ainda não implementadas (P4.7): sidebar, título, aviso discreto e fundo de ondas. */
export async function EmConstrucao({ ativo, titulo }: { ativo: string; titulo: string }) {
  const [marca, conta] = await Promise.all([lerMarcaSidebar(), lerContaSidebar()]);
  const nos = montarCabecalho(
    {
      titulo,
      subtitulo: 'Esta seção está em construção.',
      atualizadoRotulo: '',
      atualizadoValor: '',
      exportar: '',
    },
    false,
  );
  return (
    <div className="tela">
      <PularParaConteudo alvo={ID_CONTEUDO} />
      <Sidebar ativo={ativo} conta={conta} {...marca} />
      <div className="divisor" />
      <main id={ID_CONTEUDO} tabIndex={-1} className="principal">
        <FundoOndas />
        <h1 className="so-leitor">{titulo}</h1>
        <Nos nos={nos} />
      </main>
    </div>
  );
}
