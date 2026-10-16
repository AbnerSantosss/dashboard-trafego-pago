'use client';
/**
 * Painel lateral do funil: clique numa etapa (ou numa célula da tabela por canal, já com o canal
 * escolhido) abre a lista de quem chegou nela e clique numa pessoa abre a ficha, no jeito de um
 * CRM: resumo, origem com UTMs e ids de clique, linha do tempo e o que cada webhook informou.
 * "Expandir" leva a mesma leitura para a tela cheia (/leads), com filtros e paginação.
 *
 * Fica à direita, sobre a tabela, sem cobrir o funil: outra etapa pode ser escolhida com o painel
 * aberto. Esc ou clique fora (fora do painel, do funil e das células da tabela) fecha. Os dados vêm
 * de server actions; a API só responde para analista ou acima.
 *
 * Movimento: só transform e opacity, curva de entrada dos Hyperframes, nada com movimento reduzido.
 */
import type { EventosEtapaResposta, FichaLead } from '@trafego/contratos';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { buscarEtapa, buscarLead, type RespostaFunil } from '@/app/acoes-funil';
import { formatarDataHora, formatarDataIso } from '@/lib/regras';
import { iconeDoCanal } from '@/lib/tela';
import {
  COLETIVO,
  dinheiro,
  ETAPAS_AGREGADAS,
  Estado,
  Ficha,
  IconeCanal,
  inteiro,
  urlLeads,
} from './FichaLead';
import { Icone } from './Nos';
import './gaveta-funil.css';

export { achatarPayload } from './FichaLead';

export interface EtapaAberta {
  id: string;
  rotulo: string;
}

interface Props {
  etapa: EtapaAberta;
  de: string;
  ate: string;
  canal: string;
  campanha: string;
  fuso: string;
  /** Chip de canal já escolhido ao abrir (clique numa linha da tabela por canal). */
  canalInicial?: string | null;
  /** Quem abriu, no kicker (ex.: "FTDs por canal"); sem ele, "Funil" ou "Tabela por canal". */
  origem?: string | undefined;
  onFechar: () => void;
}

/** Duração da saída (a entrada é 260 ms); com movimento reduzido fecha na hora. */
const SAIDA_MS = 180;
/** A gaveta mostra só os mais recentes; o resto fica na tela cheia (/leads). */
const LIMITE_LISTA = 10;

// ---------------------------------------------------------------------------
// Lista da etapa

