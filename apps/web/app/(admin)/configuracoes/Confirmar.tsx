'use client';
import { useId, useRef } from 'react';

/**
 * Botão de ação sem volta (remover, rotacionar segredo). Fica dentro do `<form>` da ação: abre um
 * `<dialog>` com a consequência escrita e só o botão de confirmar envia o formulário.
 * Esc e clique fora fecham sem enviar.
 */
export function BotaoConfirmar(props: {
  rotulo: string;
  titulo: string;
  texto: string;
  confirmar: string;
  desabilitado?: boolean;
  /** Nome e valor levados pelo botão que envia (ex.: `remover=1`). */
  nome?: string;
  valor?: string;
  rotuloAcessivel?: string;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const id = useId();
  return (
    <>
      <button
        type="button"
        className="cfg-botao"
        disabled={props.desabilitado}
        aria-label={props.rotuloAcessivel}
        aria-haspopup="dialog"
        onClick={() => dialogo.current?.showModal()}
      >
        {props.rotulo}
      </button>
      <dialog
        ref={dialogo}
        className="cfg-dialogo"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        {/* O corpo ocupa o diálogo inteiro: clique fora dele cai no backdrop e fecha. */}
        <div className="cfg-dialogo-corpo">
          <h2 id={`${id}-t`} className="cfg-dialogo-titulo">
            {props.titulo}
          </h2>
          <p id={`${id}-d`}>{props.texto}</p>
          <div className="cfg-acoes">
            <button type="button" className="cfg-botao" onClick={() => dialogo.current?.close()}>
              Cancelar
            </button>
            <button
              type="submit"
              className="cfg-botao cfg-botao-perigo"
              name={props.nome}
              value={props.valor}
              onClick={() => dialogo.current?.close()}
            >
              {props.confirmar}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
