'use client';
import type { UsuarioConta } from '@trafego/contratos';
import { useActionState } from 'react';
import { salvarPerfil } from '../acoes';
import { ESTADO_INICIAL } from '../validacao';

export function FormPerfil({ usuario }: { usuario: UsuarioConta }) {
  const [estado, enviar, pendente] = useActionState(salvarPerfil, ESTADO_INICIAL);
  return (
    <form action={enviar} className="cfg-form">
      <div className="cfg-form cfg-form-linha cfg-sem-margem">
        <label className="cfg-campo">
          <span className="cfg-rotulo">Nome</span>
          <input
            name="nome"
            required
            maxLength={80}
            defaultValue={usuario.nome}
            className="cfg-input"
          />
        </label>
        <label className="cfg-campo">
          <span className="cfg-rotulo">Sobrenome</span>
          <input
            name="sobrenome"
            maxLength={80}
            defaultValue={usuario.sobrenome}
            className="cfg-input"
          />
        </label>
      </div>
      <label className="cfg-campo">
        <span className="cfg-rotulo">E-mail</span>
        <input
          value={usuario.email}
          readOnly
          className="cfg-input"
          aria-describedby="perfil-email-dica"
        />
        <span id="perfil-email-dica" className="cfg-dica">
          O e-mail é o login e não muda por aqui.
        </span>
      </label>

      <fieldset className="cfg-grupo">
        <legend className="cfg-subtitulo cfg-sem-margem">Trocar senha</legend>
        <p className="cfg-dica">Deixe os três campos em branco para manter a senha atual.</p>
        <label className="cfg-campo">
          <span className="cfg-rotulo">Senha atual</span>
          <input
            name="senhaAtual"
            type="password"
            autoComplete="current-password"
            className="cfg-input"
          />
        </label>
        <label className="cfg-campo">
          <span className="cfg-rotulo">Nova senha (mínimo 8 caracteres)</span>
          <input
            name="novaSenha"
            type="password"
            autoComplete="new-password"
            minLength={8}
            className="cfg-input"
          />
        </label>
        <label className="cfg-campo">
          <span className="cfg-rotulo">Repita a nova senha</span>
          <input
            name="confirmacao"
            type="password"
            autoComplete="new-password"
            className="cfg-input"
          />
        </label>
      </fieldset>

      {estado.mensagem && (
        <p className={estado.ok ? 'cfg-sucesso' : 'cfg-erro'} role="status">
          {estado.mensagem}
        </p>
      )}
      <div className="cfg-acoes">
        <button
          type="submit"
          className="cfg-botao cfg-botao-primario"
          disabled={pendente}
          aria-busy={pendente}
        >
          {pendente ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}
