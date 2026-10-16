import { api } from '@/lib/api';
import { mensagemErroApi } from '../validacao';
import { FormApresentacao } from './FormApresentacao';

export const dynamic = 'force-dynamic';

export default async function Apresentacao() {
  const r = await api().apresentacao();
  if (!r.ok) {
    return (
      <p className="cfg-faixa-erro" role="alert">
        Não foi possível carregar a apresentação agora.{' '}
        {r.status === 403 || r.codigo === 'acesso_negado' ? mensagemErroApi(r) : r.mensagem}
      </p>
    );
  }
  return <FormApresentacao atual={r.dados} />;
}
