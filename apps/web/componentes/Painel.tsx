'use client';
/**
 * Visão Geral (P4.1/P4.2/P4.5/P4.6/P4.7): desenha a tela na geometria do protótipo e sobrepõe os
 * controles reais (filtros, ordenação, exportar). O estado dos filtros vive na URL; mudar um filtro
 * navega e o Server Component refaz a busca.
 *
 * Acessibilidade: os controles são alvos transparentes sobre o desenho (o repouso é o do protótipo).
 * A tabela desenhada fica oculta do leitor de tela; quem a lê é a tabela semântica sobreposta
 * (cabeçalhos com aria-sort e células que são botões transparentes sobre o desenho). Clicar numa
 * célula abre a mesma gaveta do funil, já com o canal da linha e a etapa da coluna; as setas movem
 * entre as células (um só ponto de Tab para a tabela inteira).
 */
import type { VisaoGeralResposta } from '@trafego/contratos';
import { Funil } from '@trafego/graficos';
import { usePathname, useRouter } from 'next/navigation';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { etapasFunil, montarConteudo } from '@/lib/conteudo';
import {
  atalhoAtivo,
  ATALHOS_PERIODO,
  gerarCsv,
  montarBusca,
  periodoDoAtalho,
  nomeArquivoCsv,
  ordenarLinhas,
  COLUNAS_DADO,
  ETAPA_DO_KPI,
  proximaOrdenacao,
  ROTULOS_CSV,
  type ColunaTabela,
  type Filtros,
  type Ordenacao,
} from '@/lib/regras';
import {
  COL_X,
  ENTRADA,
  EXPORTAR_GEO,
  FILTROS_GEO,
  FUNIL_GEO,
  geometriaInfo,
  ID_CONTEUDO,
  INFOS,
  KPI_ALVOS,
  LIMPAR_GEO,
  linhaY,
  montarPrincipal,
  type InfoTela,
} from '@/lib/tela';
import { ROTULO_ETAPA } from './FichaLead';
import { GavetaFunil, type EtapaAberta } from './GavetaFunil';
import { GavetaKpi } from './GavetaKpi';
import { Nos } from './Nos';

interface Props {
  dados: VisaoGeralResposta | null;
  erro: string | null;
  filtros: Filtros;
}

/** Colunas clicáveis do cabeçalho: [coluna, x inicial, x final, y inicial, altura]. */
const ALVOS_ORDENACAO: [ColunaTabela, number, number, number, number][] = [
  ['canal', COL_X[0]!, COL_X[1]!, 331, 60],
  ['investimento', COL_X[1]!, COL_X[2]!, 331, 60],
  ['cliques', COL_X[2]!, COL_X[3]!, 331, 60],
  ['visitas', COL_X[3]!, COL_X[4]!, 331, 60],
  ['cadastros', COL_X[4]!, COL_X[5]!, 331, 60],
  ['ftdsQtd', COL_X[5]!, COL_X[6]!, 361, 30],
  ['ftdsValor', COL_X[6]!, COL_X[7]!, 361, 30],
  ['depositos', COL_X[7]!, COL_X[8]!, 331, 60],
  ['cpa', COL_X[8]!, COL_X[9]!, 331, 60],
  ['roas', COL_X[9]!, COL_X[10]!, 331, 60],
];

const COLUNAS_TABELA: ColunaTabela[] = ['canal', ...COLUNAS_DADO];

/**
 * Lista que cada coluna da tabela abre. Investimento e CPA não têm registro por pessoa e abrem os
 * FTDs (o que o gasto comprou); ROAS abre os depósitos (o que ele mede).
 */
export const ETAPA_DA_COLUNA: Record<ColunaTabela, string> = {
  canal: 'ftd',
  investimento: 'ftd',
  cliques: 'cliques',
  visitas: 'visitas',
  cadastros: 'cadastro',
  ftdsQtd: 'ftd',
  ftdsValor: 'ftd',
  depositos: 'depositos',
  cpa: 'ftd',
  roas: 'depositos',
};

/** Gaveta aberta: etapa, canal escolhido (linha da tabela) e a célula que abriu (`i-j`). */
/** `celula` guarda quem abriu (célula "i-j" da tabela ou card "kpi-i") para devolver o foco. */
type Abertura = EtapaAberta & { canal: string | null; celula: string | null; origem?: string };

