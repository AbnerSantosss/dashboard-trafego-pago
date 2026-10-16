'use client';
import Link from 'next/link';
import { useState } from 'react';

export function PainelTag(props: { codigo: string; endpoint: string; semOrigemPublica: boolean }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="cfg-tag">
      <p className="cfg-dica">
        A tag guarda os parâmetros de clique (gclid, fbclid, ttclid, Kwai, Taboola) e as UTMs no
        navegador e envia para <code className="cfg-url">{props.endpoint}</code>. A primeira página
        de cada sessão conta como visita. O <code>user_id</code> lido do dataLayer é o mesmo que a
        plataforma manda no webhook: quando chega um cadastro, FTD ou depósito sem UTM, o painel usa
        a campanha e o canal deste toque.
      </p>
      {props.semOrigemPublica && (
        <p className="cfg-erro">
          O endereço acima ainda é local: a tag só funciona depois que o servidor ganhar um endereço
          público. Veja o passo 1 em <Link href="/configuracoes/instalacao">Instalação</Link>.
        </p>
      )}
      <label className="cfg-campo">
        <span className="cfg-rotulo">Código da tag</span>
        <textarea
          className="cfg-codigo"
          readOnly
          value={props.codigo}
          rows={16}
          spellCheck={false}
        />
      </label>
      <div className="cfg-acoes">
        <button
          type="button"
          className="cfg-botao cfg-botao-primario"
          onClick={() =>
            navigator.clipboard.writeText(props.codigo).then(
              () => setCopiado(true),
              () => setCopiado(false),
            )
          }
        >
          <span aria-live="polite">{copiado ? 'Copiado' : 'Copiar código'}</span>
        </button>
      </div>
    </div>
  );
}
