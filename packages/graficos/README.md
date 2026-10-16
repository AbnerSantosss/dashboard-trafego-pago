# @trafego/graficos

Funil de Aquisição (SVG com geometria medida), sparklines (d3-shape) e contadores (GSAP).
Contrato de props em `src/tipos.ts`.

## Componentes

- `Funil({ etapas, largura?, semAnimacao?, className? })` — até 5 etapas. `viewBox="194 322 444 322"`
  (área do card no protótipo de 1315 px), `width` 100% por padrão. Elementos com `data-etapa={id}` e
  `data-parte="trapezio" | "valor" | "texto"`. Fonte herdada; cor do texto via `currentColor`.
- `Sparkline({ pontos, largura, altura, cor, corArea?, atrasoMs?, semAnimacao? })` — curva
  `curveMonotoneX`, área em degradê (32% → 0) e traço de 1,6 px. `pontos` vazio → traço plano no meio.
  Protótipo: `cor="#3FCDBC"`, `corArea="#06F6C7"`, 52×24.
- `Contador({ valor, formatar, duracaoMs = 900, atrasoMs = 0, semAnimacao? })` — conta de 0 (ou do
  valor anterior) até `valor`; `tabular-nums` e `min-width` em `ch` evitam layout shift.
- `preferReducedMotion()` e `criarTimelineCascata(alvos, { passoMs = 100, duracaoMs = 450 })` para
  sincronizar a entrada dos cards no web.

## Animação

- Funil: cascata de 100 ms por etapa; trapézio `opacity` + `scaleY` 0,6 → 1 a partir do topo (450 ms),
  textos em fade (350 ms), valor contando por 900 ms e terminando no `valorFormatado` exato.
- Sparkline: traço desenhado por `stroke-dashoffset` (800 ms, `pathLength=1`), área em fade (500 ms).
- Todas são timelines/tweens GSAP (seek-safe) mortos ao desmontar, deixando o estado final.

## Como desligar

`semAnimacao` em cada componente, ou `prefers-reduced-motion: reduce` no sistema. O HTML do servidor
já é o estado final; a animação só começa no cliente (layout effect), partindo do estado inicial.
