---
tipo: processo
atualizado: 2026-10-16
tags: [qa, visual, pixelmatch, playwright, gates]
---

# Fidelidade visual

Critério número um do projeto: a tela Visão Geral deve ser indistinguível da imagem de referência (1315×710, tema navy).

## Método
1. **Tokens** extraídos da imagem ([[design-system/tokens]]) e componentes medidos ([[design-system/componentes-referencia]]).
2. **Protótipo estático** (`prototype/index.html`) com os dados exatos ([[design-system/dados-de-referencia]]), renderizado a 1315 px.
3. **Diff automatizado**: Playwright captura a tela, pixelmatch compara com `ref-1.png`; limiar de 2% dos pixels. Script `pnpm qa:visual` gera `diff.png` e relatório com percentual.
4. **React** reproduz o protótipo; o mesmo diff roda no CI a cada PR que toca `apps/web` ou `packages/design`.
5. **Aprovação do usuário** (gate G4) com screenshot lado a lado.

## Gates
| Gate | Condição | Fase |
|---|---|---|
| G0 | Wiki criada (`index.md`, `log.md`) | 0 |
| G1 | Protótipo estático com diff ≤ 2% (aceito em 4,18%, só texto; D10) | 1 |
| G2 | Teste de isolamento entre empresas passa | 3 |
| G3 | E2E com duas empresas (webhook → painel) passa | 6 |
| G4 | Aprovação visual do usuário | 7 |

## Resultado medido (2026-10-15, Fase 1)
Protótipo `prototype/index.html` contra `tests/visual/ref-1.png`, Chromium 1315×710, Windows com Segoe UI: **4,178%** (39.012 px de 933.650). Por região: kpis 6,87%, cabeçalho 6,74%, tabela 3,93%, funil 3,81%, filtros 2,55%, sidebar 1,61%. O `diff.png` mostra só contorno de glifos, bordas de 1 px e ícones; layout, cores e posições batem (lado a lado, sem diferença perceptível).

Onde está o resto do diff:
- Texto: ~3,1% da tela. A fonte da imagem é ~15% mais estreita que Inter/Segoe UI e o render original não é nítido. Testadas Segoe UI (melhor), Open Sans, Noto Sans e Roboto Flex com eixo `wdth` 87,5–100: todas de 10% a 20% piores. Mitigação aplicada: `will-change: transform` + animação de 20 ms para reamostrar o bitmap do texto.
- Bordas e ícones: ~1%. Bordas de 1 px com `filter: blur(0.8px)`; ícones Tabler não são cópia dos originais.

Gate G1 **aceito pelo usuário em 4,18%** (D10 em [[decisoes-tecnicas/decisoes]]): o restante é só texto. Para o React (P6.3) o limiar de 2% vale contra o protótipo; contra a imagem original, ≤ 4,5% com diferença só em texto.

## Como rodar
`pnpm qa:visual` na raiz (pacote `tests/visual`, `@trafego/qa-visual`). Saída em `tests/visual/saida/` (`atual.png`, `diff.png`, `relatorio.json`), pasta fora do git. Regiões em `tests/visual/regioes.json`. Para regerar o protótipo depois de mudar spec, fixture ou estilo: `node prototype/gerar.mjs`; para recalibrar os textos: `SEM_CALIBRACAO=1 node prototype/gerar.mjs && node prototype/calibrar.mjs && node prototype/gerar.mjs`.

## O que pode variar sem quebrar a fidelidade
Textos dinâmicos (valores, datas), logo e nome da empresa, cores de acento configuradas. Fundo, tipografia, medidas e composição não variam.

## Armadilhas
- Fontes: a imagem usa uma sans ~15% mais estreita que Inter; Segoe UI foi a melhor opção local. O diff só em texto não cai com `letter-spacing`; foi o limite da Fase 1.
- Antialiasing varia por SO. O número de 4,18% vale no Windows (Segoe UI local); em CI Linux sem essa fonte o diff sobe. Antes de ligar o diff no CI, fixar uma fonte empacotada no repositório ou rodar o diff no Windows.
- `prototype/index.html` e `prototype/calibracao.json` são gerados: não formatar com Prettier (mudar espaços do HTML muda o render) nem editar à mão.
- Sparklines e funil são SVG: comparar a forma, não o traço exato; usar `threshold` do pixelmatch em 0,1.

## Medições da Fase 4 (tela React, 2026-10-15)
- Contra a imagem: 5,39% (API real, seed PASIO). Contra o protótipo: 1,45%. Aceito em D17 ([[decisoes-tecnicas/decisoes]]).
- Como medir a tela real: subir a API (`API_PORT=3011` se a 3001 estiver ocupada) e o web com `API_URL` apontando para ela, depois `pnpm qa:visual -- --alvo http://localhost:3000`. Com `WEB_MOCK_API=1` o web usa a fixture sem API.
- O harness compara só contra `ref-1.png`; para medir contra o protótipo, capture-o com `--somente-captura` e compare as duas capturas com pixelmatch.

## Medições da rodada de UX (2026-10-16)
| Onde | Como | Resultado |
|---|---|---|
| CI (runner Windows, run 38856270127) | build de produção + `WEB_MOCK_API=1` | 5,19% |
| Local, antes da rodada de UX | build de produção + `WEB_MOCK_API=1` | 5,19% |
| Local, depois da rodada de UX | build de produção + `WEB_MOCK_API=1` | **5,19%**, inalterado |
| Local, `next dev` com a API real | dev | 5,419% |

- Por região, depois da rodada: KPIs 7,39%, cabeçalho 6,99%, funil 5,83%, tabela 4,35%, sidebar 3,75%, filtros 3,11%.
- Com movimento reduzido, as capturas antes e depois de todas as adições (link de pular, alvos ⓘ, tabela semântica, `aria-hidden`) deram 0 px de diferença. A captura sem JS também bateu com a captura com JS.

## Armadilhas novas (2026-10-16)
- **Medir só como o CI mede.** O `next dev` com a API real dá números diferentes do build de produção com a fixture (5,419% contra 5,19%). Para decidir se algo quebrou a fidelidade, use o build de produção com `WEB_MOCK_API=1`.
- **`next build` e `next dev` dividem `apps/web/.next`.** Pare o dev antes do build e suba de novo depois. Subagentes não rodam build nem `qa:visual`; quem roda é o orquestrador.
- **Re-rasterização do Chromium.** Qualquer regra nova que toque `.kpi-val`, até um `outline-color` sem efeito visual, muda os mesmos 684 px no funil. Não é efeito do código novo; para provar, compare com e sem a regra em capturas seguidas.
- **Movimento e o diff.** O harness captura com `prefers-reduced-motion: reduce`. Todo movimento fica dentro de `@media (prefers-reduced-motion: no-preference)`, com `fill-mode: backwards`, e termina no estado do SSR (D29). Nada pode começar em `opacity: 0` fora dessa media query.
