'use client';
import type { CustoResumo } from '@trafego/contratos';
import { useActionState } from 'react';
import { acaoGastos } from '../acoes';
import { BotaoConfirmar } from '../Confirmar';
import { CANAIS_SUGERIDOS, ESTADO_INICIAL, formatarDia, formatarReais } from '../validacao';

export function PainelGastos({ custos, hoje }: { custos: CustoResumo[]; hoje: string }) {
  const [estado, enviar, pendente] = useActionState(acaoGastos, ESTADO_INICIAL);

  return (
    <div className="cfg-gastos">
      <form action={enviar} className="cfg-form cfg-form-linha" aria-label="Lançar gasto">
        <input type="hidden" name="intencao" value="lancar" />
        <label className="cfg-campo">
          <span className="cfg-rotulo">Data</span>
          <input
            type="date"
            name="dia"
            required
            defaultValue={hoje}
            max={hoje}
            className="cfg-input"
          />
        </label>
        <label className="cfg-campo">
          <span className="cfg-rotulo">Canal</span>
          <input
            name="canal"
            required
            maxLength={40}
            list="canais-gasto"
            placeholder="ex.: Google"
            className="cfg-input"
          />
          <datalist id="canais-gasto">
            {CANAIS_SUGERIDOS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="cfg-campo">
          <span className="cfg-rotulo">Campanha (opcional)</span>
          <input name="campanha" maxLength={120} className="cfg-input" />
        </label>
        <label className="cfg-campo">
          <span className="cfg-rotulo">Valor (R$)</span>
          <input
            name="valor"
            required
            inputMode="decimal"
            placeholder="150,00"
            autoComplete="off"
            className="cfg-input cfg-input-valor"
          />
        </label>
        <label className="cfg-campo">
          <span className="cfg-rotulo">Observação (opcional)</span>
          <input name="descricao" maxLength={200} className="cfg-input" />
        </label>
        <div className="cfg-acoes">
          <button type="submit" className="cfg-botao cfg-botao-primario" disabled={pendente}>
            Lançar gasto
          </button>
        </div>
      </form>
      {estado.mensagem && (
        <p className={estado.ok ? 'cfg-sucesso' : 'cfg-erro'} role="status">
          {estado.mensagem}
        </p>
      )}

      <table className="cfg-tabela">
        <thead>
          <tr>
            <th>Data</th>
            <th>Canal</th>
            <th>Campanha</th>
            <th className="cfg-num">Valor</th>
            <th>Origem</th>
            <th>
              <span className="so-leitor">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {custos.length === 0 && (
            <tr>
              <td colSpan={6} className="cfg-vazio">
                Nenhum gasto no período.
              </td>
            </tr>
          )}
          {custos.map((c) => (
            <tr key={c.id}>
              <td data-rotulo="Data">{formatarDia(c.dia)}</td>
              <td data-rotulo="Canal">{c.canal}</td>
              <td data-rotulo="Campanha">
                {c.campanha || '—'}
                {c.descricao && <span className="cfg-dica cfg-bloco-linha">{c.descricao}</span>}
              </td>
              <td data-rotulo="Valor" className="cfg-num">
                {formatarReais(c.valor)}
              </td>
              <td data-rotulo="Origem">
                {c.origem === 'meta' ? `Meta Ads${c.conta ? ` · ${c.conta}` : ''}` : 'Manual'}
              </td>
              <td>
                {c.origem === 'manual' ? (
                  <form action={enviar}>
                    <input type="hidden" name="intencao" value="remover" />
                    <input type="hidden" name="id" value={c.id} />
                    <BotaoConfirmar
                      rotulo="Remover"
                      rotuloAcessivel={`Remover gasto de ${formatarReais(c.valor)} em ${formatarDia(c.dia)}`}
                      titulo="Remover este gasto?"
                      texto={`${formatarReais(c.valor)} em ${c.canal}, ${formatarDia(c.dia)}. O Investimento do painel nesse dia diminui na hora.`}
                      confirmar="Remover gasto"
                      desabilitado={pendente}
                    />
                  </form>
                ) : (
                  <span className="cfg-dica">Sincronizado</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
