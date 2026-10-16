import '../(admin)/configuracoes/configuracoes.css';
import './conta.css';

/** Casca das telas públicas (login, convite, nova senha): cartão centralizado. */
export default function LayoutConta({ children }: { children: React.ReactNode }) {
  return (
    <main className="conta-fundo">
      <section className="conta-cartao">{children}</section>
    </main>
  );
}
