'use client';
import type { Papel, UsuariosResposta } from '@trafego/contratos';
import { useActionState, useState } from 'react';
import { acaoUsuarios } from '../acoes';
import { BotaoConfirmar } from '../Confirmar';
import { ESTADO_INICIAL } from '../validacao';

const PAPEIS: { valor: Papel; rotulo: string }[] = [
  { valor: 'leitor', rotulo: 'Leitor (só acompanha)' },
  { valor: 'analista', rotulo: 'Analista' },
  { valor: 'admin', rotulo: 'Administrador' },
];

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

/** Papel de um membro: a troca só vale ao clicar em Aplicar (antes trocava ao escolher). */
function TrocarPapel(props: {
  id: string;
  email: string;
  papel: Papel;
  pendente: boolean;
  enviar: (dados: FormData) => void;
}) {
  const [escolhido, setEscolhido] = useState(props.papel);
  return (
    <form action={props.enviar} className="cfg-linha-acoes">
      <input type="hidden" name="intencao" value="papel" />
      <input type="hidden" name="id" value={props.id} />
      <select
        name="papel"
        value={escolhido}
        className="cfg-input"
        aria-label={`Papel de ${props.email}`}
        onChange={(e) => setEscolhido(e.currentTarget.value as Papel)}
      >
        {PAPEIS.map((p) => (
          <option key={p.valor} value={p.valor}>
            {p.rotulo}
          </option>
        ))}
      </select>
      {escolhido !== props.papel && (
        <>
          <button type="submit" className="cfg-botao cfg-botao-primario" disabled={props.pendente}>
            Aplicar
          </button>
          <button type="button" className="cfg-botao" onClick={() => setEscolhido(props.papel)}>
            Desfazer
          </button>
        </>
      )}
    </form>
  );
}

function CopiarLink({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="cfg-segredo-linha">
      <code className="cfg-segredo-valor">{link}</code>
      <button
        type="button"
        className="cfg-botao"
        onClick={() =>
          navigator.clipboard.writeText(link).then(
            () => setCopiado(true),
            () => {},
          )
        }
      >
        <span aria-live="polite">{copiado ? 'Copiado' : 'Copiar link'}</span>
      </button>
    </div>
  );
}

export function PainelUsuarios({ membros, convites, euId }: UsuariosResposta & { euId: string }) {
  const [estado, enviar, pendente] = useActionState(acaoUsuarios, ESTADO_INICIAL);

  return (
    <div className="cfg-webhooks">
      <form action={enviar} className="cfg-form cfg-form-linha cfg-sem-margem">
        <input type="hidden" name="intencao" value="convidar" />
        <label className="cfg-campo">
          <span className="cfg-rotulo">Convidar por e-mail</span>
          <input
            name="email"
            type="email"
            required
            placeholder="pessoa@empresa.com"
            className="cfg-input cfg-input-largo"
          />
        </label>
        <label className="cfg-campo">
          <span className="cfg-rotulo">Papel</span>
          <select name="papel" defaultValue="leitor" className="cfg-input">
            {PAPEIS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="cfg-botao cfg-botao-primario"
          disabled={pendente}
          aria-busy={pendente}
        >
          {pendente ? 'Enviando…' : 'Enviar convite'}
        </button>
      </form>

      {/* Convite criado sem e-mail também é falha: aparece como erro, com o motivo. */}
      {estado.mensagem && (
        <p
          className={estado.ok && estado.emailEnviado !== false ? 'cfg-sucesso' : 'cfg-erro'}
          role="status"
        >
          {estado.mensagem}
        </p>
      )}
      {estado.ok && estado.link && <CopiarLink link={estado.link} />}

      <h2 className="cfg-subtitulo">Membros</h2>
      <table className="cfg-tabela">
        <thead>
          <tr>
            <th>Nome</th>
            <th>E-mail</th>
            <th>Papel</th>
            <th>Desde</th>
            <th>
              <span className="so-leitor">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {membros.map((m) => (
            <tr key={m.id}>
              <td data-rotulo="Nome">
                {`${m.nome} ${m.sobrenome}`.trim()}
                {!m.temSenha && <span className="cfg-etiqueta">sem senha</span>}
              </td>
              <td data-rotulo="E-mail">{m.email}</td>
              <td data-rotulo="Papel">
                {m.id === euId ? (
                  PAPEIS.find((p) => p.valor === m.papel)?.rotulo
                ) : (
                  <TrocarPapel
                    id={m.id}
                    email={m.email}
                    papel={m.papel}
                    pendente={pendente}
                    enviar={enviar}
                  />
                )}
              </td>
              <td data-rotulo="Desde">{data(m.desde)}</td>
              <td>
                {m.id === euId ? (
                  <span className="cfg-dica">você</span>
                ) : (
                  <form action={enviar}>
                    <input type="hidden" name="intencao" value="remover" />
                    <input type="hidden" name="id" value={m.id} />
                    <BotaoConfirmar
                      rotulo="Remover"
                      rotuloAcessivel={`Remover ${m.email}`}
                      titulo={`Remover ${m.email}?`}
                      texto="A pessoa perde o acesso ao painel na hora. Para voltar, precisa de um convite novo."
                      confirmar="Remover acesso"
                      desabilitado={pendente}
                    />
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="cfg-subtitulo">Convites pendentes</h2>
      <table className="cfg-tabela">
        <thead>
          <tr>
            <th>E-mail</th>
            <th>Papel</th>
            <th>Vence em</th>
            <th>
              <span className="so-leitor">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {convites.length === 0 && (
            <tr>
              <td colSpan={4} className="cfg-vazio">
                Nenhum convite pendente.
              </td>
            </tr>
          )}
          {convites.map((c) => (
            <tr key={c.id}>
              <td data-rotulo="E-mail">{c.email}</td>
              <td data-rotulo="Papel">{PAPEIS.find((p) => p.valor === c.papel)?.rotulo}</td>
              <td data-rotulo="Vence em">{data(c.expiraEm)}</td>
              <td>
                <form action={enviar}>
                  <input type="hidden" name="intencao" value="cancelar" />
                  <input type="hidden" name="id" value={c.id} />
                  <BotaoConfirmar
                    rotulo="Cancelar"
                    rotuloAcessivel={`Cancelar convite de ${c.email}`}
                    titulo={`Cancelar o convite de ${c.email}?`}
                    texto="O link enviado deixa de funcionar. Dá para convidar de novo depois."
                    confirmar="Cancelar convite"
                    desabilitado={pendente}
                  />
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
