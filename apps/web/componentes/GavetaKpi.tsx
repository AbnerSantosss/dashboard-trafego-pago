'use client';
/**
 * Painel lateral de um card de KPI: o número do card é um consolidado, então o clique abre a
 * mesma métrica por canal (fatia de cada um e de onde sai a conta). Em FTDs, CPA, Depósitos e ROAS
 * cada canal leva à lista de pessoas da etapa (a GavetaFunil, já filtrada no canal); Investimento
 * leva à Gestão de custos, onde os gastos são lançados.
 *
 * Mesmo lugar, mesmas classes e mesmo fechamento da GavetaFunil: Esc ou clique fora (fora do
 * painel, do funil, da tabela e dos cards). Movimento só em transform e opacity, sob no-preference.
 */
import type { LinhaCanalMetrica } from '@trafego/contratos';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { consolidarKpi, ETAPA_DO_KPI, EXPLICA_KPI, formatarDataIso } from '@/lib/regras';
import type { KpiTela } from '@/lib/tela';
import { iconeDoCanal } from '@/lib/tela';
import { IconeCanal, ROTULO_ETAPA, urlLeads } from './FichaLead';
import { Icone } from './Nos';
import './gaveta-funil.css';

interface Props {
  kpi: KpiTela;
  linhas: LinhaCanalMetrica[];
  de: string;
  ate: string;
  canal: string;
  campanha: string;
  /** Abre a lista de pessoas da etapa do KPI; `null` = todos os canais. */
  onCanal: (canal: string | null) => void;
  onFechar: () => void;
}

const SAIDA_MS = 180;

export function GavetaKpi({ kpi, linhas, de, ate, canal, campanha, onCanal, onFechar }: Props) {
  const [saindo, setSaindo] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const saida = useRef<number | undefined>(undefined);
  const etapa = ETAPA_DO_KPI[kpi.id];
  const rotuloEtapa = etapa ? (ROTULO_ETAPA[etapa] ?? etapa) : null;
  const consolidado = consolidarKpi(kpi.id, linhas);

  // Troca de card com o painel aberto: cancela uma saída pendente e devolve o foco ao título.
  useEffect(() => {
    window.clearTimeout(saida.current);
    setSaindo(false);
    titulo.current?.focus();
  }, [kpi.id]);

  useEffect(() => () => window.clearTimeout(saida.current), []);

  function fechar() {
    if (saindo) return;
    const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    setSaindo(true);
    saida.current = window.setTimeout(onFechar, reduz ? 0 : SAIDA_MS);
  }

  useEffect(() => {
    function fora(ev: PointerEvent) {
      const alvo = ev.target as Element;
      if (raiz.current?.contains(alvo)) return;
      if (alvo.closest?.('.area-funil, .alvo-tabela, .alvo-kpi')) return;
      fechar();
    }
    function teclado(ev: KeyboardEvent) {
      if (ev.key !== 'Escape' || ev.defaultPrevented) return;
      ev.preventDefault();
      fechar();
    }
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', teclado);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', teclado);
    };
  });

  const expandir = etapa ? urlLeads({ etapa, de, ate, canal, campanha }) : '/gestao-de-custos';
  const tituloExpandir = etapa
    ? `Abrir a lista de ${rotuloEtapa} em tela cheia, com filtros`
    : 'Abrir a Gestão de custos';

  return (
    <div
      ref={raiz}
      className="gaveta-funil gaveta-kpi"
      data-saindo={saindo || undefined}
      role="dialog"
      aria-modal="false"
      aria-labelledby="gk-titulo"
    >
      <header className="gf-cabeca">
        <div className="gf-cabeca-texto">
          <p className="gf-kicker">
            Consolidado por canal
            {de && ate ? ` · ${formatarDataIso(de)} a ${formatarDataIso(ate)}` : ''}
          </p>
          <h2 id="gk-titulo" ref={titulo} tabIndex={-1}>
            {kpi.rotulo}
          </h2>
          <p className="gk-total">
            <strong>{kpi.valorTexto}</strong>
            {kpi.deltaTexto !== null && (
              <span className="gk-delta" data-tom={kpi.tom}>
                {kpi.direcao === 'baixa' ? '▼' : '▲'} {kpi.deltaTexto}
                <span className="so-leitor"> em relação ao período anterior</span>
              </span>
            )}
          </p>
        </div>
        <Link className="gf-botao-icone" href={expandir} title={tituloExpandir}>
          <Icone nome="expandir" className="gf-icone" />
          <span className="so-leitor">{tituloExpandir}</span>
        </Link>
        <button type="button" className="gf-botao-icone" onClick={fechar}>
          <Icone nome="fechar" className="gf-icone" />
          <span className="so-leitor">Fechar</span>
        </button>
      </header>

      <div className="gf-corpo" data-vista="lista">
        <p className="gk-explica">{EXPLICA_KPI[kpi.id]}</p>

        {consolidado.length === 0 ? (
          <div className="gf-vazio">
            <p>Nenhum canal com dados no período e nos filtros escolhidos.</p>
          </div>
        ) : (
          <ul className="gf-lista" aria-label={`${kpi.rotulo} por canal`}>
            {consolidado.map((l, i) => {
              const cor = iconeDoCanal(l.canal).cor;
              const conteudo = (
                <>
                  <IconeCanal canal={l.canal} />
                  <span className="gf-item-meio">
                    <span className="gf-item-titulo">{l.canal}</span>
                    <span className="gf-item-sub">{l.detalhe}</span>
                    <span className="gk-barra" aria-hidden="true">
                      <span
                        className="gk-barra-cheia"
                        style={{ '--f': l.fracao, background: cor } as CSSProperties}
                      />
                    </span>
                  </span>
                  <span className="gf-item-fim">
                    <span className="gf-item-valor">{l.texto}</span>
                    {etapa && l.temPessoas && (
                      <span className="gk-ver" aria-hidden="true">
                        Ver pessoas
                        <Icone nome="chevron-down" className="gk-ver-icone" />
                      </span>
                    )}
                  </span>
                </>
              );
              return (
                <li key={l.canal} style={{ '--i': Math.min(i, 12) } as CSSProperties}>
                  {etapa && l.temPessoas ? (
                    <button
                      type="button"
                      className="gf-item"
                      onClick={() => onCanal(l.canal)}
                      aria-label={`${l.canal}: ${l.texto}, ${l.detalhe}. Ver a lista de ${rotuloEtapa} de ${l.canal}`}
                    >
                      {conteudo}
                    </button>
                  ) : (
                    <div className="gf-item gf-item-mudo">{conteudo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="gk-acoes">
          {etapa ? (
            <button type="button" className="gk-acao" onClick={() => onCanal(null)}>
              Ver todas as pessoas de {rotuloEtapa}
            </button>
          ) : (
            <Link className="gk-acao" href="/gestao-de-custos">
              Lançar ou revisar gastos
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
