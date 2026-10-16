'use client';
/**
 * Tela expandida da lista por etapa: abas de etapa, filtros (período, canal, campanha, busca e
 * ordem), resumo por canal, tabela paginada e a ficha do usuário num painel ao lado. Os filtros
 * vivem na URL; cada mudança navega dentro de uma transição e a página do servidor busca de novo.
 */
import { ETAPAS_LISTA, type EventosEtapaResposta, type FichaLead } from '@trafego/contratos';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import type { RespostaFunil } from '@/app/acoes-funil';
import {
  COLETIVO,
  ETAPAS_AGREGADAS,
  Estado,
  Ficha,
  IconeCanal,
  NOME_TIPO,
  ORIGEM,
  ROTULO_ETAPA,
  dinheiro,
  inteiro,
  urlLeads,
  type FiltrosLeads,
} from '@/componentes/FichaLead';
import { Icone } from '@/componentes/Nos';
import { POR_PAGINA, type FiltrosLeadsLidos } from '@/lib/leads';
import { formatarDataHora } from '@/lib/regras';

const ORDENS = [
  { id: 'recentes', rotulo: 'Mais recentes' },
  { id: 'antigos', rotulo: 'Mais antigos' },
  { id: 'valor', rotulo: 'Maior valor' },
] as const;

const ETAPAS_COM_VALOR = new Set(['ftd', 'depositos']);

