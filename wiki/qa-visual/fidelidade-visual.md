---
tipo: processo
atualizado: 2026-10-15
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
| G1 | Protótipo estático com diff ≤ 2% | 1 |
| G2 | Teste de isolamento entre empresas passa | 3 |
| G3 | E2E com duas empresas (webhook → painel) passa | 6 |
| G4 | Aprovação visual do usuário | 7 |

## O que pode variar sem quebrar a fidelidade
Textos dinâmicos (valores, datas), logo e nome da empresa, cores de acento configuradas. Fundo, tipografia, medidas e composição não variam.

## Armadilhas
- Fontes: a imagem usa uma sans inferida como Inter; se o diff estourar só em texto, testar Segoe UI e ajustar `letter-spacing` antes de mexer em layout.
- Antialiasing varia por SO; o diff roda sempre no mesmo container (Chromium headless, Linux) para ter base estável.
- Sparklines e funil são SVG: comparar a forma, não o traço exato; usar `threshold` do pixelmatch em 0,1.