const SETAS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/** Valor de aria-sort do cabeçalho da coluna, dado o estado da ordenação. */
export function ariaSort(ordem: Ordenacao | null, coluna: ColunaTabela) {
  if (ordem?.coluna !== coluna) return 'none' as const;
  return ordem.direcao === 'asc' ? ('ascending' as const) : ('descending' as const);
}

function baixar(nome: string, url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
}

/**
 * Menu ou popover que fecha com Esc ou clique fora. Ao abrir, o foco vai ao primeiro controle do
 * painel; com Esc (ou clique fora que deixaria o foco perdido) ele volta ao botão que abriu.
 */
function useFechavel(
  aberto: boolean,
  fechar: () => void,
  botao: RefObject<HTMLElement | null>,
  painel: RefObject<HTMLElement | null>,
) {
  const fecharRef = useRef(fechar);
  useEffect(() => {
    fecharRef.current = fechar;
  });
  useEffect(() => {
    if (!aberto) return;
    painel.current
      ?.querySelector<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]')
      ?.focus();
    function aoTeclar(e: globalThis.KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      fecharRef.current();
      botao.current?.focus();
    }
    function aoApontar(e: PointerEvent) {
      const alvo = e.target as Node;
      if (painel.current?.contains(alvo) || botao.current?.contains(alvo)) return;
      fecharRef.current();
      // Se o clique não levou o foco a outro controle, ele volta ao botão em vez de se perder.
      setTimeout(() => {
        const ativo = document.activeElement;
        if (!ativo || ativo === document.body) botao.current?.focus();
      }, 0);
    }
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('pointerdown', aoApontar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('pointerdown', aoApontar);
    };
  }, [aberto, botao, painel]);
}

/** Setas, Home e End movem o foco entre os itens do menu; Tab fecha o menu. */
function navegarMenu(e: KeyboardEvent<HTMLElement>, fechar: () => void) {
  if (e.key === 'Tab') {
    fechar();
    return;
  }
  const itens = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'),
  );
  if (itens.length === 0) return;
  const atual = itens.indexOf(document.activeElement as HTMLElement);
  let proximo: number | null = null;
  if (e.key === 'ArrowDown') proximo = (atual + 1) % itens.length;
  else if (e.key === 'ArrowUp') proximo = (atual - 1 + itens.length) % itens.length;
  else if (e.key === 'Home') proximo = 0;
  else if (e.key === 'End') proximo = itens.length - 1;
  if (proximo === null) return;
  e.preventDefault();
  itens[proximo]?.focus();
}

/**
 * Ícone ⓘ: botão transparente sobre o desenho com dica (role="tooltip") ligada por
 * aria-describedby. Abre no foco e no hover, continua aberta com o ponteiro sobre ela e fecha com
 * Esc, ao sair o foco ou ao sair o ponteiro. Em repouso não desenha nada (a dica fica `hidden`).
 */
