'use client';
import type { ConvitePublico } from '@trafego/contratos';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Icone } from '@/componentes/Nos';
import { ESTADO_INICIAL, type EstadoAcao } from '../(admin)/configuracoes/validacao';
import { aceitarConvite, confirmarCodigo, entrar, recuperar, redefinir } from './acoes';

function Mensagem({ estado }: { estado: EstadoAcao }) {
  if (!estado.mensagem) return null;
  return (
    <p className={estado.ok ? 'cfg-sucesso' : 'cfg-erro'} role="status">
      {estado.mensagem}
      {estado.expirou && (
        <>
          {' '}
          <Link href="/login">Ir para o login</Link>
        </>
      )}
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

/** Campo do login: rótulo em cima, ícone à esquerda e, opcionalmente, um botão à direita. */
function CampoIcone(props: {
  rotulo: string;
  nome: string;
  tipo: string;
  auto: string;
  icone: string;
  dica: string;
  children?: React.ReactNode;
}) {
  return (
    <label className="cfg-campo lg-campo">
      <span className="cfg-rotulo">{props.rotulo}</span>
      <span className="lg-caixa">
        <Icone nome={props.icone} className="lg-ic" />
        <input
          className="cfg-input lg-input"
          name={props.nome}
          type={props.tipo}
          autoComplete={props.auto}
          placeholder={props.dica}
          required
        />
        {props.children}
      </span>
    </label>
  );
}

export function FormLogin() {
  const [modo, setModo] = useState<'entrar' | 'recuperar'>('entrar');
  const [verSenha, setVerSenha] = useState(false);
  const [estado, enviar, pendente] = useActionState(entrar, ESTADO_INICIAL);
  const [estadoRec, enviarRec, pendenteRec] = useActionState(recuperar, ESTADO_INICIAL);

  if (modo === 'recuperar') {
    return (
      <form action={enviarRec} className="cfg-form lg-form">
        <p className="cfg-dica">
          Informe seu e-mail. Enviamos um link para criar a senha (vale também para o primeiro
          acesso).
        </p>
        <CampoIcone
          rotulo="E-mail"
          nome="email"
          tipo="email"
          auto="email"
          icone="email"
          dica="Digite seu e-mail"
        />
        <Mensagem estado={estadoRec} />
        <button type="submit" className="lg-entrar" disabled={pendenteRec} aria-busy={pendenteRec}>
          {pendenteRec ? 'Enviando…' : 'Enviar link'}
        </button>
        <button type="button" className="lg-link lg-voltar" onClick={() => setModo('entrar')}>
          Voltar para o login
        </button>
      </form>
    );
  }
  return (
    <form action={enviar} className="cfg-form lg-form">
      <CampoIcone
        rotulo="E-mail"
        nome="email"
        tipo="email"
        auto="email"
        icone="email"
        dica="Digite seu e-mail"
      />
      <CampoIcone
        rotulo="Senha"
        nome="senha"
        tipo={verSenha ? 'text' : 'password'}
        auto="current-password"
        icone="cadeado"
        dica="Digite sua senha"
      >
        <button
          type="button"
          className="lg-olho"
          onClick={() => setVerSenha((v) => !v)}
          aria-pressed={verSenha}
          title={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
        >
          <Icone nome={verSenha ? 'olho' : 'olho-fechado'} className="lg-ic" />
          <span className="so-leitor">{verSenha ? 'Ocultar senha' : 'Mostrar senha'}</span>
        </button>
      </CampoIcone>
      <div className="lg-linha">
        <label className="lg-lembrar">
          <input type="checkbox" name="lembrar" defaultChecked />
          Lembrar de mim
        </label>
        <button type="button" className="lg-link" onClick={() => setModo('recuperar')}>
          Esqueceu a senha?
        </button>
      </div>
      <Mensagem estado={estado} />
      <button type="submit" className="lg-entrar" disabled={pendente} aria-busy={pendente}>
        {pendente ? 'Entrando…' : 'Entrar'}
        {!pendente && <Icone nome="seguir" className="lg-seta" />}
      </button>
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
        <button
          type="submit"
          className="cfg-botao cfg-botao-primario"
          disabled={pendente}
          aria-busy={pendente}
        >
          {pendente ? 'Salvando…' : 'Salvar e entrar'}
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
        <button
          type="submit"
          className="cfg-botao cfg-botao-primario"
          disabled={pendente}
          aria-busy={pendente}
        >
          {pendente ? 'Aceitando…' : 'Aceitar convite'}
        </button>
      </div>
    </form>
  );
}

/**
 * Segunda etapa do login: o código de 6 dígitos do app autenticador. O desafio fica no cookie
 * httpOnly; este formulário só manda o código. Espaços são aceitos ("123 456").
 */
export function FormCodigo() {
  const [estado, enviar, pendente] = useActionState(confirmarCodigo, ESTADO_INICIAL);
  return (
    <form action={enviar} className="cfg-form lg-form">
      <label className="cfg-campo lg-campo">
        <span className="cfg-rotulo">Código do app</span>
        <span className="lg-caixa">
          <Icone nome="cadeado" className="lg-ic" />
          <input
            className="cfg-input lg-input lg-codigo"
            name="codigo"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\s*(?:[0-9]\s*){6}"
            maxLength={12}
            title="6 dígitos"
            placeholder="000 000"
            required
            autoFocus
          />
        </span>
      </label>
      <Mensagem estado={estado} />
      <button type="submit" className="lg-entrar" disabled={pendente} aria-busy={pendente}>
        {pendente ? 'Confirmando…' : 'Confirmar'}
      </button>
      <Link href="/login" className="lg-link lg-voltar">
        Voltar ao login
      </Link>
    </form>
  );
}
