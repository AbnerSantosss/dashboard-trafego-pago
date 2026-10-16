import { jaEntrouAntes } from '@/lib/sessao';
import { FormLogin } from '../Formularios';

export const metadata = { title: 'Entrar' };

/** Quem já entrou neste navegador (e saiu) é recebido de volta; o primeiro acesso pede o login. */
export default async function Login() {
  const voltou = await jaEntrouAntes();
  return (
    <>
      <h1 className="conta-titulo">{voltou ? 'Bem-vindo de volta' : 'Faça seu login'}</h1>
      <p className="conta-sub">
        {voltou
          ? 'Acesse sua conta para continuar no sistema.'
          : 'Entre com o e-mail e a senha que você criou pelo convite.'}
      </p>
      <FormLogin />
    </>
  );
}
