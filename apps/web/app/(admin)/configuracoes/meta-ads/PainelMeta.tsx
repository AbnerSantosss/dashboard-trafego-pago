'use client';
import type { MetaContaResumo } from '@trafego/contratos';
import { useActionState, useState } from 'react';
import { acaoMeta } from '../acoes';
import { BotaoConfirmar } from '../Confirmar';
import { ESTADO_INICIAL } from '../validacao';

type Conta = MetaContaResumo & { ultimaSyncTexto: string | null };

function CampoToken() {
  return (
    <label className="cfg-campo">
      <span className="cfg-rotulo">Token de acesso</span>
      <input
        type="password"
        name="token"
        required
        minLength={20}
        autoComplete="off"
        spellCheck={false}
        placeholder="EAA..."
        className="cfg-input cfg-input-largo"
      />
    </label>
  );
}

export function PainelMeta({ contas, moedaEmpresa }: { contas: Conta[]; moedaEmpresa: string }) {
  const [estado, enviar, pendente] = useActionState(acaoMeta, ESTADO_INICIAL);
  const [trocando, setTrocando] = useState<string | null>(null);

  return (
    <div className="cfg-meta">
      <p className="cfg-dica">
        O painel lê o gasto diário de cada campanha das contas conectadas e soma no{' '}
        <strong>Investimento</strong>. Ao conectar, lê os últimos 30 dias; depois, atualiza sozinho
        de hora em hora.
      </p>

      {estado.mensagem && (
        <p className={estado.ok ? 'cfg-sucesso' : 'cfg-erro'} role="status">
          {estado.mensagem}
        </p>
      )}

      <table className="cfg-tabela">
        <thead>
          <tr>
            <th>Conta</th>
            <th>Canal no painel</th>
            <th>Última leitura</th>
            <th>Situação</th>
            <th>
              <span className="so-leitor">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {contas.length === 0 && (
            <tr>
              <td colSpan={5} className="cfg-vazio">
                Nenhuma conta conectada.
              </td>
            </tr>
          )}
          {contas.map((c) => (
            <tr key={c.id}>
              <td data-rotulo="Conta">
                {c.nome || c.contaId}
                <span className="cfg-dica cfg-bloco-linha">
                  <code>{c.contaId}</code>
                  {c.moeda && c.moeda !== moedaEmpresa && (
                    <>
                      {' '}
                      · em {c.moeda}: o painel soma sem converter para {moedaEmpresa}
                    </>
                  )}
                </span>
              </td>
              <td data-rotulo="Canal no painel">{c.canal}</td>
              <td data-rotulo="Última leitura">{c.ultimaSyncTexto ?? 'Nunca'}</td>
              <td data-rotulo="Situação">
                {c.ultimoErro ? (
                  <span className="cfg-texto-erro">{c.ultimoErro}</span>
                ) : c.ativo ? (
                  'Atualizando sozinha'
                ) : (
                  'Pausada'
                )}
              </td>
              <td>
                <div className="cfg-linha-acoes">
                  <form action={enviar}>
                    <input type="hidden" name="intencao" value="sincronizar" />
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      className="cfg-botao"
                      disabled={pendente}
                      aria-label={`Sincronizar agora a conta ${c.nome || c.contaId}`}
                    >
                      Sincronizar
                    </button>
                  </form>
                  <form action={enviar}>
                    <input type="hidden" name="intencao" value="alternar" />
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="ativo" value={c.ativo ? '1' : '0'} />
                    <button type="submit" className="cfg-botao" disabled={pendente}>
                      {c.ativo ? 'Pausar' : 'Retomar'}
                    </button>
                  </form>
                  <button
                    type="button"
                    className="cfg-botao"
                    aria-expanded={trocando === c.id}
                    onClick={() => setTrocando(trocando === c.id ? null : c.id)}
                  >
                    Trocar token
                  </button>
                  <form action={enviar}>
                    <input type="hidden" name="intencao" value="remover" />
                    <input type="hidden" name="id" value={c.id} />
                    <BotaoConfirmar
                      rotulo="Desconectar"
                      rotuloAcessivel={`Desconectar a conta ${c.nome || c.contaId}`}
                      titulo={`Desconectar ${c.nome || c.contaId}?`}
                      texto="Todo o gasto lido desta conta sai do painel. Para trazer de volta, conecte a conta de novo."
                      confirmar="Desconectar"
                      desabilitado={pendente}
                    />
                  </form>
                </div>
                {trocando === c.id && (
                  <form
                    action={(fd) => {
                      setTrocando(null);
                      enviar(fd);
                    }}
                    className="cfg-form cfg-form-linha"
                  >
                    <input type="hidden" name="intencao" value="token" />
                    <input type="hidden" name="id" value={c.id} />
                    <CampoToken />
                    <div className="cfg-acoes">
                      <button
                        type="submit"
                        className="cfg-botao cfg-botao-primario"
                        disabled={pendente}
                      >
                        Salvar token
                      </button>
                    </div>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="cfg-subtitulo">Conectar conta</h3>
      <form action={enviar} className="cfg-form cfg-form-linha" aria-label="Conectar conta do Meta">
        <input type="hidden" name="intencao" value="conectar" />
        <label className="cfg-campo">
          <span className="cfg-rotulo">ID da conta de anúncios</span>
          <input
            name="contaId"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="act_1234567890"
            className="cfg-input"
          />
        </label>
        <CampoToken />
        <div className="cfg-acoes">
          <button type="submit" className="cfg-botao cfg-botao-primario" disabled={pendente}>
            {pendente ? 'Conectando…' : 'Conectar'}
          </button>
        </div>
      </form>
    </div>
  );
}