function dataCurta(iso: string) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function TelaLeads({
  filtros,
  lista,
  ficha,
}: {
  filtros: FiltrosLeadsLidos;
  lista: RespostaFunil<EventosEtapaResposta>;
  ficha: RespostaFunil<FichaLead> | null;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  // Lead escolhido antes de a navegação terminar: o painel abre na hora, com esqueleto.
  const [leadPedido, setLeadPedido] = useState<string | null>(filtros.lead);
  const ultimoLead = useRef<string | null>(filtros.lead);
  const tituloFicha = useRef<HTMLHeadingElement>(null);
  const busca = useRef<HTMLInputElement>(null);

  const dados = lista.ok ? lista.dados : null;
  const periodo = dados?.periodo;
  const fuso = dados?.fuso ?? 'America/Sao_Paulo';
  const coletivo = COLETIVO[filtros.etapa] ?? 'registros';
  const comValor = ETAPAS_COM_VALOR.has(filtros.etapa);

  useEffect(() => setLeadPedido(filtros.lead), [filtros.lead]);

  const atual: FiltrosLeads = {
    etapa: filtros.etapa,
    de: filtros.de ?? periodo?.de,
    ate: filtros.ate ?? periodo?.ate,
    canal: filtros.canal,
    campanha: filtros.campanha,
    busca: filtros.busca,
    ordem: filtros.ordem,
    offset: filtros.offset,
    lead: filtros.lead,
  };

  /** Troca filtros: volta à primeira página e fecha a ficha, salvo quando o pedido diz o contrário. */
  function navegar(mudanca: Partial<FiltrosLeads>) {
    const alvo = { ...atual, offset: 0, lead: null, ...mudanca };
    if (alvo.lead !== undefined) setLeadPedido(alvo.lead ?? null);
    iniciar(() => router.push(urlLeads(alvo), { scroll: false }));
  }

  function abrirLead(chave: string) {
    ultimoLead.current = chave;
    navegar({ offset: filtros.offset, lead: chave });
  }

  function fecharFicha() {
    navegar({ offset: filtros.offset, lead: null });
  }

  // Ficha aberta: foco no título. Fechada: foco volta à linha de onde veio.
  const aberto = leadPedido;
  useEffect(() => {
    if (aberto) {
      tituloFicha.current?.focus({ preventScroll: true });
      return;
    }
    const chave = ultimoLead.current;
    if (!chave) return;
    document
      .querySelector<HTMLButtonElement>(`[data-lead="${CSS.escape(chave)}"]`)
      ?.focus({ preventScroll: true });
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) fecharFicha();
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });

  function aplicarBusca(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    navegar({ busca: busca.current?.value ?? '' });
  }

  const temFiltro = Boolean(filtros.canal || filtros.campanha || filtros.busca);
  const opcoesCanal = dados?.opcoes.canais ?? [];
  const opcoesCampanha = dados?.opcoes.campanhas ?? [];
  // Valor da URL que não aparece mais nas opções (outro período, por exemplo) continua escolhível.
  const canais =
    filtros.canal && !opcoesCanal.includes(filtros.canal)
      ? [filtros.canal, ...opcoesCanal]
      : opcoesCanal;
  const campanhas =
    filtros.campanha && !opcoesCampanha.includes(filtros.campanha)
      ? [filtros.campanha, ...opcoesCampanha]
      : opcoesCampanha;

  const inicio = dados && dados.total > 0 ? filtros.offset + 1 : 0;
  const fim = dados ? filtros.offset + dados.eventos.length : 0;

  return (
    <div className="lp" data-pendente={pendente || undefined}>
      <nav className="cfg-abas lp-abas" aria-label="Etapas do funil">
        {ETAPAS_LISTA.map((id) => (
          <Link
            key={id}
            className="cfg-aba"
            href={urlLeads({ ...atual, etapa: id, offset: 0, lead: null })}
            aria-current={id === filtros.etapa ? 'page' : undefined}
            scroll={false}
          >
            {ROTULO_ETAPA[id]}
          </Link>
        ))}
      </nav>

      <div className="lp-filtros" role="search" aria-label={`Filtrar ${coletivo}`}>
        <label className="cfg-campo lp-campo-data">
          <span className="cfg-rotulo">De</span>
          <input
            className="cfg-input"
            type="date"
            value={atual.de ?? ''}
            max={atual.ate}
            onChange={(e) => e.target.value && navegar({ de: e.target.value })}
          />
        </label>
        <label className="cfg-campo lp-campo-data">
          <span className="cfg-rotulo">Até</span>
          <input
            className="cfg-input"
            type="date"
            value={atual.ate ?? ''}
            min={atual.de}
            onChange={(e) => e.target.value && navegar({ ate: e.target.value })}
          />
        </label>
        <label className="cfg-campo">
          <span className="cfg-rotulo">Canal</span>
          <select
            className="cfg-input"
            value={filtros.canal ?? 'todos'}
            onChange={(e) => navegar({ canal: e.target.value })}
          >
            <option value="todos">Todos os canais</option>
            {canais.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="cfg-campo">
          <span className="cfg-rotulo">Campanha</span>
          <select
            className="cfg-input"
            value={filtros.campanha ?? 'todas'}
            onChange={(e) => navegar({ campanha: e.target.value })}
          >
            <option value="todas">Todas as campanhas</option>
            {campanhas.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="cfg-campo">
          <span className="cfg-rotulo">Ordem</span>
          <select
            className="cfg-input"
            value={comValor || filtros.ordem !== 'valor' ? filtros.ordem : 'recentes'}
            onChange={(e) => navegar({ ordem: e.target.value })}
          >
            {ORDENS.filter((o) => o.id !== 'valor' || comValor).map((o) => (
              <option key={o.id} value={o.id}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>
        <form className="cfg-campo lp-busca" onSubmit={aplicarBusca}>
          <label className="cfg-rotulo" htmlFor="lp-busca">
            Buscar
          </label>
          <div className="lp-busca-linha">
            <Icone nome="buscar" className="lp-busca-icone" />
            <input
              ref={busca}
              id="lp-busca"
              key={filtros.busca}
              className="cfg-input"
              type="search"
              name="busca"
              defaultValue={filtros.busca}
              maxLength={100}
              placeholder="Id do usuário ou campanha"
              autoComplete="off"
              enterKeyHint="search"
            />
            <button type="submit" className="cfg-botao">
              Buscar
            </button>
          </div>
        </form>
        {temFiltro && (
          <button
            type="button"
            className="cfg-botao lp-limpar"
            onClick={() => navegar({ canal: null, campanha: null, busca: '' })}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {!lista.ok ? (
        <p className="cfg-faixa-erro" role="alert">
          {lista.mensagem}
        </p>
      ) : (
        <div className="lp-corpo" data-ficha={aberto ? '' : undefined}>
          <section className="lp-lista" aria-labelledby="lp-resumo" aria-busy={pendente}>
            <div className="lp-resumo">
              <p id="lp-resumo" className="lp-total" aria-live="polite">
                <strong>{inteiro(dados!.total)}</strong> {coletivo}
                {dados!.valorTotal !== null && (
                  <>
                    {' '}
                    · <strong>{dinheiro(dados!.valorTotal, 'BRL')}</strong>
                  </>
                )}
                <span className="lp-periodo">
                  {' '}
                  · {dataCurta(dados!.periodo.de)} a {dataCurta(dados!.periodo.ate)}
                </span>
              </p>
              {dados!.porCanal.length > 0 && (
                <div className="gf-chips lp-chips" role="group" aria-label="Total por canal">
                  {dados!.porCanal.map((c) => (
                    <button
                      key={c.canal}
                      type="button"
                      className="gf-chip"
                      aria-pressed={filtros.canal === c.canal}
                      onClick={() => navegar({ canal: filtros.canal === c.canal ? null : c.canal })}
                    >
                      <IconeCanal canal={c.canal} />
                      {c.canal} <span className="gf-chip-n">{inteiro(c.total)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {dados!.eventos.length === 0 ? (
              <div className="lp-vazio">
                <p>
                  {ETAPAS_AGREGADAS.has(filtros.etapa)
                    ? `${ROTULO_ETAPA[filtros.etapa]} chega somado das plataformas (Meta, disparos de e-mail e SMS), sem dizer quem é cada pessoa. A lista por pessoa começa em Visitas.`
                    : temFiltro
                      ? `Nenhum registro de ${coletivo} com esses filtros.`
                      : `Nenhum registro de ${coletivo} no período.`}
                </p>
                {ETAPAS_AGREGADAS.has(filtros.etapa) ? (
                  <button
                    type="button"
                    className="cfg-botao"
                    onClick={() => navegar({ etapa: 'visitas' })}
                  >
                    Ver visitas ao site
                  </button>
                ) : temFiltro ? (
                  <button
                    type="button"
                    className="cfg-botao"
                    onClick={() => navegar({ canal: null, campanha: null, busca: '' })}
                  >
                    Limpar filtros
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="lp-rolagem">
                <table className="cfg-tabela lp-tabela">
                  <caption className="so-leitor">
                    {ROTULO_ETAPA[filtros.etapa]}: {inicio} a {fim} de {dados!.total}. Escolha um
                    usuário para abrir a ficha.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Usuário</th>
                      <th scope="col">Canal</th>
                      <th scope="col">Campanha</th>
                      <th scope="col" className="lp-opcional">
                        UTM
                      </th>
                      {comValor && (
                        <th scope="col" className="lp-num">
                          Valor
                        </th>
                      )}
                      <th scope="col">Data</th>
                      <th scope="col" className="lp-opcional">
                        Origem
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados!.eventos.map((e) => {
                      const ativo = e.leadKey !== null && e.leadKey === aberto;
                      return (
                        <tr
                          key={e.id}
                          data-ativo={ativo || undefined}
                          onClick={
                            e.leadKey
                              ? (ev) => {
                                  if ((ev.target as HTMLElement).closest('button')) return;
                                  abrirLead(e.leadKey!);
                                }
                              : undefined
                          }
                        >
                          <th scope="row">
                            {e.leadKey ? (
                              <button
                                type="button"
                                className="lp-usuario"
                                data-lead={e.leadKey}
                                aria-current={ativo || undefined}
                                onClick={() => abrirLead(e.leadKey!)}
                              >
                                {e.leadKey}
                                <span className="so-leitor">: abrir a ficha</span>
                              </button>
                            ) : (
                              <span className="lp-anonimo">Sem identificação</span>
                            )}
                            {filtros.etapa === 'depositos' && (
                              <span className="lp-tipo" data-tipo={e.tipo}>
                                {e.tipo === 'ftd' ? 'FTD' : NOME_TIPO[e.tipo]}
                              </span>
                            )}
                          </th>
                          <td data-rotulo="Canal">
                            <span className="lp-canal">
                              <IconeCanal canal={e.canal} />
                              {e.canal}
                            </span>
                          </td>
                          <td className="lp-campanha" data-rotulo="Campanha">
                            {e.campanha || '—'}
                          </td>
                          <td className="lp-opcional lp-utm" data-rotulo="UTM">
                            {e.utmSource || e.utmMedium
                              ? [e.utmSource, e.utmMedium].filter(Boolean).join(' / ')
                              : '—'}
                          </td>
                          {comValor && (
                            <td className="lp-num" data-rotulo="Valor">
                              {e.valor !== null ? dinheiro(e.valor, e.moeda) : '—'}
                            </td>
                          )}
                          <td className="lp-data" data-rotulo="Data">
                            {formatarDataHora(e.ocorridoEm, fuso)}
                          </td>
                          <td className="lp-opcional lp-origem" data-rotulo="Origem">
                            {ORIGEM[e.origem]}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {dados!.total > POR_PAGINA && (
              <nav className="lp-paginas" aria-label="Páginas">
                <p>
                  {inteiro(inicio)}–{inteiro(fim)} de {inteiro(dados!.total)}
                </p>
                <button
                  type="button"
                  className="cfg-botao"
                  disabled={filtros.offset === 0}
                  onClick={() => navegar({ offset: Math.max(0, filtros.offset - POR_PAGINA) })}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="cfg-botao"
                  disabled={fim >= dados!.total}
                  onClick={() => navegar({ offset: filtros.offset + POR_PAGINA })}
                >
                  Próxima
                </button>
              </nav>
            )}
          </section>

          {aberto && (
            <>
              <div className="lp-veu" aria-hidden="true" onClick={fecharFicha} />
              <aside className="gaveta-funil lp-ficha" aria-labelledby="lp-ficha-titulo">
                <header className="gf-cabeca">
                  <div className="gf-cabeca-texto">
                    <p className="gf-kicker">Ficha do usuário</p>
                    <h2 id="lp-ficha-titulo" ref={tituloFicha} tabIndex={-1}>
                      <Icone nome="usuario" className="gf-titulo-icone" />
                      {aberto}
                    </h2>
                  </div>
                  <button type="button" className="gf-botao-icone" onClick={fecharFicha}>
                    <Icone nome="fechar" className="gf-icone" />
                    <span className="so-leitor">Fechar a ficha</span>
                  </button>
                </header>
                <div className="gf-corpo" key={aberto}>
                  {ficha?.ok && ficha.dados.leadKey === aberto ? (
                    <Ficha ficha={ficha.dados} fuso={fuso} />
                  ) : (
                    <Estado
                      carregando={!ficha || ficha.ok || pendente}
                      erro={ficha && !ficha.ok && !pendente ? ficha.mensagem : null}
                    />
                  )}
                </div>
              </aside>
            </>
          )}
        </div>
      )}
    </div>
  );
}
