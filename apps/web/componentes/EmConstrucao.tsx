import { Sidebar } from './Sidebar';
import { Nos } from './Nos';
import { montarCabecalho } from '@/lib/tela';

/** Casca das seções ainda não implementadas (P4.7): sidebar, título e aviso discreto. */
export function EmConstrucao({ ativo, titulo }: { ativo: string; titulo: string }) {
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
      <Sidebar ativo={ativo} />
      <div className="divisor" />
      <main className="principal">
        <h1 className="so-leitor">{titulo}</h1>
        <Nos nos={nos} />
      </main>
    </div>
  );
}
