# QA visual (`@trafego/qa-visual`)

Harness que mede a fidelidade da tela Visão Geral contra a imagem de referência `ref-1.png`
(1315×710). Critério do gate G1: **no máximo 2% dos pixels diferentes**. Contexto em
`wiki/qa-visual/fidelidade-visual.md`.

## Como rodar

Na raiz do repositório (PowerShell):

```powershell
pnpm qa:visual                 # compara prototype/index.html com ref-1.png
pnpm qa:visual:update          # só captura saida/atual.png, sem comparar
```

Outro alvo (arquivo local ou URL http, por exemplo o Next.js da Fase 4):

```powershell
pnpm --filter @trafego/qa-visual qa:visual -- --alvo http://localhost:3000/visao-geral
pnpm --filter @trafego/qa-visual qa:visual -- --alvo exemplos/vazio.html --relatorio exemplos/relatorio-vazio.json
```

Caminhos relativos em `--alvo` e `--relatorio` são resolvidos a partir de `tests/visual/` (o pnpm
executa o script dentro do pacote). Opções: `--alvo <arquivo|url>`, `--somente-captura`,
`--limite <percentual>` (padrão 2), `--relatorio <caminho.json>` (padrão `saida/relatorio.json`).

Primeira vez numa máquina nova: `pnpm install` e `pnpm --filter @trafego/qa-visual exec playwright install chromium`.

O script roda com `node --experimental-strip-types comparar.ts` (Node 24, sem tsx nem build).
Por isso `comparar.ts` só usa TypeScript "apagável": nada de `enum`, `namespace` ou parameter
properties. `pnpm --filter @trafego/qa-visual typecheck` confere os tipos.

## O que acontece

1. Chromium headless, viewport 1315×710, `deviceScaleFactor: 1`, `prefers-reduced-motion: reduce`,
   esquema escuro, locale pt-BR, fuso America/Sao_Paulo.
2. Abre o alvo (`file://` ou `http(s)://`), espera `load`, `document.fonts.ready` e mais 300 ms.
3. Captura PNG recortado em 1315×710 e compara com `ref-1.png` via pixelmatch
   (`threshold: 0.1`, `includeAA: false`).
4. Grava em `saida/` (fora do git): `atual.png`, `diff.png`, `relatorio.json`.
5. Imprime o resumo e sai com código **1** se percentual > limite, **2** em erro de execução
   (alvo inexistente, tamanho errado, Chromium ausente), **0** se aprovado.

## Como ler o relatório

```json
{
  "pixelsDiferentes": 166737,
  "total": 933650,
  "percentual": 17.859,
  "limite": 2,
  "aprovado": false,
  "alvo": "file:///.../exemplos/vazio.html",
  "data": "2026-10-15T...",
  "regioes": [
    { "nome": "funil", "caixa": { "x": 182, "y": 276, "w": 462, "h": 434 },
      "pixelsDiferentes": 61917, "total": 200508, "percentual": 30.88, "participacaoNoTotal": 37.134 }
  ]
}
```

- `percentual` é o número do gate (pixels diferentes / 933.650).
- Em cada região, `percentual` diz quanto **daquela caixa** está diferente e `participacaoNoTotal`
  diz quanto **das diferenças totais** caiu ali. Ataque primeiro a região com maior participação.
- `diff.png`: vermelho = pixel diferente; amarelo = diferença classificada como antialiasing
  (não conta); o resto é a referência esmaecida.
- As caixas ficam em `regioes.json` (sidebar, cabecalho, filtros, kpis, funil, tabela). Foram
  estimadas a olho e cobrem a tela sem sobreposição; o agente de componentes deve refiná-las.

## Prova de funcionamento (`exemplos/`)

| Alvo | Resultado |
|---|---|
| `exemplos/vazio.html` (só fundo `#03111E`) | 17,859%, reprovado; diferença concentrada em funil e tabela |
| `exemplos/referencia.html` (`<img src="../ref-1.png">`) | 0%, aprovado |

Relatórios guardados em `exemplos/relatorio-vazio.json` e `exemplos/relatorio-referencia.json`.

## Limiar e armadilhas

- **O limite de 2% é folgado em termos absolutos**: uma página só com a cor de fundo já fica em
  ~18%, porque a maior parte da tela é fundo escuro. 2% ≈ 18.700 pixels, ou seja, cabem
  diferenças reais (um bloco de texto inteiro). Olhe sempre o `diff.png` e as regiões, não só o
  número global.
- **Fontes**: se a fonte não carregar, o texto cai num fallback e o diff explode nas regiões com
  texto. Use fontes locais ou `@font-face` com arquivo no repositório; `document.fonts.ready` só
  espera fontes que a página pediu. Se o diff estourar só em texto, teste Segoe UI/Inter e ajuste
  `letter-spacing` antes de mexer em layout.
- **Antialiasing e SO**: a renderização de texto difere entre Windows, macOS e Linux. Com
  `includeAA: false` o pixelmatch ignora boa parte das bordas suavizadas, mas o número de referência
  oficial deve vir sempre do mesmo ambiente (Chromium headless em Linux no CI). Números medidos no
  Windows servem para iterar, não para aprovar o gate.
- **A referência é uma captura comprimida** (veio de WebP): ruído de compressão e degradês geram
  pequenas diferenças inevitáveis. `threshold: 0.1` absorve parte disso.
- **Animações**: o contexto pede `reduced-motion`; o protótipo deve respeitar
  `prefers-reduced-motion` e mostrar o estado final (números contados, funil cheio).
- **Rolagem e tamanho**: o recorte é sempre 0,0–1315×710. Se a página for mais alta, só o topo
  conta; barras de rolagem visíveis viram diferença (use `overflow: hidden` no protótipo).
- **Dados**: valores e datas devem ser exatamente os da referência
  (`wiki/design-system/dados-de-referencia.md`).
