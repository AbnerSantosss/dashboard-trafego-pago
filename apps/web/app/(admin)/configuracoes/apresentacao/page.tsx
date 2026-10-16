import { api } from '@/lib/api';
import { mensagemErroApi } from '../validacao';
import { FormApresentacao } from './FormApresentacao';

export const dynamic = 'force-dynamic';

const TITULO = <h2 className="cfg-subtitulo cfg-sem-margem">Nome e logo da empresa</h2>;

export default async function Apresentacao() {
  const r = await api().apresentacao();
  if (!r.ok) {
    return (
      <>
        {TITULO}
        <p className="cfg-faixa-erro" role="alert">
          Não foi possível carregar a apresentação agora.{' '}
          {r.status === 403 || r.codigo === 'acesso_negado' ? mensagemErroApi(r) : r.mensagem}
        </p>
      </>
    );
  }
  return (
    <>
      {TITULO}
      <FormApresentacao atual={r.dados} />
    </>
  );
}
