---
tipo: design-system
atualizado: 2026-10-15
tags: [tokens, cores, tipografia, espacamento]
---

# Tokens de design

Extraídos da imagem de referência (1315×710). Origem: **amostrado** (cor lida da imagem), **medido** (dimensão lida), **inferido** (não visível, derivado). Fonte de verdade em código: `packages/design/tokens.css` e `tokens.json` (tarefa P1.1). Lista completa com 43 tokens no dataset `tokens` do artifact do plano.

## Cores
| Token | Valor | Origem | Uso |
|---|---|---|---|
| `--bg-sidebar` | #051424 | amostrado | Barra lateral |
| `--bg-app` | #03111E | amostrado | Fundo geral e divisor |
| `--bg-card` | #061B28 | amostrado | Cards de KPI, funil, tabela |
| `--bg-filter` | #051E31 | amostrado | Campos de filtro |
| `--bg-nav-active` | #0A307C | amostrado | Item ativo do menu |
| `--bg-total-row` | #0D2644 | amostrado | Linha Total |
| `--bg-button` | #101A32 | amostrado | Botão Exportar |
| `--border-card` | #0C2030 | amostrado | Borda 1px dos cards |
| `--text-primary` | #FFFFFF | amostrado | Títulos, valores, células |
| `--text-secondary` | #D1E3F4 | amostrado | Rótulos, cabeçalhos |
| `--text-muted` | #8FA6BD | inferido | "vs. período anterior", legendas |
| `--accent-blue` | #0070F8 | amostrado | Tiles azuis, link ativo |
| `--accent-blue-deep` | #0162FF | amostrado | Funil etapa 1 |
| `--accent-cyan-light` | #6ED5FF | amostrado | Funil etapa 2 |
| `--accent-cyan` | #04ADDF | amostrado | Funil etapa 3 |
| `--accent-green` | #00C98B | amostrado | Funil etapas 4 e 5 (#04C67E) |
| `--accent-teal` | #24CCB6 | amostrado | Tiles Depósitos (#24CCB6) e ROAS (#34DFCE) |
| `--accent-red` | #E13C5D | amostrado | Tile CPA |
| `--positive` | #06F6C7 | amostrado | Deltas positivos, sparklines, ponto de status |
| `--negative` | #FF5C7A | inferido | Delta negativo |
| `--button-clear` | #26C89F sobre #004231 | amostrado | Limpar filtros |
| `--logo` | #524EA1 | amostrado | Placeholder roxo; na PASIO é substituído pelo ícone oficial |

## Tipografia (fonte inferida: Inter, Segoe UI, sans-serif)
Título 28/600 · Subtítulo 15/400 · Valor KPI 24/600 · Rótulo KPI 13/400 · Delta 13/600 · Título de card 18/600 · Tabela 12/400 · Valor do funil 16/600.

## Espaçamento e raios (medidos)
Sidebar 180 px · gap entre cards 12 px · padding de card 16×18 px · card KPI 112 px · filtros 56 px · tile de ícone 44 px · linha da tabela 48 px · raio 8 px em cards, tiles, filtros, botões e nav · funil: etapas de 56 px com recuo de 12 px por etapa · colunas inferiores 34% / 66%.

Relacionado: [[design-system/componentes-referencia]], [[design-system/dados-de-referencia]].
