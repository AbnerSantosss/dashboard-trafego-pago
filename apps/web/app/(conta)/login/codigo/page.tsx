import Link from 'next/link';
import { lerDesafio } from '@/lib/sessao';
import { FormCodigo } from '../../Formularios';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verificação em duas etapas' };

/**
 * Segunda etapa do login (conta com verificação em duas etapas ativa). Só abre com o desafio no
 * cookie `duas_etapas`, que o login, a redefinição de senha e o aceite de convite gravam.
 */
export default async function Codigo() {
  const pendente = await lerDesafio();
  return (
    <>
      <h1 className="conta-titulo">Verificação em duas etapas</h1>
      {pendente ? (
        <>
          <p className="conta-sub">Digite o código de 6 dígitos do seu app autenticador.</p>
          <FormCodigo />
        </>
      ) : (
        <p className="cfg-erro" role="status">
          A verificação expirou. <Link href="/login">Entre de novo</Link>.
        </p>
      )}
    </>
  );
}
