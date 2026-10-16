'use client';
/**
 * Visão Geral (P4.1/P4.2/P4.5/P4.6/P4.7): desenha a tela na geometria do protótipo e sobrepõe os
 * controles reais (filtros, ordenação, exportar). O estado dos filtros vive na URL; mudar um filtro
 * navega e o Server Component refaz a busca.
 */
import type { VisaoGeralResposta } from '@trafego/contratos';
import { Funil } from '@trafego/graficos';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import { etapasFunil, montarConteudo } from '@/lib/conteudo';
import {
  gerarCsv,
  montarBusca,
  nomeArquivoCsv,
  ordenarLinhas,
  proximaOrdenacao,
  type ColunaTabela,
  type Filtros,
  type Ordenacao,
} from '@/lib/regras';
import {
  COL_X,
  EXPORTAR_GEO,
  FILTROS_GEO,
  FUNIL_GEO,
  LIMPAR_GEO,
  montarPrincipal,
} from '@/lib/tela';
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

function baixar(nome: string, url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
}

export function Painel({ dados, erro, filtros }: Props) {
  const router = useRouter();
  const caminho = usePathname();
  const [pendente, iniciar] = useTransition();
  const [ordem, setOrdem] = useState<Ordenacao | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [periodoAberto, setPeriodoAberto] = useState(false);
  const principal = useRef<HTMLElement>(null);

  const linhas = useMemo(() => ordenarLinhas(dados?.canais ?? [], ordem), [dados, ordem]);
  const conteudo = montarConteudo(dados, filtros, linhas);
  const nos = useMemo(() => montarPrincipal(conteudo), [conteudo]);
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

  function exportarCsv() {
    setMenuAberto(false);
    const csv = gerarCsv(linhas, dados?.total ?? null);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    baixar(nomeArquivoCsv(de, ate), url);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportarPng() {
    setMenuAberto(false);
    if (!principal.current) return;
    const { toPng } = await import('html-to-image');
    const url = await toPng(principal.current, { pixelRatio: window.devicePixelRatio || 1 });
    baixar(`visao-geral_${de}_${ate}.png`, url);
  }

  const canais = dados?.opcoes.canais ?? [];
  const campanhas = dados?.opcoes.campanhas ?? [];
  const geo = (id: string) => FILTROS_GEO[id]!.campo;
  const caixaCampo = (id: string) => {
    const [x, y, w, h] = geo(id);
    return { left: x, top: y - 25, width: w, height: h + 25 };
  };

  return (
    <main className="principal" ref={principal} aria-busy={pendente}>
      <h1 className="so-leitor">{conteudo.titulo}</h1>
      <Nos nos={nos} />

      {/* Exportar */}
      <button
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
        onClick={() => setMenuAberto((v) => !v)}
      />
      {menuAberto && (
        <div className="menu-exportar" role="menu" style={{ left: EXPORTAR_GEO.x, top: 64 }}>
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
          type="button"
          className="alvo"
          style={caixaCampo('periodo')}
          aria-label={`Período: ${conteudo.filtros[0]?.valor ?? ''}`}
          aria-expanded={periodoAberto}
          onClick={() => setPeriodoAberto((v) => !v)}
        />
        {periodoAberto && (
          <form
            className="popover-periodo"
            style={{ left: 199, top: 142 }}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setPeriodoAberto(false);
              aplicar({ de: String(f.get('de') || ''), ate: String(f.get('ate') || '') });
            }}
          >
            <label>
              De
              <input type="date" name="de" defaultValue={de} required />
            </label>
            <label>
              Até
              <input type="date" name="ate" defaultValue={ate} required />
            </label>
            <button type="submit">Aplicar</button>
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
        {dados && <Funil etapas={etapasFunil(dados)} largura={FUNIL_GEO.w} />}
      </section>

      {/* Ordenação da tabela */}
      <section aria-label="Desempenho por canal">
        {ALVOS_ORDENACAO.map(([coluna, x0, x1, y, h]) => {
          const ativa = ordem?.coluna === coluna;
          return (
            <button
              key={coluna}
              type="button"
              className="alvo"
              style={{ left: x0, top: y, width: x1 - x0, height: h }}
              aria-label={`Ordenar por ${coluna}`}
              aria-pressed={ativa}
              onClick={() => setOrdem((o) => proximaOrdenacao(o, coluna))}
            >
              {ativa && (
                <span className="indicador-ordem" aria-hidden="true">
                  {ordem.direcao === 'asc' ? '▲' : '▼'}
                </span>
              )}
            </button>
          );
        })}
        {dados && dados.canais.length === 0 && (
          <p className="tabela-vazia">Nenhum dado para os filtros escolhidos.</p>
        )}
      </section>

      {erro && (
        <p className="faixa-erro" role="alert">
          Não foi possível carregar os dados agora. {erro}
        </p>
      )}
    </main>
  );
}
