'use client';
import type { ApresentacaoResposta } from '@trafego/contratos';
import { useActionState, useState } from 'react';
import { salvarApresentacao } from '../acoes';
import { BotaoConfirmar } from '../Confirmar';
import {
  ESTADO_INICIAL,
  formatarBytes,
  LOGO_TAMANHO_MAXIMO,
  NOME_EXIBICAO_MAXIMO,
  validarLogo,
} from '../validacao';

export function FormApresentacao({ atual }: { atual: ApresentacaoResposta }) {
  const [estado, enviar, pendente] = useActionState(salvarApresentacao, ESTADO_INICIAL);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const logo = previa ?? atual.logoUrl ?? atual.logoPadraoUrl;

  function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (previa) URL.revokeObjectURL(previa);
    setPrevia(null);
    if (!f) {
      setErroArquivo(null);
      return;
    }
    const erro = validarLogo(f);
    setErroArquivo(erro);
    if (erro) {
      e.target.value = ''; // não envia arquivo inválido
      return;
    }
    setPrevia(URL.createObjectURL(f));
  }

  return (
    <form action={enviar} className="cfg-form">
      <label className="cfg-campo">
        <span className="cfg-rotulo">Nome exibido</span>
        <input
          name="nomeExibicao"
          defaultValue={atual.nomeExibicao}
          maxLength={NOME_EXIBICAO_MAXIMO}
          required
          className="cfg-input"
        />
      </label>

      <div className="cfg-campo">
        <span className="cfg-rotulo">{previa ? 'Pré-visualização' : 'Logo atual'}</span>
        <div className="cfg-previa">
          {logo ? (
            <img src={logo} alt={`Logo de ${atual.nomeExibicao}`} className="cfg-previa-img" />
          ) : (
            <span className="cfg-previa-texto">{atual.nomeExibicao}</span>
          )}
        </div>
        {!atual.logoUrl && atual.logoPadraoUrl && !previa && (
          <span className="cfg-dica">Usando o logo padrão da empresa.</span>
        )}
      </div>

      <label className="cfg-campo">
        <span className="cfg-rotulo">Novo logo</span>
        <input
          type="file"
          name="logo"
          accept="image/png,image/svg+xml,.png,.svg"
          onChange={aoEscolher}
          className="cfg-input-arquivo"
        />
        <span className="cfg-dica">PNG ou SVG, até {formatarBytes(LOGO_TAMANHO_MAXIMO)}.</span>
        {erroArquivo && (
          <span className="cfg-erro" role="alert">
            {erroArquivo}
          </span>
        )}
      </label>

      <div className="cfg-acoes">
        <button
          type="submit"
          className="cfg-botao cfg-botao-primario"
          disabled={pendente}
          aria-busy={pendente}
        >
          {pendente ? 'Salvando…' : 'Salvar'}
        </button>
        {atual.logoUrl && (
          <BotaoConfirmar
            rotulo="Remover logo"
            titulo="Remover o logo enviado?"
            texto={
              atual.logoPadraoUrl
                ? 'O menu volta a mostrar o logo padrão da empresa. Para usar este de novo, envie o arquivo outra vez.'
                : 'O menu passa a mostrar o nome em texto. Para usar este logo de novo, envie o arquivo outra vez.'
            }
            confirmar="Remover logo"
            nome="remover"
            valor="1"
            desabilitado={pendente}
          />
        )}
      </div>

      {estado.mensagem && (
        <p className={estado.ok ? 'cfg-sucesso' : 'cfg-erro'} role="status">
          {estado.mensagem}
        </p>
      )}
    </form>
  );
}
