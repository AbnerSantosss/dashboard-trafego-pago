import type { CSSProperties, ReactNode } from 'react';

export interface PassoGuia {
  titulo: string;
  texto: ReactNode;
}

/** Passo a passo numerado de uma ligação (Tag do GTM, Webhooks, Meta Ads), dentro de Instalação. */
export function Guia({ titulo, passos }: { titulo: string; passos: PassoGuia[] }) {
  return (
    <section className="cfg-guia" aria-label={titulo}>
      <h3 className="cfg-guia-titulo">{titulo}</h3>
      <ol className="cfg-guia-lista">
        {passos.map((p, i) => (
          <li key={p.titulo} className="cfg-guia-passo" style={{ '--i': i } as CSSProperties}>
            <div>
              <strong className="cfg-guia-passo-titulo">{p.titulo}</strong>
              <div className="cfg-guia-passo-texto">{p.texto}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
