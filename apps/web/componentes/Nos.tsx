'use client';
/** Desenha os nós posicionados de lib/tela.ts (textos, ícones, caixas e sparklines). */
import { icones } from '@trafego/design/icons/index.ts';
import { Contador, Sparkline } from '@trafego/graficos';
import type { CSSProperties, ReactNode } from 'react';
import { formatarKpi } from '@/lib/regras';
import { ENTRADA, estiloCalibrado, slotSoVisual, type No } from '@/lib/tela';

const svgs = icones as Record<string, string>;

export function Icone({
  nome,
  className,
  estilo,
}: {
  nome: string;
  className?: string;
  estilo?: CSSProperties;
}) {
  return (
    <span
      className={className}
      style={estilo}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgs[nome] ?? '' }}
    />
  );
}

/** Classe do invólucro de entrada (o Contador sincroniza a contagem com a animação dele). */
const CLASSE_ENTRADA = 'entrada';

function desenharNo(no: No, i: number): ReactNode {
  if (no.tipo === 'caixa') {
    return (
      <div
        key={i}
        className={no.cls}
        style={{ left: no.x, top: no.y, width: no.w, height: no.h, ...no.estilo }}
      />
    );
  }
  if (no.tipo === 'icone') {
    return (
      <Icone
        key={no.slot}
        nome={no.nome}
        className={`ic ${no.cls ?? ''}`}
        estilo={{
          left: no.x,
          top: no.y,
          width: no.w,
          height: no.h,
          ...(no.cor ? { color: no.cor } : {}),
          ...(estiloCalibrado(no.slot) as CSSProperties),
        }}
      />
    );
  }
  if (no.tipo === 'spark') {
    return (
      <div key={no.slot} className="spark" style={{ left: no.x, top: 224 }} aria-hidden="true">
        <Sparkline
          pontos={no.pontos}
          largura={52}
          altura={24}
          cor="var(--p-spark)"
          atrasoMs={(no.entrada?.atrasoMs ?? 0) + ENTRADA.sparkMs}
        />
      </div>
    );
  }
  if (no.slot.startsWith('fantasma.')) return null;
  const estilo = {
    '--x': `${no.x}px`,
    '--b': no.b,
    ...estiloCalibrado(no.slot),
  } as CSSProperties;
  const id = no.contador?.id;
  return (
    <span
      key={no.slot}
      className={`t ${no.centro ? 'c ' : ''}${no.cls}`}
      style={estilo}
      aria-hidden={slotSoVisual(no.slot) || undefined}
    >
      {no.contador && id ? (
        <Contador
          valor={no.contador.valor}
          formatar={(n) => formatarKpi(id, n)}
          atrasoMs={no.entrada?.atrasoMs ?? 0}
          sincronizarCom={`.${CLASSE_ENTRADA}`}
        />
      ) : (
        no.texto
      )}
    </span>
  );
}

/**
 * Desenha os nós. Nós seguidos do mesmo grupo de entrada (um card) vão num invólucro de 0×0 em
 * (0, 0), que não muda nenhuma coordenada; a animação de entrada dele está em tela.css e só existe
 * com prefers-reduced-motion: no-preference.
 */
export function Nos({ nos }: { nos: No[] }) {
  const saida: ReactNode[] = [];
  let i = 0;
  while (i < nos.length) {
    const entrada = nos[i]!.entrada;
    if (!entrada) {
      saida.push(desenharNo(nos[i]!, i));
      i++;
      continue;
    }
    const filhos: ReactNode[] = [];
    while (i < nos.length && nos[i]!.entrada?.grupo === entrada.grupo) {
      filhos.push(desenharNo(nos[i]!, i));
      i++;
    }
    saida.push(
      <div
        key={`entrada.${entrada.grupo}`}
        className={CLASSE_ENTRADA}
        style={{ '--atraso': `${entrada.atrasoMs}ms` } as CSSProperties}
      >
        {filhos}
      </div>,
    );
  }
  return <>{saida}</>;
}