function Lista({
  etapa,
  resposta,
  fuso,
  canalFiltro,
  setCanalFiltro,
  abrir,
  focoInicial,
  verTodos,
}: {
  etapa: EtapaAberta;
  resposta: EventosEtapaResposta;
  fuso: string;
  canalFiltro: string | null;
  setCanalFiltro: (c: string | null) => void;
  abrir: (leadKey: string) => void;
  focoInicial: string | null;
  /** Mesmo destino do botão Expandir: a lista inteira em /leads, com filtros e paginação. */
  verTodos: string;
}) {
  const coletivo = COLETIVO[etapa.id] ?? 'registros';
  const eventos = canalFiltro
    ? resposta.eventos.filter((e) => e.canal === canalFiltro)
    : resposta.eventos;
  const visiveis = eventos.slice(0, LIMITE_LISTA);
  const totalFiltro = canalFiltro
    ? (resposta.porCanal.find((c) => c.canal === canalFiltro)?.total ?? 0)
    : resposta.total;
  const refFoco = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    refFoco.current?.focus();
  }, []);

  if (resposta.total === 0) {
    return (
      <div className="gf-vazio">
        <p>
          {ETAPAS_AGREGADAS.has(etapa.id)
            ? `${etapa.rotulo} chega somado das plataformas (Meta, disparos de e-mail e SMS), sem dizer quem é cada pessoa. A lista por pessoa começa em Visitas.`
            : `Nenhum registro de ${coletivo} no período e nos filtros escolhidos.`}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="gf-chips" role="group" aria-label="Filtrar por canal">
        <button
          type="button"
          className="gf-chip"
          aria-pressed={canalFiltro === null}
          onClick={() => setCanalFiltro(null)}
        >
          Todos <span className="gf-chip-n">{inteiro(resposta.total)}</span>
        </button>
        {resposta.porCanal.map((c) => (
          <button
            key={c.canal}
            type="button"
            className="gf-chip"
            aria-pressed={canalFiltro === c.canal}
            onClick={() => setCanalFiltro(canalFiltro === c.canal ? null : c.canal)}
          >
            <Icone
              nome={iconeDoCanal(c.canal).nome}
              className="gf-chip-icone"
              estilo={{ color: iconeDoCanal(c.canal).cor }}
            />
            {c.canal} <span className="gf-chip-n">{inteiro(c.total)}</span>
          </button>
        ))}
      </div>

      <ul className="gf-lista" aria-label={`${etapa.rotulo}: ${inteiro(totalFiltro)} ${coletivo}`}>
        {visiveis.map((e, i) => {
          const conteudo = (
            <>
              <IconeCanal canal={e.canal} />
              <span className="gf-item-meio">
                <span className="gf-item-titulo">{e.leadKey ?? 'Visitante sem identificação'}</span>
                <span className="gf-item-sub">
                  {e.canal}
                  {e.campanha ? ` · ${e.campanha}` : ''}
                </span>
              </span>
              <span className="gf-item-fim">
                {e.valor !== null && (
                  <span className="gf-item-valor">{dinheiro(e.valor, e.moeda)}</span>
                )}
                <time dateTime={e.ocorridoEm} className="gf-item-sub">
                  {formatarDataHora(e.ocorridoEm, fuso)}
                </time>
              </span>
            </>
          );
          return (
            <li key={e.id} style={{ '--i': Math.min(i, 12) } as CSSProperties}>
              {e.leadKey ? (
                <button
                  type="button"
                  className="gf-item"
                  ref={e.leadKey === focoInicial ? refFoco : undefined}
                  onClick={() => abrir(e.leadKey!)}
                  aria-label={`${e.leadKey}, ${e.canal}${e.valor !== null ? `, ${dinheiro(e.valor, e.moeda)}` : ''}, ${formatarDataHora(e.ocorridoEm, fuso)}. Abrir ficha`}
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
      {visiveis.length < totalFiltro && (
        <div className="gf-rodape">
          <p>
            Mostrando os {inteiro(visiveis.length)} mais recentes de {inteiro(totalFiltro)}.
          </p>
          <Link className="gf-ver-todos" href={verTodos}>
            Ver todos os {inteiro(totalFiltro)}
            <Icone nome="expandir" className="gf-ver-todos-icone" />
          </Link>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Gaveta

export function GavetaFunil({
  etapa,
  de,
  ate,
  canal,
  campanha,
  fuso,
  canalInicial = null,
  origem,
  onFechar,
}: Props) {
  const [lista, setLista] = useState<RespostaFunil<EventosEtapaResposta> | null>(null);
  const [canalFiltro, setCanalFiltro] = useState<string | null>(null);
  const [leadAberto, setLeadAberto] = useState<string | null>(null);
  const [ultimoLead, setUltimoLead] = useState<string | null>(null);
  const [ficha, setFicha] = useState<RespostaFunil<FichaLead> | null>(null);
  const [saindo, setSaindo] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const saida = useRef<number | undefined>(undefined);

  // Troca de etapa: volta para a lista e busca de novo. Um clique no funil durante a saída
  // cancela o fechamento pendente, senão ele apagaria a etapa recém-aberta.
  useEffect(() => {
    let vivo = true;
    window.clearTimeout(saida.current);
    setSaindo(false);
    setLista(null);
    setCanalFiltro(canalInicial);
    setLeadAberto(null);
    setUltimoLead(null);
    buscarEtapa({ etapa: etapa.id, de, ate, canal, campanha }).then((r) => {
      if (vivo) setLista(r);
    });
    titulo.current?.focus();
    return () => {
      vivo = false;
    };
  }, [etapa, de, ate, canal, campanha, canalInicial]);

  useEffect(() => {
    if (!leadAberto) return;
    let vivo = true;
    setFicha(null);
    buscarLead(leadAberto).then((r) => {
      if (vivo) setFicha(r);
    });
    titulo.current?.focus();
    return () => {
      vivo = false;
    };
  }, [leadAberto]);

  function fechar() {
    if (saindo) return;
    const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    setSaindo(true);
    saida.current = window.setTimeout(onFechar, reduz ? 0 : SAIDA_MS);
  }

  useEffect(() => () => window.clearTimeout(saida.current), []);

  // Clique fora fecha; o funil, as células da tabela e os cards de KPI ficam de fora para trocar
  // de etapa, canal ou métrica com o painel aberto. Esc vale com o foco em qualquer lugar
  // (inclusive numa etapa do funil): na ficha volta, na lista fecha.
  useEffect(() => {
    function fora(ev: PointerEvent) {
      const alvo = ev.target as Node;
      if (raiz.current?.contains(alvo)) return;
      if ((alvo as Element).closest?.('.area-funil, .alvo-tabela, .alvo-kpi')) return;
      fechar();
    }
    function teclado(ev: KeyboardEvent) {
      if (ev.key !== 'Escape' || ev.defaultPrevented) return;
      ev.preventDefault();
      if (leadAberto) voltar();
      else fechar();
    }
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', teclado);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', teclado);
    };
  });

  function abrir(leadKey: string) {
    setUltimoLead(leadKey);
    setLeadAberto(leadKey);
  }

  function voltar() {
    setLeadAberto(null);
    setFicha(null);
  }

  const coletivo = COLETIVO[etapa.id] ?? 'registros';
  const okLista = lista?.ok ? lista.dados : null;
  const periodo = okLista?.periodo ?? (de && ate ? { de, ate } : null);
  const expandir = urlLeads({
    etapa: etapa.id,
    de: periodo?.de,
    ate: periodo?.ate,
    canal: canalFiltro ?? canal,
    campanha,
    lead: leadAberto,
  });

  return (
    <div
      ref={raiz}
      className="gaveta-funil"
      data-saindo={saindo || undefined}
      role="dialog"
      aria-modal="false"
      aria-labelledby="gf-titulo"
    >
      <header className="gf-cabeca">
        {leadAberto ? (
          <button type="button" className="gf-botao-icone" onClick={voltar}>
            <Icone nome="voltar" className="gf-icone" />
            <span className="so-leitor">Voltar para {etapa.rotulo}</span>
          </button>
        ) : null}
        <div className="gf-cabeca-texto">
          <p className="gf-kicker">
            {leadAberto ? (
              <>Ficha do usuário · {etapa.rotulo}</>
            ) : (
              <>
                {origem ?? (canalInicial ? 'Tabela por canal' : 'Funil')}
                {periodo
                  ? ` · ${formatarDataIso(periodo.de)} a ${formatarDataIso(periodo.ate)}`
                  : ''}
              </>
            )}
          </p>
          <h2 id="gf-titulo" ref={titulo} tabIndex={-1}>
            {leadAberto ? (
              <>
                <Icone nome="usuario" className="gf-titulo-icone" />
                {leadAberto}
              </>
            ) : (
              etapa.rotulo
            )}
          </h2>
          {!leadAberto && okLista && okLista.total > 0 && (
            <p className="gf-total">
              <strong>{inteiro(okLista.total)}</strong> {coletivo}
              {okLista.valorTotal !== null && (
                <>
                  {' '}
                  · <strong>{dinheiro(okLista.valorTotal, 'BRL')}</strong>
                </>
              )}
            </p>
          )}
        </div>
        <Link className="gf-botao-icone" href={expandir} title="Abrir em tela cheia, com filtros">
          <Icone nome="expandir" className="gf-icone" />
          <span className="so-leitor">Expandir em tela cheia, com filtros</span>
        </Link>
        <button type="button" className="gf-botao-icone" onClick={fechar}>
          <Icone nome="fechar" className="gf-icone" />
          <span className="so-leitor">Fechar</span>
        </button>
      </header>

      <div
        className="gf-corpo"
        key={leadAberto ?? `lista-${etapa.id}`}
        data-vista={leadAberto ? 'ficha' : 'lista'}
      >
        {leadAberto ? (
          ficha?.ok ? (
            <Ficha ficha={ficha.dados} fuso={fuso} />
          ) : (
            <Estado carregando={!ficha} erro={ficha && !ficha.ok ? ficha.mensagem : null} />
          )
        ) : lista?.ok ? (
          <Lista
            etapa={etapa}
            resposta={lista.dados}
            fuso={fuso}
            canalFiltro={canalFiltro}
            setCanalFiltro={setCanalFiltro}
            abrir={abrir}
            focoInicial={ultimoLead}
            verTodos={expandir}
          />
        ) : (
          <Estado carregando={!lista} erro={lista && !lista.ok ? lista.mensagem : null} />
        )}
      </div>
    </div>
  );
}
