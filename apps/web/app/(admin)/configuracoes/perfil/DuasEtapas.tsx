'use client';
/**
 * Verificação em duas etapas do próprio usuário (opcional). Três estados: desativada (pede a senha
 * para começar), pendente (QR code, segredo para digitar e código para confirmar) e ativa (senha e
 * código para desligar). O segredo só existe no estado da action; nada vai para URL ou storage.
 */
import { useActionState, useState } from 'react';
import { acaoDuasEtapas } from '../acoes';
import { ESTADO_INICIAL, agruparSegredo, type EstadoAcao } from '../validacao';

function Mensagem({ estado }: { estado: EstadoAcao }) {
  if (!estado.mensagem) return null;
  return (
    <p className={estado.ok ? 'cfg-sucesso' : 'cfg-erro'} role="status">
      {estado.mensagem}
    </p>
  );
}

function CampoSenha() {
  return (
    <label className="cfg-campo">
      <span className="cfg-rotulo">Senha atual</span>
      <input
        name="senhaAtual"
        type="password"
        autoComplete="current-password"
        required
        className="cfg-input"
      />
    </label>
  );
}

function CampoCodigo({ rotulo }: { rotulo: string }) {
  return (
    <label className="cfg-campo">
      <span className="cfg-rotulo">{rotulo}</span>
      <input
        name="codigo"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\s*(?:[0-9]\s*){6}"
        maxLength={12}
        title="6 dígitos"
        placeholder="000 000"
        required
        className="cfg-input cfg-input-codigo"
      />
    </label>
  );
}

function Botao({
  pendente,
  rotulo,
  ocupado,
}: {
  pendente: boolean;
  rotulo: string;
  ocupado: string;
}) {
  return (
    <div className="cfg-acoes">
      <button
        type="submit"
        className="cfg-botao cfg-botao-primario"
        disabled={pendente}
        aria-busy={pendente}
      >
        {pendente ? ocupado : rotulo}
      </button>
    </div>
  );
}

function Confirmar({
  segredo,
  qrSvgBase64,
  onCancelar,
}: {
  segredo: string;
  qrSvgBase64: string;
  onCancelar: () => void;
}) {
  const [estado, enviar, pendente] = useActionState(acaoDuasEtapas, ESTADO_INICIAL);
  return (
    <form action={enviar} className="cfg-form">
      <input type="hidden" name="intencao" value="ativar" />
      <p className="cfg-dica">
        1. No app autenticador, adicione uma conta e leia o QR code. Sem câmera, digite o código
        abaixo dele.
      </p>
      {qrSvgBase64 && (
        <img
          className="cfg-qr"
          src={`data:image/svg+xml;base64,${qrSvgBase64}`}
          alt="QR code para adicionar o PASIO ao app autenticador"
          width={176}
          height={176}
        />
      )}
      <p className="cfg-segredo-titulo cfg-sem-margem">Código para digitar no app</p>
      <code className="cfg-segredo-valor cfg-segredo-2fa">{agruparSegredo(segredo)}</code>
      <p className="cfg-dica">2. Digite o código de 6 dígitos que o app mostrar.</p>
      <CampoCodigo rotulo="Código do app" />
      <Mensagem estado={estado} />
      <div className="cfg-acoes">
        <button
          type="submit"
          className="cfg-botao cfg-botao-primario"
          disabled={pendente}
          aria-busy={pendente}
        >
          {pendente ? 'Ativando…' : 'Confirmar e ativar'}
        </button>
        <button type="button" className="cfg-botao" onClick={onCancelar} disabled={pendente}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Desativada() {
  const [estado, enviar, pendente] = useActionState(acaoDuasEtapas, ESTADO_INICIAL);
  // "Cancelar" esconde o QR desta tentativa; o segredo pendente vence sozinho na API.
  const [descartado, setDescartado] = useState<EstadoAcao | null>(null);
  if (estado.duasEtapas && estado !== descartado) {
    return (
      <Confirmar
        segredo={estado.duasEtapas.segredo}
        qrSvgBase64={estado.duasEtapas.qrSvgBase64}
        onCancelar={() => setDescartado(estado)}
      />
    );
  }
  return (
    <form action={enviar} className="cfg-form">
      <input type="hidden" name="intencao" value="iniciar" />
      <p className="cfg-dica">
        Opcional. Além da senha, o login passa a pedir um código do app autenticador (Google
        Authenticator, Microsoft Authenticator, 1Password etc.).
      </p>
      <CampoSenha />
      {estado !== descartado && <Mensagem estado={estado} />}
      <Botao pendente={pendente} rotulo="Ativar" ocupado="Conferindo…" />
    </form>
  );
}

function Ativada() {
  const [estado, enviar, pendente] = useActionState(acaoDuasEtapas, ESTADO_INICIAL);
  return (
    <form action={enviar} className="cfg-form">
      <input type="hidden" name="intencao" value="desativar" />
      <p className="cfg-dica">
        <span className="cfg-selo-ativa">Ativa</span> O login pede o código do app além da senha.
        Para desligar, confirme a senha e um código.
      </p>
      <CampoSenha />
      <CampoCodigo rotulo="Código do app" />
      <Mensagem estado={estado} />
      <Botao pendente={pendente} rotulo="Desativar" ocupado="Desativando…" />
    </form>
  );
}

/** Troca de visão quando o perfil recarrega com o novo `ativa`, e avisa o que mudou. */
export function DuasEtapas({ ativa }: { ativa: boolean }) {
  const [anterior, setAnterior] = useState(ativa);
  const [aviso, setAviso] = useState('');
  if (anterior !== ativa) {
    setAnterior(ativa);
    setAviso(
      ativa ? 'Verificação em duas etapas ativada.' : 'Verificação em duas etapas desativada.',
    );
  }
  return (
    <>
      {aviso && (
        <p className="cfg-sucesso" role="status">
          {aviso}
        </p>
      )}
      {ativa ? <Ativada /> : <Desativada />}
    </>
  );
}
