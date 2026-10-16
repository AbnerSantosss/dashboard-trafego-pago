'use client';
import type { ConvitePublico } from '@trafego/contratos';
import { useActionState, useState } from 'react';
import { ESTADO_INICIAL, type EstadoAcao } from '../(admin)/configuracoes/validacao';
import { aceitarConvite, entrar, recuperar, redefinir } from './acoes';

function Mensagem({ estado }: { estado: EstadoAcao }) {
  if (!estado.mensagem) return null;
  return (
    <p className={estado.ok ? 'cfg-sucesso' : 'cfg-erro'} role="status">
      {estado.mensagem}
    </p>
  );
}

function Campo(props: {
  rotulo: string;
  nome: string;
  tipo?: string;
  auto?: string;
  obrigatorio?: boolean;
  valor?: string;
}) {
  return (
    <label className="cfg-campo">
      <span className="cfg-rotulo">{props.rotulo}</span>
      <input
        className="cfg-input"
        name={props.nome}
        type={props.tipo ?? 'text'}
        autoComplete={props.auto}
        required={props.obrigatorio ?? true}
        defaultValue={props.valor}
      />
    </label>
  );
}

export function FormLogin() {
  const [modo, setModo] = useState<'entrar' | 'recuperar'>('entrar');
  const [estado, enviar, pendente] = useActionState(entrar, ESTADO_INICIAL);
  const [estadoRec, enviarRec, pendenteRec] = useActionState(recuperar, ESTADO_INICIAL);

  if (modo === 'recuperar') {
    return (
      <form action={enviarRec} className="cfg-form">
        <p className="cfg-dica">
          Informe seu e-mail. Enviamos um link para criar a senha (vale também para o primeiro
          acesso).
        </p>
        <Campo rotulo="E-mail" nome="email" tipo="email" auto="email" />
        <Mensagem estado={estadoRec} />
        <div className="cfg-acoes">
          <button type="submit" className="cfg-botao cfg-botao-primario" disabled={pendenteRec}>
            Enviar link
          </button>
          <button type="button" className="cfg-botao" onClick={() => setModo('entrar')}>
            Voltar
          </button>
        </div>
      </form>
    );
  }
  return (
    <form action={enviar} className="cfg-form">
      <Campo rotulo="E-mail" nome="email" tipo="email" auto="email" />
      <Campo rotulo="Senha" nome="senha" tipo="password" auto="current-password" />
      <Mensagem estado={estado} />
      <div className="cfg-acoes">
        <button type="submit" className="cfg-botao cfg-botao-primario" disabled={pendente}>
          Entrar
        </button>
        <button type="button" className="cfg-botao" onClick={() => setModo('recuperar')}>
          Esqueci minha senha
        </button>
      </div>
    </form>
  );
}

export function FormRedefinir({ token }: { token: string }) {
  const [estado, enviar, pendente] = useActionState(redefinir, ESTADO_INICIAL);
  return (
    <form action={enviar} className="cfg-form">
      <input type="hidden" name="token" value={token} />
      <Campo
        rotulo="Nova senha (mínimo 8 caracteres)"
        nome="senha"
        tipo="password"
        auto="new-password"
      />
      <Campo rotulo="Repita a senha" nome="confirmacao" tipo="password" auto="new-password" />
      <Mensagem estado={estado} />
      <div className="cfg-acoes">
        <button type="submit" className="cfg-botao cfg-botao-primario" disabled={pendente}>
          Salvar e entrar
        </button>
      </div>
    </form>
  );
}

export function FormConvite({ token, convite }: { token: string; convite: ConvitePublico }) {
  const [estado, enviar, pendente] = useActionState(aceitarConvite, ESTADO_INICIAL);
  return (
    <form action={enviar} className="cfg-form">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="jaTemSenha" value={convite.jaTemSenha ? '1' : '0'} />
      <p className="cfg-dica">
        Acesso de <strong>{convite.email}</strong> ao painel <strong>{convite.empresa}</strong>.
      </p>
      <Campo rotulo="Nome" nome="nome" auto="given-name" />
      <Campo rotulo="Sobrenome" nome="sobrenome" auto="family-name" obrigatorio={false} />
      {convite.jaTemSenha ? (
        <Campo rotulo="Sua senha atual" nome="senha" tipo="password" auto="current-password" />
      ) : (
        <>
          <Campo
            rotulo="Crie uma senha (mínimo 8 caracteres)"
            nome="senha"
            tipo="password"
            auto="new-password"
          />
          <Campo rotulo="Repita a senha" nome="confirmacao" tipo="password" auto="new-password" />
        </>
      )}
      <Mensagem estado={estado} />
      <div className="cfg-acoes">
        <button type="submit" className="cfg-botao cfg-botao-primario" disabled={pendente}>
          Aceitar convite
        </button>
      </div>
    </form>
  );
}
