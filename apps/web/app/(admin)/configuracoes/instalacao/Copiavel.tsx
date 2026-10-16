'use client';
import { useState } from 'react';
import { Icone } from '@/componentes/Nos';

/** Valor de uma linha (endereço) ou bloco de código, com botão de copiar ao lado. */
export function Copiavel(props: { valor: string; rotulo: string; bloco?: boolean }) {
  const [estado, setEstado] = useState<'' | 'ok' | 'falha'>('');
  const copiar = () =>
    navigator.clipboard.writeText(props.valor).then(
      () => setEstado('ok'),
      () => setEstado('falha'),
    );
  return (
    <div className={props.bloco ? 'inst-copiavel inst-copiavel-bloco' : 'inst-copiavel'}>
      {props.bloco ? (
        <pre className="inst-codigo" tabIndex={0} aria-label={props.rotulo}>
          <code>{props.valor}</code>
        </pre>
      ) : (
        <code className="inst-valor">{props.valor}</code>
      )}
      <button
        type="button"
        className="cfg-botao inst-copiar"
        onClick={copiar}
        aria-label={`${props.rotulo}: copiar`}
      >
        <Icone nome={estado === 'ok' ? 'feito' : 'copiar'} className="inst-copiar-ic" />
        <span aria-live="polite">
          {estado === 'ok' ? 'Copiado' : estado === 'falha' ? 'Copie à mão' : 'Copiar'}
        </span>
      </button>
    </div>
  );
}
