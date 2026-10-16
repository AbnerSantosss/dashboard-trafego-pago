import Link from 'next/link';
import { FormRedefinir } from '../Formularios';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nova senha' };

export default async function Redefinir({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="conta-titulo">Nova senha</h1>
      {token ? (
        <>
          <p className="conta-sub">O link vale por 1 hora e só pode ser usado uma vez.</p>
          <FormRedefinir token={token} />
        </>
      ) : (
        <p className="cfg-erro">
          Link incompleto. <Link href="/login">Peça um novo</Link>.
        </p>
      )}
    </>
  );
}
