import { api } from '@/lib/api';
import { FormConvite } from '../Formularios';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Convite' };

export default async function Convite({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const r = token ? await api().convite(token) : null;
  return (
    <>
      <h1 className="conta-titulo">Convite para o painel</h1>
      {token && r?.ok ? (
        <FormConvite token={token} convite={r.dados} />
      ) : (
        <p className="cfg-erro" role="alert">
          {r && !r.ok && r.status !== 404
            ? r.mensagem
            : 'Convite já usado, vencido ou inexistente. Peça um novo ao administrador.'}
        </p>
      )}
    </>
  );
}
