import { FormLogin } from '../Formularios';

export const metadata = { title: 'Entrar' };

export default function Login() {
  return (
    <>
      <h1 className="conta-titulo">Entrar no painel</h1>
      <p className="conta-sub">Primeiro acesso? Use “Esqueci minha senha” ou o link do convite.</p>
      <FormLogin />
    </>
  );
}
