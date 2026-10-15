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
| `--text-muted` | #D6E6F5 | amostrado | "vs. período anterior" (legendas mais apagadas usam `--text-dim` #C5D3EA) |
| `--accent-blue` | #0070F8 | amostrado | Tiles azuis, link ativo |
| `--accent-blue-deep` | #0162FF | amostrado | Sombreado do funil etapa 1 (cor da etapa: `--funnel-1` #0070FD) |
| `--accent-cyan-light` | #6ED5FF | amostrado | Brilho do texto sobre o funil; a etapa 2 é azul (`--funnel-2` #017BFF) |
| `--accent-cyan` | #04ADDF | amostrado | Apoio; funil etapa 3 = `--funnel-3` #00B1DE |
| `--accent-green` | #00C98B | amostrado | Apoio; funil etapas 4 e 5 = `--funnel-4` #00C997 e `--funnel-5` #00C97F |
| `--accent-teal` | #24CCB6 | amostrado | Tiles Depósitos (#24CCB6) e ROAS (#34DFCE) |
| `--accent-red` | #E13C5D | amostrado | Tile CPA |
| `--positive` | #06F6C7 | amostrado | Deltas positivos, sparklines, ponto de status |
| `--negative` | #FF5C7A | inferido | Delta desfavorável; não aparece na imagem (o "▼ -5,4%" do CPA é verde, queda de custo é boa) |
| `--button-clear` | #26C89F sobre #004231 | amostrado | Limpar filtros |
| `--logo` | #524EA1 | amostrado | Placeholder roxo; na PASIO é substituído pelo ícone oficial |

## Tipografia (fonte inferida: Inter, Segoe UI, sans-serif)
Título 28/600 · Subtítulo 15/400 · Valor KPI 21/600 · Rótulo KPI 13/400 · Delta 13/600 · Título de card 18/600 · Tabela 12/400 · Valor do funil 19/600.

## Espaçamento e raios (medidos)
Sidebar 180 px · gap entre cards 12 px · padding de card 12 px na horizontal × 13 px na vertical · card KPI 115 px · filtros 56 px · tile de ícone 44 px · linha da tabela 48 px · raio 8 px em cards, tiles, filtros, botões e nav · funil: etapas de 56 px, 6 px entre etapas, recuo de 26 px por lado de uma etapa para a seguinte e afunilamento de 16 px por lado dentro da etapa · colunas inferiores 40,5% / 59,5%.

Relacionado: [[design-system/componentes-referencia]], [[design-system/dados-de-referencia]].

## Correções (P1.1)
Medidas refeitas na `ref-1.png` com PIL; valores finais em `packages/design/tokens.css` (95 tokens).
- `--text-muted`: #8FA6BD (inferido) → #D6E6F5 (amostrado no "vs. período anterior" dos cinco KPIs). Legendas mais apagadas ganharam `--text-dim` #C5D3EA.
- `--negative`: segue inferido; a imagem não tem delta vermelho (o CPA cai e aparece em verde).
- Funil: a etapa 2 é azul #017BFF, não #6ED5FF (esse pixel é antialiasing do texto). Cores das etapas viraram `--funnel-1..5`.
- Card KPI: 112 → 115 px (bordas em y=155 e y=269).
- Padding de card: 16×18 → 12×13 px (texto a 12–13 px da borda; o card 1 tem só 6 px, irregularidade do mock).
- Funil: recuo de 12 px → 26 px por lado entre topos de etapas (topos em x=210, 238, 264, 288, 313).
- Colunas inferiores: 34%/66% → 40,5%/59,5% (funil 444 px, tabela 651 px, x=194–637 e 649–1299).
- Valor KPI 24 → 21 px e valor do funil 16 → 19 px (altura de maiúscula 15 e 14 px ÷ 0,727 da Inter).

## Divergências medidas pelo protótipo (pendente de reconciliação, P1.1)
O protótipo (`prototype/estilo.css`, variáveis `--p-*`) mediu na imagem valores diferentes de 18 tokens, entre eles `--bg-nav-active` (#002E72 vs #0A307C), `--text-secondary` (#C2CFE2 vs #D1E3F4), `--positive` (#36DBC5 no delta e #19F4D3 no ponto de status vs #06F6C7), `--bg-card` (#071B29 vs #061B28), `--border-card` (#132739 vs #0C2030), `--button-clear-*`, `--funnel-connector` (#4A5D6E vs #A6C6F2) e `--text-muted` (#A0B1C4 vs #D6E6F5). A lista completa, com comentário por linha, está no próprio `estilo.css`. Antes do React (Fase 4), o agente design-fidelity confere cada par na imagem e corrige `tokens.css`/`tokens.json`, para que o React use só tokens.
