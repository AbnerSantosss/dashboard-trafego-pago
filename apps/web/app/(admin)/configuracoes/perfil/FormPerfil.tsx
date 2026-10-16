'use client';
import type { UsuarioConta } from '@trafego/contratos';
import { useActionState } from 'react';
import { salvarPerfil } from '../acoes';
import { ESTADO_INICIAL } from '../validacao';

export function FormPerfil({ usuario }: { usuario: UsuarioConta }) {
  const [estado, enviar, pendente] = useActionState(salvarPerfil, ESTADO_INICIAL);
  return (
    <form action={enviar} className="cfg-form">
      <div className="cfg-form-linha cfg-sem-margem">
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
        <input value={usuario.email} readOnly className="cfg-input" />
      </label>

      <fieldset className="cfg-grupo">
        <legend className="cfg-rotulo">Trocar senha (deixe em branco para manter)</legend>
        <input
          name="senhaAtual"
          type="password"
          autoComplete="current-password"
          placeholder="Senha atual"
          className="cfg-input"
        />
        <input
          name="novaSenha"
          type="password"
          autoComplete="new-password"
          minLength={8}
          placeholder="Nova senha"
          className="cfg-input"
        />
        <input
          name="confirmacao"
          type="password"
          autoComplete="new-password"
          placeholder="Repita a nova senha"
          className="cfg-input"
        />
      </fieldset>

      {estado.mensagem && (
        <p className={estado.ok ? 'cfg-sucesso' : 'cfg-erro'} role="status">
          {estado.mensagem}
        </p>
      )}
      <div className="cfg-acoes">
        <button type="submit" className="cfg-botao cfg-botao-primario" disabled={pendente}>
          Salvar
        </button>
      </div>
    </form>
  );
}
