'use client';
import type { Papel, UsuariosResposta } from '@trafego/contratos';
import { useActionState, useState } from 'react';
import { acaoUsuarios } from '../acoes';
import { ESTADO_INICIAL } from '../validacao';

const PAPEIS: { valor: Papel; rotulo: string }[] = [
  { valor: 'leitor', rotulo: 'Leitor (só acompanha)' },
  { valor: 'analista', rotulo: 'Analista' },
  { valor: 'admin', rotulo: 'Administrador' },
];

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

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
        {copiado ? 'Copiado' : 'Copiar link'}
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
        <button type="submit" className="cfg-botao cfg-botao-primario" disabled={pendente}>
          Enviar convite
        </button>
      </form>

      {estado.mensagem && (
        <p className={estado.ok ? 'cfg-sucesso' : 'cfg-erro'} role="status">
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
              <td>
                {`${m.nome} ${m.sobrenome}`.trim()}
                {!m.temSenha && <span className="cfg-etiqueta">sem senha</span>}
              </td>
              <td>{m.email}</td>
              <td>
                {m.id === euId ? (
                  PAPEIS.find((p) => p.valor === m.papel)?.rotulo
                ) : (
                  <form action={enviar}>
                    <input type="hidden" name="intencao" value="papel" />
                    <input type="hidden" name="id" value={m.id} />
                    <select
                      name="papel"
                      defaultValue={m.papel}
                      className="cfg-input"
                      aria-label={`Papel de ${m.email}`}
                      onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    >
                      {PAPEIS.map((p) => (
                        <option key={p.valor} value={p.valor}>
                          {p.rotulo}
                        </option>
                      ))}
                    </select>
                  </form>
                )}
              </td>
              <td>{data(m.desde)}</td>
              <td>
                {m.id === euId ? (
                  <span className="cfg-dica">você</span>
                ) : (
                  <form action={enviar}>
                    <input type="hidden" name="intencao" value="remover" />
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" className="cfg-botao" disabled={pendente}>
                      Remover
                    </button>
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
              <td>{c.email}</td>
              <td>{PAPEIS.find((p) => p.valor === c.papel)?.rotulo}</td>
              <td>{data(c.expiraEm)}</td>
              <td>
                <form action={enviar}>
                  <input type="hidden" name="intencao" value="cancelar" />
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="cfg-botao" disabled={pendente}>
                    Cancelar
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
