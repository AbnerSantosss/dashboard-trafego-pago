'use client';
import { useState } from 'react';

export function PainelTag(props: { codigo: string; endpoint: string; semOrigemPublica: boolean }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="cfg-tag">
      <ol className="cfg-passos">
        <li>
          No GTM, crie uma tag <strong>HTML personalizado</strong> e cole o código abaixo.
        </li>
        <li>
          Acionador: <strong>All Pages</strong> (e, se o login do site não recarrega a página,
          também o evento do dataLayer em que o <code>user_id</code> aparece).
        </li>
        <li>Publique o contêiner.</li>
      </ol>
      <p className="cfg-dica">
        A tag guarda os parâmetros de clique (gclid, fbclid, ttclid, Kwai, Taboola) e as UTMs no
        navegador e envia para <code className="cfg-url">{props.endpoint}</code>. A primeira página
        de cada sessão conta como visita. O <code>user_id</code> lido do dataLayer é o mesmo que a
        plataforma manda no webhook: quando chega um cadastro, FTD ou depósito sem UTM, o painel usa
        a campanha e o canal deste toque.
      </p>
      {props.semOrigemPublica && (
        <p className="cfg-erro">
          Falta definir WEBHOOK_URL_PUBLICA no servidor do painel: o endereço acima só funciona
          nesta máquina.
        </p>
      )}
      <textarea className="cfg-codigo" readOnly value={props.codigo} rows={16} spellCheck={false} />
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
          {copiado ? 'Copiado' : 'Copiar código'}
        </button>
      </div>
    </div>
  );
}
