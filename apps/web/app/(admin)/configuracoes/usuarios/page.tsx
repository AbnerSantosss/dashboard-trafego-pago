import { api } from '@/lib/api';
import { mensagemErroApi } from '../validacao';
import { PainelUsuarios } from './PainelUsuarios';

export const dynamic = 'force-dynamic';

export default async function Usuarios() {
  const [r, me] = await Promise.all([api().usuarios(), api().me()]);
  if (!r.ok) {
    return (
      <p className="cfg-faixa-erro" role="alert">
        {r.status === 403
          ? mensagemErroApi(r)
          : `Não foi possível carregar os usuários. ${r.mensagem}`}
      </p>
    );
  }
  return <PainelUsuarios {...r.dados} euId={me.ok ? me.dados.usuario.id : ''} />;
}
