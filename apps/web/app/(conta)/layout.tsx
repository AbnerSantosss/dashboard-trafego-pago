import '../(admin)/configuracoes/configuracoes.css';
import './conta.css';
import { FundoConta } from './FundoConta';

/** Casca das telas públicas (login, convite, nova senha): cartão de vidro com o logo, sobre as ondas. */
export default function LayoutConta({ children }: { children: React.ReactNode }) {
  return (
    <FundoConta>
      <section className="conta-cartao">
        {/* Logo padrão: as telas públicas ainda não sabem de qual empresa é o visitante. */}
        <img className="conta-logo" src="/brand/pasio-logo.png" alt="PASIO" />
        {children}
      </section>
    </FundoConta>
  );
}
