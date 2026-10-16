'use client';
/** Desenha os nós posicionados de lib/tela.ts (textos, ícones, caixas e sparklines). */
import { icones } from '@trafego/design/icons/index.ts';
import { Contador, Sparkline } from '@trafego/graficos';
import type { CSSProperties } from 'react';
import { formatarKpi } from '@/lib/regras';
import { estiloCalibrado, type No } from '@/lib/tela';

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

export function Nos({ nos }: { nos: No[] }) {
  return (
    <>
      {nos.map((no, i) => {
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
            <div
              key={no.slot}
              className="spark"
              style={{ left: no.x, top: 224 }}
              aria-hidden="true"
            >
              <Sparkline pontos={no.pontos} largura={52} altura={24} cor="var(--p-spark)" />
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
          <span key={no.slot} className={`t ${no.centro ? 'c ' : ''}${no.cls}`} style={estilo}>
            {no.contador && id ? (
              <Contador valor={no.contador.valor} formatar={(n) => formatarKpi(id, n)} />
            ) : (
              no.texto
            )}
          </span>
        );
      })}
    </>
  );
}
