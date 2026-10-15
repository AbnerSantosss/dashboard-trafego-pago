# Protótipo visual (P1.5 / P1.6)

`index.html` é uma reprodução estática, em HTML e CSS puro, da referência `tests/visual/ref-1.png` (1315×710). Ele não usa JS para renderizar. As medidas vêm de `design/componentes.md`, e os textos, de `packages/fixtures/referencia.json`.

## Arquivos
- `gerar.mjs`: gera o `index.html`, com o sprite de ícones inline, os textos da fixture e a calibração. Uso: `node prototype/gerar.mjs`.
- `estilo.css`: estilos. Variáveis `--p-*` guardam valores medidos que divergem dos tokens, cada uma com comentário.
- `calibracao.json`: ajuste fino por texto (`texto#n`). Contém deslocamento subpixel (dx/dy), origem da animação (rx/ry), tamanho, peso, família e opacidade.
- `calibrar.mjs`: refaz a calibração por descida coordenada contra a referência, elemento a elemento. Uso:
  `SEM_CALIBRACAO=1 node prototype/gerar.mjs && node prototype/calibrar.mjs && node prototype/gerar.mjs`.
  A geração sem calibração é obrigatória, senão a base de tamanho e peso se perde. Variável opcional: `PASSES` (padrão 2).

## Logo
- `data-logo="referencia"` (padrão): placeholder vetorial com o contorno medido da referência.
- `data-logo="pasio"`: usa `packages/design/brand/pasio-logo.png`.

## Fonte
Usa a Segoe UI instalada no sistema, sem nada de rede. A linha de base fica em topo + 0,91 em, com line-height 1.
- **Risco:** em Linux/CI sem a Segoe UI, o diff sobe muito. A medida vale para Windows.
- **Alternativas testadas e descartadas:** Open Sans, Noto Sans e Roboto Flex variáveis, com eixo wdth em 87,5, 93,75 e 100. Todas ficaram 10% a 20% piores.

## Suavização
A referência não tem texto nítido. Cada `.t` e `.ic` tem `will-change: transform` e uma animação de 20 ms (`desloca`):
- o texto é rasterizado na origem da animação;
- o compositor move o bitmap até o destino sem re-rasterizar;
- a reamostragem da fração subpixel suaviza o traço.

Nos cards e bordas, `filter: blur(0.8px)` cumpre o mesmo papel. Abaixo de 0,8 px o Chromium não aplica o blur.

## Divergências fixture × imagem
O protótipo reproduz a imagem:
- Meta cadastros: "1,900".
- Outros cliques: "1,420".
- Hífen no lugar de meia-risca.
