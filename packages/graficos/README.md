# @trafego/graficos

Funil de Aquisição (SVG com geometria medida), sparklines (d3-shape) e contadores
(requestAnimationFrame). Contrato de props em `src/tipos.ts`.

## Componentes

- `Funil({ etapas, largura?, semAnimacao?, atrasoMs = 0, className? })` — até 5 etapas.
  `viewBox="194 322 444 322"` (área do card no protótipo de 1315 px), `width` 100% por padrão.
  Elementos com `data-etapa={id}` e `data-parte="trapezio" | "valor" | "texto"`. Fonte herdada; cor
  do texto via `currentColor`.
- `Sparkline({ pontos, largura, altura, cor, corArea?, atrasoMs?, semAnimacao? })` — curva
  `curveMonotoneX`, área em degradê (32% → 0) e traço de 1,6 px. `pontos` vazio → traço plano no meio.
  Protótipo: `cor="#3FCDBC"`, `corArea="#06F6C7"`, 52×24.
- `Contador({ valor, formatar, duracaoMs = 800, atrasoMs = 0, sincronizarCom?, semAnimacao? })` —
  conta de 0 (ou do valor anterior) até `valor`; `tabular-nums` e `min-width` em `ch` evitam layout
  shift. `sincronizarCom` é um seletor de ancestral (ex.: `.entrada`) cuja animação CSS de entrada
  marca o início da contagem.
- Utilitários em `src/movimento.ts`: `CURVA_ENTRADA`, `saidaQuad`, `animarNumero`,
  `esperaDaEntradaCss`, `CSS_MOVIMENTO`, `preferReducedMotion()` e `criarTimelineCascata` (GSAP,
  mantido para quem quiser uma cascata programática; o painel não usa).

## Animação

Doutrina de movimento do Hyperframes (só referência): só `transform` e `opacity` (e `clip-path` na
revelação do traço), curva de entrada `cubic-bezier(.165,.84,.44,1)`, números sem overshoot.

- Funil (momento autoral do painel): barras em `scaleX` 0 → 1 a partir do eixo central, 420 ms, 70 ms
  entre etapas; textos e valores em fade 180 ms depois da barra; valores contando por 440 ms com
  `saidaQuad` (1 − (1 − t)²). Última etapa termina em ~900 ms após o atraso do card.
- Sparkline: traço revelado por `clip-path: inset()` da esquerda para a direita (600 ms), área em fade
  (400 ms, +250 ms).
- Contador: `saidaQuad` por 800 ms, cada quadro com o mesmo `formatar` (mesma máscara pt-BR) e o último
  escrevendo exatamente `formatar(valor)`.
- As barras, textos e sparklines são CSS (`CSS_MOVIMENTO`, injetado uma vez via
  `<style href precedence>` do React 19) com `animation-fill-mode: backwards`: começam no primeiro
  paint do HTML do servidor, funcionam sem JS e, ao terminar, não deixam nada aplicado.
- Os números contam por `requestAnimationFrame` (`animarNumero`) e se sincronizam com a entrada CSS
  por `getAnimations()`; se a hidratação chega depois de o elemento já ter aparecido, o número fica no
  valor final em vez de voltar a 0. A limpeza do efeito sempre escreve o texto final e é segura com o
  StrictMode (monta, desmonta, remonta).

## Como desligar

`semAnimacao` em cada componente, ou `prefers-reduced-motion: reduce` no sistema. Todo o CSS de
movimento fica dentro de `@media (prefers-reduced-motion: no-preference)`; com reduce nada anima e
nenhum elemento passa por `opacity: 0`. O HTML do servidor já é o estado final.