function Dica({ info }: { info: InfoTela }) {
  const id = useId();
  const [aberta, setAberta] = useState(false);
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { alvo, dica } = geometriaInfo(info);

  useEffect(() => {
    if (!aberta) return;
    function aoTeclar(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setAberta(false);
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberta]);
  useEffect(() => () => clearTimeout(espera.current), []);

  const abrir = () => {
    clearTimeout(espera.current);
    setAberta(true);
  };
  const fecharEmBreve = () => {
    clearTimeout(espera.current);
    espera.current = setTimeout(() => setAberta(false), 150);
  };

  return (
    <>
      <button
        type="button"
        className="alvo alvo-info"
        style={alvo}
        aria-label={info.rotulo}
        aria-describedby={id}
        onFocus={abrir}
        onBlur={() => setAberta(false)}
        onMouseEnter={abrir}
        onMouseLeave={fecharEmBreve}
        onClick={abrir}
      />
      <p
        id={id}
        role="tooltip"
        className="dica"
        style={dica}
        hidden={!aberta}
        onMouseEnter={abrir}
        onMouseLeave={fecharEmBreve}
      >
        {info.texto}
      </p>
    </>
  );
}

export function Painel({ dados, erro, filtros }: Props) {
  const router = useRouter();
  const caminho = usePathname();
  const [pendente, iniciar] = useTransition();
  const [ordem, setOrdem] = useState<Ordenacao | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [periodoAberto, setPeriodoAberto] = useState(false);
  const [etapaAberta, setEtapaAberta] = useState<Abertura | null>(null);
  const [kpiAberto, setKpiAberto] = useState<number | null>(null);
  const [focoCelula, setFocoCelula] = useState<[number, number]>([0, 0]);
  const principal = useRef<HTMLElement>(null);
  const botaoExportar = useRef<HTMLButtonElement>(null);
  const menuExportar = useRef<HTMLDivElement>(null);
  const botaoPeriodo = useRef<HTMLButtonElement>(null);
  const popoverPeriodo = useRef<HTMLFormElement>(null);
  const idMenu = useId();
  const idPeriodo = useId();

  useFechavel(menuAberto, () => setMenuAberto(false), botaoExportar, menuExportar);
  useFechavel(periodoAberto, () => setPeriodoAberto(false), botaoPeriodo, popoverPeriodo);

  const linhas = useMemo(() => ordenarLinhas(dados?.canais ?? [], ordem), [dados, ordem]);
  const conteudo = montarConteudo(dados, filtros, linhas);
  const nos = useMemo(() => montarPrincipal(conteudo), [conteudo]);
  const etapasDoFunil = useMemo(() => (dados ? etapasFunil(dados) : []), [dados]);
  const de = dados?.periodo.de ?? filtros.de ?? '';
  const ate = dados?.periodo.ate ?? filtros.ate ?? '';

  function aplicar(mudanca: Partial<Filtros>) {
    const novoDe = mudanca.de ?? filtros.de ?? de;
    const novoAte = mudanca.ate ?? filtros.ate ?? ate;
    const proximo: Filtros = {
      comparar: mudanca.comparar ?? filtros.comparar,
      canal: mudanca.canal ?? filtros.canal,
      campanha: mudanca.campanha ?? filtros.campanha,
      ...(novoDe ? { de: novoDe } : {}),
      ...(novoAte ? { ate: novoAte } : {}),
    };
    const busca = montarBusca(proximo);
    iniciar(() => router.push(busca ? `${caminho}?${busca}` : caminho, { scroll: false }));
  }

  const fuso = dados?.apresentacao.timezone ?? 'America/Sao_Paulo';
  const atalhoAberto = periodoAberto && de && ate ? atalhoAtivo(de, ate, new Date(), fuso) : null;

  function escolherPeriodo(p: { de: string; ate: string }) {
    setPeriodoAberto(false);
    botaoPeriodo.current?.focus();
    aplicar(p);
  }

  function fecharMenu() {
    setMenuAberto(false);
    botaoExportar.current?.focus();
  }

  function exportarCsv() {
    fecharMenu();
    const csv = gerarCsv(linhas, dados?.total ?? null);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    baixar(nomeArquivoCsv(de, ate), url);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportarPng() {
    // Sem devolver o foco antes da captura: o contorno de foco sairia no PNG.
    setMenuAberto(false);
    if (!principal.current) return;
    const { toPng } = await import('html-to-image');
    const url = await toPng(principal.current, { pixelRatio: window.devicePixelRatio || 1 });
    baixar(`visao-geral_${de}_${ate}.png`, url);
    botaoExportar.current?.focus();
  }

  const canais = dados?.opcoes.canais ?? [];
  const campanhas = dados?.opcoes.campanhas ?? [];
  const geo = (id: string) => FILTROS_GEO[id]!.campo;
  const caixaCampo = (id: string) => {
    const [x, y, w, h] = geo(id);
    return { left: x, top: y - 25, width: w, height: h + 25 };
  };
  const tabela = conteudo.tabela;
  // Linhas da tabela semântica: canais e, por último, o total (`canal: null`, sem filtro de canal).
  const linhasTabela: { canal: string | null; valores: string[] }[] = [
    ...tabela.linhas.map((l) => ({ canal: l.canal, valores: [l.canal, ...l.celulas] })),
    ...(tabela.total ? [{ canal: null, valores: ['Total', ...tabela.total] }] : []),
  ];
  // Um só ponto de Tab na tabela: a última célula focada (volta ao início se a linha sumiu).
  const celulaTabulavel = focoCelula[0] < linhasTabela.length ? focoCelula : [0, 0];

  function moverCelula(ev: KeyboardEvent<HTMLButtonElement>, i: number, j: number) {
    const ultimaLinha = linhasTabela.length - 1;
    const ultimaColuna = COLUNAS_TABELA.length - 1;
    const passo = SETAS[ev.key];
    let alvo: [number, number] | null = null;
    if (passo) {
      alvo = [
        Math.min(ultimaLinha, Math.max(0, i + passo[0])),
        Math.min(ultimaColuna, Math.max(0, j + passo[1])),
      ];
    } else if (ev.key === 'Home') alvo = ev.ctrlKey ? [0, 0] : [i, 0];
    else if (ev.key === 'End') alvo = ev.ctrlKey ? [ultimaLinha, ultimaColuna] : [i, ultimaColuna];
    if (!alvo) return;
    ev.preventDefault();
    setFocoCelula(alvo);
    principal.current
      ?.querySelector<HTMLButtonElement>(`[data-celula="${alvo[0]}-${alvo[1]}"]`)
      ?.focus();
  }

  return (
    <main id={ID_CONTEUDO} tabIndex={-1} className="principal" ref={principal} aria-busy={pendente}>
      <h1 className="so-leitor">{conteudo.titulo}</h1>
      <Nos nos={nos} />

      {/* Exportar */}
      <button
        ref={botaoExportar}
        type="button"
        className="alvo"
        style={{
          left: EXPORTAR_GEO.x,
          top: EXPORTAR_GEO.y,
          width: EXPORTAR_GEO.w,
          height: EXPORTAR_GEO.h,
        }}
        aria-label="Exportar dados"
        aria-haspopup="menu"
        aria-expanded={menuAberto}
        aria-controls={menuAberto ? idMenu : undefined}
        onClick={() => setMenuAberto((v) => !v)}
      />
      {menuAberto && (
        <div
          ref={menuExportar}
          id={idMenu}
          className="menu-exportar"
          role="menu"
          aria-label="Exportar dados"
          style={{ left: EXPORTAR_GEO.x, top: 64 }}
          onKeyDown={(e) => navegarMenu(e, () => setMenuAberto(false))}
        >
          <button type="button" role="menuitem" onClick={exportarCsv} disabled={!dados}>
            CSV (tabela por canal)
          </button>
          <button type="button" role="menuitem" onClick={exportarPng}>
            PNG (tela)
          </button>
        </div>
      )}

      {/* Filtros */}
      <section aria-label="Filtros">
        <button
          ref={botaoPeriodo}
          type="button"
          className="alvo"
          style={caixaCampo('periodo')}
          aria-label={`Período: ${conteudo.filtros[0]?.valor ?? ''}`}
          aria-haspopup="dialog"
          aria-expanded={periodoAberto}
          aria-controls={periodoAberto ? idPeriodo : undefined}
          onClick={() => setPeriodoAberto((v) => !v)}
        />
        {periodoAberto && (
          <form
            ref={popoverPeriodo}
            id={idPeriodo}
            role="dialog"
            aria-label="Escolher período"
            className="popover-periodo"
            style={{ left: 199, top: 142 }}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const [d1, d2] = [String(f.get('de') || ''), String(f.get('ate') || '')];
              escolherPeriodo(d1 <= d2 ? { de: d1, ate: d2 } : { de: d2, ate: d1 });
            }}
          >
            <div className="pp-atalhos" role="group" aria-label="Atalhos de período">
              {ATALHOS_PERIODO.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={atalhoAberto === a.id}
                  onClick={() => escolherPeriodo(periodoDoAtalho(a.id, new Date(), fuso))}
                >
                  {a.rotulo}
                </button>
              ))}
            </div>
            <fieldset className="pp-personalizada">
              <legend>Data personalizada</legend>
              <label>
                De
                <input type="date" name="de" defaultValue={de} required />
              </label>
              <label>
                Até
                <input type="date" name="ate" defaultValue={ate} required />
              </label>
              <button type="submit">Aplicar</button>
            </fieldset>
          </form>
        )}
        <div className="alvo-select" style={caixaCampo('comparar')}>
          <select
            aria-label="Comparar com"
            value={filtros.comparar}
            onChange={(e) => aplicar({ comparar: e.target.value as Filtros['comparar'] })}
          >
            <option value="anterior">Período anterior</option>
            <option value="nenhum">Nenhum</option>
          </select>
        </div>
        <div className="alvo-select" style={caixaCampo('canal')}>
          <select
            aria-label="Canal"
            value={filtros.canal}
            onChange={(e) => aplicar({ canal: e.target.value, campanha: 'todas' })}
          >
            <option value="todos">Todos</option>
            {canais.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="alvo-select" style={caixaCampo('campanha')}>
          <select
            aria-label="Campanha"
            value={filtros.campanha}
            onChange={(e) => aplicar({ campanha: e.target.value })}
          >
            <option value="todas">Todas</option>
            {campanhas.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="alvo"
          style={{
            left: LIMPAR_GEO.x,
            top: LIMPAR_GEO.y,
            width: LIMPAR_GEO.w,
            height: LIMPAR_GEO.h,
          }}
          aria-label="Limpar filtros"
          onClick={() => iniciar(() => router.push(caminho, { scroll: false }))}
        />
      </section>

      {/* Cards de KPI: cada número é um consolidado; o clique abre a mesma métrica por canal. */}
      {dados &&
        conteudo.kpis.slice(0, KPI_ALVOS.length).map((k, i) => {
          const g = KPI_ALVOS[i]!;
          const chave = `kpi-${i}`;
          return (
            <button
              key={k.id}
              type="button"
              className="alvo alvo-kpi"
              data-celula={chave}
              data-ativo={kpiAberto === i || etapaAberta?.celula === chave || undefined}
              aria-expanded={kpiAberto === i}
              style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
              aria-label={`${k.rotulo}: ${k.valorTexto}. Ver por canal`}
              onClick={() => {
                setEtapaAberta(null);
                setKpiAberto((atual) => (atual === i ? null : i));
              }}
            />
          );
        })}

      {/* Funil (componente de @trafego/graficos) */}
      <section
        className="area-funil"
        aria-label="Funil de Aquisição"
        style={{
          // O viewBox do <Funil> começa em y=322 (VIEWBOX de @trafego/graficos): o topo é absoluto.
          left: FUNIL_GEO.x,
          top: 322,
          width: FUNIL_GEO.w,
          height: 322,
        }}
      >
        {dados && (
          <Funil
            etapas={etapasDoFunil}
            largura={FUNIL_GEO.w}
            atrasoMs={ENTRADA.desenhoFunilMs}
            etapaAtiva={etapaAberta?.id ?? null}
            onEtapa={(id) => {
              const e = etapasDoFunil.find((x) => x.id === id);
              if (!e) return;
              setKpiAberto(null);
              setEtapaAberta({ id, rotulo: e.rotulo, canal: null, celula: null });
            }}
          />
        )}
      </section>

      {/* Clique numa etapa do funil: lista de quem chegou nela e ficha de cada pessoa. */}
      {dados && etapaAberta && (
        <GavetaFunil
          etapa={etapaAberta}
          de={dados.periodo.de}
          ate={dados.periodo.ate}
          canal={filtros.canal}
          campanha={filtros.campanha}
          fuso={dados.apresentacao.timezone}
          canalInicial={etapaAberta.canal}
          origem={etapaAberta.origem}
          onFechar={() => {
            const { id, celula } = etapaAberta;
            setEtapaAberta(null);
            // Devolve o foco à etapa do funil ou à célula da tabela que abriu o painel.
            const seletor = celula
              ? `[data-celula="${celula}"]`
              : `.area-funil [data-etapa="${CSS.escape(id)}"]`;
            principal.current?.querySelector<HTMLElement | SVGGElement>(seletor)?.focus();
          }}
        />
      )}

      {/* Clique num card de KPI: o consolidado por canal; cada canal leva à lista de pessoas. */}
      {dados && kpiAberto !== null && conteudo.kpis[kpiAberto] && (
        <GavetaKpi
          kpi={conteudo.kpis[kpiAberto]!}
          linhas={dados.canais}
          de={dados.periodo.de}
          ate={dados.periodo.ate}
          canal={filtros.canal}
          campanha={filtros.campanha}
          onCanal={(canal) => {
            const k = conteudo.kpis[kpiAberto]!;
            const etapa = ETAPA_DO_KPI[k.id];
            if (!etapa) return;
            setKpiAberto(null);
            setEtapaAberta({
              id: etapa,
              rotulo: ROTULO_ETAPA[etapa] ?? etapa,
              canal,
              celula: `kpi-${kpiAberto}`,
              origem: `${k.rotulo} por canal`,
            });
          }}
          onFechar={() => {
            const i = kpiAberto;
            setKpiAberto(null);
            principal.current?.querySelector<HTMLElement>(`[data-celula="kpi-${i}"]`)?.focus();
          }}
        />
      )}

      {/* Tabela semântica: cabeçalhos com ordenação sobre o desenho e linhas só para leitor. */}
      <div role="table" aria-label={tabela.titulo}>
        <div role="row">
          {ALVOS_ORDENACAO.map(([coluna, x0, x1, y, h]) => {
            const sort = ariaSort(ordem, coluna);
            const rotulo = ROTULOS_CSV[coluna];
            return (
              <div key={coluna} role="columnheader" aria-sort={sort} aria-label={rotulo}>
                <button
                  type="button"
                  className="alvo"
                  style={{ left: x0, top: y, width: x1 - x0, height: h }}
                  aria-label={`Ordenar por ${rotulo}`}
                  onClick={() => setOrdem((o) => proximaOrdenacao(o, coluna))}
                >
                  {sort !== 'none' && (
                    <span className="indicador-ordem" aria-hidden="true">
                      {sort === 'ascending' ? '▲' : '▼'}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        {linhasTabela.map(({ canal, valores }, i) =>
          dados ? (
            <div
              key={`${canal ?? 'total'}-${i}`}
              role="row"
              className="alvo-linha"
              style={{ top: linhaY(i), height: canal ? linhaY(i + 1) - linhaY(i) : 62 }}
            >
              {COLUNAS_TABELA.map((coluna, j) => {
                const etapa = ETAPA_DA_COLUNA[coluna];
                const rotuloEtapa = ROTULO_ETAPA[etapa] ?? etapa;
                const chave = `${i}-${j}`;
                const onde = canal ? `de ${canal}` : 'no total';
                const rotulo =
                  j === 0
                    ? `${canal ?? 'Total'}: ver a lista de ${rotuloEtapa}`
                    : `${ROTULOS_CSV[coluna]} ${onde}: ${valores[j]}. Ver a lista de ${rotuloEtapa}`;
                return (
                  <span key={coluna} role={j === 0 ? 'rowheader' : 'cell'}>
                    <button
                      type="button"
                      className="alvo alvo-tabela"
                      data-celula={chave}
                      data-ativo={etapaAberta?.celula === chave || undefined}
                      tabIndex={celulaTabulavel[0] === i && celulaTabulavel[1] === j ? 0 : -1}
                      style={{ left: COL_X[j]! - COL_X[0]!, width: COL_X[j + 1]! - COL_X[j]! }}
                      aria-label={rotulo}
                      onFocus={() => setFocoCelula([i, j])}
                      onKeyDown={(ev) => moverCelula(ev, i, j)}
                      onClick={() => {
                        setKpiAberto(null);
                        setEtapaAberta({ id: etapa, rotulo: rotuloEtapa, canal, celula: chave });
                      }}
                    />
                  </span>
                );
              })}
            </div>
          ) : (
            <div key={`${canal ?? 'total'}-${i}`} role="row" className="so-leitor">
              {valores.map((v, j) => (
                <span key={j} role={j === 0 ? 'rowheader' : 'cell'}>
                  {v}
                </span>
              ))}
            </div>
          ),
        )}
      </div>
      {dados && dados.canais.length === 0 && (
        <p className="tabela-vazia">Nenhum dado para os filtros escolhidos.</p>
      )}

      {/* Ícones ⓘ: depois da tabela para ficarem acima dos alvos de ordenação. */}
      {Object.values(INFOS).map((info) => (
        <Dica key={info.id} info={info} />
      ))}

      {erro && (
        <div className="faixa-erro">
          <span role="alert">Não foi possível carregar os dados agora. {erro}</span>
          <button type="button" onClick={() => iniciar(() => router.refresh())} disabled={pendente}>
            {pendente ? 'Tentando…' : 'Tentar de novo'}
          </button>
        </div>
      )}
    </main>
  );
}
