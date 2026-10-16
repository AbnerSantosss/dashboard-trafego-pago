'use client';
import type { FonteResumo } from '@trafego/contratos';
import { useActionState, useState } from 'react';
import { acaoWebhook } from '../acoes';
import { BotaoConfirmar } from '../Confirmar';
import { AVISO_SEGREDO, ESTADO_INICIAL } from '../validacao';

type Fonte = FonteResumo & { url: string };

/** Mostra o segredo uma única vez; vive só no estado desta renderização (nada persiste). */
function SegredoUmaVez({ segredo, slug }: { segredo: string; slug: string | undefined }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(segredo);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }
  return (
    <div className="cfg-segredo" role="status">
      <p className="cfg-segredo-titulo">Segredo{slug ? ` da fonte ${slug}` : ''}</p>
      <div className="cfg-segredo-linha">
        <code className="cfg-segredo-valor">{segredo}</code>
        <button type="button" className="cfg-botao" onClick={copiar}>
          <span aria-live="polite">{copiado ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>
      <p className="cfg-aviso">{AVISO_SEGREDO}</p>
    </div>
  );
}

export function PainelWebhooks({ fontes }: { fontes: Fonte[] }) {
  const [estado, enviar, pendente] = useActionState(acaoWebhook, ESTADO_INICIAL);
  const [criando, setCriando] = useState(false);

  return (
    <div className="cfg-webhooks">
      {estado.mensagem && (
        <p className={estado.ok ? 'cfg-sucesso' : 'cfg-erro'} role="status">
          {estado.mensagem}
        </p>
      )}
      {estado.ok && estado.segredo && <SegredoUmaVez segredo={estado.segredo} slug={estado.slug} />}

      <p className="cfg-dica">
        A plataforma envia para o endereço da fonte os eventos de <strong>cadastro</strong>,{' '}
        <strong>FTD</strong> e <strong>depósito</strong> (redepósito também é depósito), assinados
        com o segredo. Mande o mesmo <code>user_id</code> que o site coloca no dataLayer: assim o
        painel cruza o evento com a campanha captada pela aba Tag GTM.
      </p>
      <table className="cfg-tabela">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Slug</th>
            <th>Endereço de recebimento</th>
            <th>Ativo</th>
            <th>Segredo utilizável</th>
            <th>
              <span className="so-leitor">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {fontes.length === 0 && (
            <tr>
              <td colSpan={6} className="cfg-vazio">
                Nenhuma fonte cadastrada.
              </td>
            </tr>
          )}
          {fontes.map((f) => (
            <tr key={f.id}>
              <td data-rotulo="Nome">{f.nome}</td>
              <td data-rotulo="Slug">
                <code>{f.slug}</code>
              </td>
              <td data-rotulo="Endereço de recebimento">
                <code className="cfg-url">{f.url}</code>
              </td>
              <td data-rotulo="Ativo">{f.ativo ? 'Sim' : 'Não'}</td>
              <td data-rotulo="Segredo utilizável">
                {f.segredoUtilizavel ? (
                  'Sim'
                ) : (
                  <>
                    Não <span className="cfg-dica">(gere um segredo novo)</span>
                  </>
                )}
              </td>
              <td>
                <div className="cfg-linha-acoes">
                  <form action={enviar}>
                    <input type="hidden" name="intencao" value="rotacionar" />
                    <input type="hidden" name="id" value={f.id} />
                    <BotaoConfirmar
                      rotulo={f.segredoUtilizavel ? 'Rotacionar segredo' : 'Gerar segredo'}
                      rotuloAcessivel={`Gerar novo segredo da fonte ${f.nome}`}
                      titulo={`Gerar um segredo novo para ${f.nome}?`}
                      texto="O segredo atual para de valer na hora: a plataforma precisa receber o novo, senão os eventos dela passam a ser recusados."
                      confirmar="Gerar segredo novo"
                      desabilitado={pendente}
                    />
                  </form>
                  <form action={enviar}>
                    <input type="hidden" name="intencao" value="alternar" />
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="ativo" value={f.ativo ? '1' : '0'} />
                    <button type="submit" className="cfg-botao" disabled={pendente}>
                      {f.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {criando ? (
        <form action={enviar} className="cfg-form cfg-form-linha">
          <input type="hidden" name="intencao" value="criar" />
          <label className="cfg-campo">
            <span className="cfg-rotulo">Slug</span>
            <input
              name="slug"
              required
              minLength={2}
              maxLength={40}
              pattern="[a-z0-9][a-z0-9\-]*"
              placeholder="ex.: hotmart"
              className="cfg-input"
            />
          </label>
          <label className="cfg-campo">
            <span className="cfg-rotulo">Nome</span>
            <input name="nome" required placeholder="ex.: Hotmart" className="cfg-input" />
          </label>
          <div className="cfg-acoes">
            <button type="submit" className="cfg-botao cfg-botao-primario" disabled={pendente}>
              Criar fonte
            </button>
            <button type="button" className="cfg-botao" onClick={() => setCriando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="cfg-botao cfg-botao-primario cfg-nova"
          onClick={() => setCriando(true)}
        >
          Nova fonte
        </button>
      )}
    </div>
  );
}
