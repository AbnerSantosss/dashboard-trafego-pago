---
tipo: design-system
atualizado: 2026-10-15
tags: [componentes, medidas, px, referencia, p1-2]
---

# Especificação de componentes da tela de referência (P1.2)

Fonte: `tests/visual/ref-1.png` (1315 × 710). Todas as medidas foram lidas da imagem com Python/PIL
(perfis de luminância, máscaras de cor e caixas de texto). Coordenadas em px no canvas, origem no canto
superior esquerdo; `x, y, largura, altura`. Intervalos `a–b` são meio-abertos (pixel `a` incluso, `b` não).

Convenções:
- **Tokens**: nomes de `wiki/design-system/tokens.md`. Quando o valor medido diverge do token ou não há
  token, o hex medido vem ao lado e a linha é marcada **(sem token)** ou **(diverge)**.
- **Texto**: `topo-cap` = primeira linha de pixel da maiúscula/algarismo; `base` = linha de base
  (última linha da maiúscula + 1). Tamanho de fonte estimado pela altura de maiúscula (cap ≈ 0,72 em).
- A imagem é uma captura comprimida (ruído JPEG ±3 níveis); medidas de borda têm incerteza de ±1 px.

---

## 1. Grade geral

| Região | x | y | largura | altura | Observação |
|---|---|---|---|---|---|
| Faixa escura superior (artefato da captura) | 0 | 0 | 1315 | 4 | #060606; contém restos ilegíveis de texto. Reproduzir como faixa sólida |
| Faixa escura direita (artefato) | 1312 | 4 | 3 | 706 | #030F1B |
| Sidebar | 0 | 4 | 180 | 706 | `--bg-sidebar` #051424 |
| Divisor da sidebar | 180 | 4 | 1 | 706 | #112234 (sem token; ≈ `--border-card` mais claro) |
| Área principal (fundo) | 181 | 4 | 1131 | 706 | ver nota de fundo abaixo |
| Cabeçalho (título → Exportar) | 194 | 4 | 1106 | 79 | sem caixa; conteúdo de y 19 a 60 |
| Barra de filtros | 194 | 83 | 1106 | 58 | 4 campos + botão Limpar |
| Linha de KPIs | 194 | 156 | 1106 | 114 | 5 cards |
| Card Funil | 194 | 281 | 444 | 429 | continua além da borda inferior (cortado em 710) |
| Card Tabela | 650 | 281 | 650 | 429 | idem; linha Total termina em y 702 |

Margens e gaps:
- Coluna de conteúdo: x 194 → 1300 (1106 px). Margem esquerda após o divisor: 13 px (181→194).
  Margem direita: 12 px até o artefato (1300→1312).
- Vertical: filtros 83–141 · gap 15 · KPIs 156–270 · gap 11 · cards inferiores 281→710.
- Gap horizontal entre filtros: 12, 12, 12, 15 px. Entre KPIs: 12, 12, 13, 13 px. Entre Funil e Tabela: 12 px.
- **Proporção inferior medida: Funil 444 px (40,5%) / Tabela 650 px (59,5%)**, não 34/66.

Fundo da área principal: não é chapado. Varia de #03111E (cantos e gaps laterais) a #071829 (topo,
centro do cabeçalho). Valor médio #041625. Recomendação: `--bg-app` com um `radial-gradient` suave
centrado em (700, 0): #071829 → #041625 em ~600 px → #03111E nas bordas. Em diff, o chapado #041625
já fica dentro de ±3 níveis na maior parte da área.

---

## 2. Componentes

### 2.1 Sidebar

| Elemento | Caixa (x, y, w, h) | Estilo |
|---|---|---|
| Fundo | 0, 4, 180, 706 | `--bg-sidebar` #051424 (topo levemente #051525) |
| Logo (círculo) | 45, 16, 56, 54 | centro (73, 43). Placeholder: círculo com gradiente lavanda (#B9B6F0 topo-esq → #524EA1 → `--logo`) e recorte escuro em "S"; na PASIO usar `packages/design/brand/pasio-logo.png` contido em 56 × 56 |
| Item ativo (fundo) | 8, 85, 160, 40 | `--bg-nav-active` (medido #002E72; token #0A307C — diferença pequena), raio 6 |
| Itens: pitch vertical | — | centros em y 105, 149,5, 193,5 (passo 44–45 px) |
| Ícone do item | x 22–41 (≈ 18 × 18), centro vertical no item | ativo: ciano #70EEFE (sem token; próximo de `--accent-cyan-light`); inativo: #C2CFE2 (`--text-secondary`) |
| Texto do item | x 56 | 15 px, peso 500, cap 11 px. Ativo #FFFFFF (`--text-primary`); inativo `--text-secondary` |
| Ajuda (rodapé) | ícone 21, 692, 19, 19 (cortado em 710); texto x 54, topo-cap 697 | mesmo estilo do item inativo; centro vertical ≈ 703 |

Posições de texto do menu (topo-cap → base): Visão Geral 99→110 (x 57–123); Gestão de Custos 144→155
(x 55–156); Relatórios 188→199 (x 56–112); Ajuda 697→(710) (x 54–85).

### 2.2 Cabeçalho

| Elemento | Caixa / posição | Estilo |
|---|---|---|
| Título "Visão Geral de Aquisição" | x 200–500 (300 px), topo-cap 21, base 40 | cap 19 px → **26–27 px**, peso 600 (wiki diz 28), `--text-primary` |
| Subtítulo | x 199–659 (460 px), topo-cap 54, base 65 | 15 px, peso 400, `--text-secondary` (medido #C0D5F0) |
| Ponto de status | círculo 11 px, caixa 970, 31, 11, 11 (centro 975,5; 36,5) | `--positive` (medido #19F4D3) |
| Status linha 1 "Dados atualizados em:" | x 993–1101, topo-cap 23, base 32 | 12 px, peso 400, `--text-secondary` (medido #B1C2DA) |
| Status linha 2 "24/05/2024 08:30" | x 993–1082, topo-cap 42, base 51 | idem; entrelinha 19 px |
| Botão Exportar | 1151, 21, 142, 39 | fundo `--bg-button` (medido #061A2E, token #101A32 — **diverge**, medido é mais escuro/azul), borda 1 px #0C1E30, raio 8 |
| ↳ ícone `exportar` | 1166, 32, 17, 17 | traço `--text-primary` |
| ↳ texto "Exportar" | x 1194–1242, topo-cap 35, base 45 | 14 px, peso 500, `--text-primary` |
| ↳ `chevron-down` | 1267, 38, 9, 5 | traço 1,5 px, `--text-secondary` |

### 2.3 Barra de filtros

Cada filtro é uma **caixa externa** (rótulo dentro) com um **campo interno** mais claro.

| Filtro | Caixa externa (x, y, w, h) | Campo interno (x, y, w, h) | Rótulo x | Valor x | Chevron x |
|---|---|---|---|---|---|
| Período. | 194, 83, 235, 58 | 199, 108, 227, 30 | 207 | 234 (ícone `calendario` em 210–224) | 406–415 |
| Comparar com | 441, 83, 223, 58 | 445, 108, 216, 30 | 453 | 457 | 640–649 |
| Canal | 676, 83, 201, 58 | 680, 108, 193, 30 | 688 | 690 | 852–861 |
| Campanha | 889, 83, 234, 58 | 894, 108, 225, 30 | 902 | 905 | 1098–1107 |
| Limpar filtros (botão) | 1138, 83, 162, 58 | — | — | texto 1193–1269 | ícone `limpar` 1165, 103, 20, 17 |

- Caixa externa: fundo #091C2F (≈ `--bg-filter` #051E31, um pouco mais escuro no medido), borda 1 px
  #0E2236, raio 6. Altura **58 px** (wiki diz 56).
- Campo interno: fundo #0A2134 (sem token), borda 1 px #102739, raio 5; recuo 4–5 px à esquerda,
  3 px à direita e embaixo.
- Rótulo: topo-cap 93, base 101 → 11–12 px, peso 400, `--text-secondary` (medido #A8B8CE).
- Valor: topo-cap 118, base 127 → 13 px, peso 400, `--text-primary` (medido #E0F0FE).
- Chevron: 9 × 5, centro y ≈ 123, distante 11–12 px da borda direita do campo interno, `--text-secondary`.
- Ícone `calendario`: 14 × 18 em (210, 113), preenchido, #C0DCFE.
- Limpar filtros: fundo #00312A, borda 1 px #0A4F40 (verde a ~25%), raio 6 — token `--button-clear`
  (#26C89F sobre #004231; o fundo medido é mais escuro). Texto 14 px, peso 500, topo-cap 107, base 117,
  cor medida #42C6AB (≈ #26C89F com antialias). Ícone funil de linha, mesma cor.

Larguras de texto medidas (para calibrar fonte): "Período." 38 px · "Comparar com" 68 · "Canal" 25 ·
"Campanha" 50 · "01/05/2024 - 24/05/2024" 133 (234–367) · "Período anterior" 81 · "Todos" 32 · "Todas" 31 ·
"Limpar filtros" 76.

### 2.4 Card KPI

Caixas medidas (y 156–270, altura **114**; wiki diz 112). **As larguras não são iguais na referência:**

| # | Card (x, w) | Tile (x, y, 46 × 46) | Coluna de texto x | Sparkline (x, y, w, h) |
|---|---|---|---|---|
| 1 Investimento total | 194, 213 | 199, 167 | 261 | 347, 224, 52, 23 |
| 2 FTDs | 419, 197 | 429, 167 | 492 (seta do delta 488) | 558, 224, 52, 23 |
| 3 Custo por FTD (CPA) | 628, 213 | 639, 167 | 698 | 783, 224, 52, 23 |
| 4 Depósitos no período | 854, 225 | 863, 167 | 925 | 1019, 224, 52, 23 |
| 5 ROAS (Depósitos) | 1092, 208 | 1103, 167 | 1164 | 1240, 224, 52, 23 |

Para o protótipo: `grid-template-columns: 213px 197px 213px 225px 208px` com gaps 12/12/13/13
(ou `column-gap: 12px` e card 4 com 226 px). Valores nominais por card: tile em (+5…+11, +11) do canto;
texto em tile + 62 px; sparkline com borda direita a 6–9 px da borda do card.

- Card: fundo `--bg-card` (medido #071B29 → #0C2132 perto do texto; leve gradiente para cima/direita),
  borda 1 px `--border-card` (medido #0D2131 topo, #132739 lateral), raio 6.
- Tile: 46 × 46 (wiki diz 44), raio 8. Fundo é o acento a ~30% sobre o card, **não o acento puro**:

| Tile | Fundo medido | Ícone medido | Token do acento |
|---|---|---|---|
| Investimento | #022B5E | #0F80F5 | `--accent-blue` |
| FTDs | #012D5C | #0D7BF4 | `--accent-blue` |
| CPA | #2C1F38 | #D55271 | `--accent-red` |
| Depósitos | #023A43 | #22EED2 | `--accent-teal` |
| ROAS | #023A44 | #2AEBD8 | `--accent-teal` (#34DFCE) |

  Ícone dentro do tile: ≈ 27 × 28, centralizado (ex.: 208–236 × 176–204 no card 1).

| Texto | topo-cap → base | Fonte | Cor |
|---|---|---|---|
| Rótulo | 175 → 183 | cap 8 → **12 px**, peso 400 (wiki: 13) | `--text-secondary` (medido #C0D0E0) |
| Valor | 197 → 212 | cap 15 → **21–22 px**, peso 700 (wiki: 24/600) | `--text-primary` |
| Seta (`seta-alta`/`seta-baixa`) | 233 → 242, 10 × 9, x = coluna de texto − 1 | triângulo cheio | `--positive` |
| Delta "12,5%" | 232 → 242 | cap 10 → **14 px**, peso 600; começa 9 px após a seta | `--positive` (medido #36DBC5) |
| "vs. período anterior" | 251 → 261 (x-height 5) | **10 px**, peso 400 | medido #C0CDDB = `--text-secondary`, **não** `--text-muted` |

  CPA: seta para baixo, texto "-5,4%", **também verde** (`--positive`), porque queda de custo é boa.
  `--negative` não aparece na tela.

Larguras medidas (card 1/2/3/4/5): rótulo 91/26/103/104/95 · valor 92/34/80/105/52 ·
delta (seta+texto) 55/54/51/55/53 · "vs. período anterior" 84/68*/79/86/74 (*cortado pela sparkline).

### 2.5 Funil de Aquisição

Card: 194, 281, 444, 429 (até o fim do canvas), fundo `--bg-card` #071B2B, borda 1 px #132739, raio 6.

- Título "Funil de Aquisição": x 209–349, topo-cap 301, base 313 → **17 px**, peso 600, `--text-primary`.
- Ícone `info` (círculo com "i"): 362, 301, 13, 13, traço `--text-secondary`.
- Eixo central dos trapézios: **x ≈ 370**. Lados com inclinação ~0,37 px/px (≈ 20–22 px de recuo por lado).
- Cantos dos trapézios arredondados, raio ≈ 4.

| Etapa | y topo → base (h) | Topo: x esq → dir (largura) | Base: x esq → dir (largura) | Cor medida | Token |
|---|---|---|---|---|---|
| 1 Base contatada | 332 → 390 (58) | 206,3 → 532,4 (326) | 228,2 → 511,1 (283) | #0068FD (topo #0063FC, bordas #0075FD) | `--accent-blue-deep` |
| 2 Cliques | 395 → 453 (58) | 234,5 → 505,0 (270) | 256,5 → 483,3 (227) | #0078FD | **(diverge)** wiki usa `--accent-cyan-light` #6ED5FF; medido é azul. Sugestão: `--accent-blue` #0070F8 |
| 3 Visitas ao site | 458 → 514 (56) | 260,7 → 481,0 (220) | 281,2 → 459,1 (178) | #00B0DD | `--accent-cyan` |
| 4 Cadastro | 520 → 574 (54) | 285,5 → 454,1 (169) | 305,4 → 434,8 (130) | #00C793 | `--accent-green` |
| 5 FTD | 580 → 635 (55) | 309,7 → 430,6 (121) | 329,3 → 410,2 (81) | #00C980 | `--accent-green` (#04C67E) |

Vértices (TL, TR, BR, BL) para `<polygon>`; arredonde os cantos com `stroke-linejoin: round` +
`stroke-width: 8` da mesma cor, ou path com arcos de 4 px:

```
1: 206,332 532,332 511,390 228,390
2: 235,395 505,395 483,453 257,453
3: 261,458 481,458 459,514 281,514
4: 286,520 454,520 435,574 305,574
5: 310,580 431,580 410,635 329,635
```

Gaps entre etapas: 5, 5, 6, 6 px. Gradiente: quase chapado; leve brilho mais claro nas laterais
(+10 de azul). Pode ser cor sólida sem impacto relevante no diff.

Textos dentro (centralizados em x 370, `--text-primary`):

| Etapa | Rótulo topo-cap (largura) | Valor topo-cap (largura) |
|---|---|---|
| 1 | 343 ("Base contatada", 88) | 363 ("320.840", 70) |
| 2 | 408 ("Cliques", 43) | 428 ("40.000", 54) |
| 3 | 471 ("Visitas ao site", 81) | 490 ("30.000", 54) |
| 4 | 531 ("Cadastro", 54) | 551 ("6.000", 42) |
| 5 | 591 ("FTD", 23) | 611 ("600", 29) |

- Rótulo: cap 10 → **13 px**, peso 500, branco a ~85% sobre o acento.
- Valor: cap 14–15 → **20 px**, peso 700 (wiki diz 16/600 — **diverge**).
- Regra: rótulo topo-cap = topo do trapézio + 11…13; valor topo-cap = topo + 31…33.

Coluna de taxas à direita (x 541–543):

| Etapa | Percentual (topo-cap) | Legenda (topo) | Conector y | Ponto (caixa 7 × 7) |
|---|---|---|---|---|
| 1 | "100%" 352 | "(base de referência)" 370 | — (sem conector) | — |
| 2 | "12,5%" 411 | "de conversão" 433 | 419,5 | 522, 416 |
| 3 | "75,0%" 475 | "de conversão" 496 | 481,5 | 522, 478 |
| 4 | "20,0%" 538 | "de conversão" 558 | 545 | 522, 542 |
| 5 | "10,0%" 597 | "de conversão" 618 | 604 | 522, 601 |

- Percentual: cap 11 → **16 px**, peso 700, `--text-primary`. Largura "12,5%" ≈ 41 px; "100%" 36 px.
- Legenda: **11 px**, peso 400, medido #A0B1C4 (≈ `--text-muted` #8FA6BD, um pouco mais claro).
  Largura "de conversão" 64 px; "(base de referência)" 84 px.
- Conector: linha 1 px, cor #4A5D6E (branco ~25%), do interior do trapézio (≈ 24 px antes da borda
  direita, sobreposta ao acento com baixa opacidade) até o centro do ponto em x 525,5. Fica ~3–4 px
  acima do centro vertical do trapézio, alinhada ao meio do percentual.
- Ponto: círculo 7 px, #B4D0F7 (branco azulado), centro x 525,5.

### 2.6 Tabela "Desempenho por canal"

Card: 650, 281, 650, 429; fundo `--bg-card` (medido #061B28 / #051826), borda 1 px, raio 6.

- Título: x 663–835, topo-cap 301, base 313 → **17 px**, peso 600, `--text-primary`. Ícone `info` em 848, 301, 13, 13.
- Linha divisória sob o título em y 330 (1 px, #0B1E2B).

Colunas (bordas x; linhas verticais de 1 px #0B1E2B em toda a altura de 330 a 702):

| # | Coluna | x início → fim | Largura | Alinhamento |
|---|---|---|---|---|
| 1 | Canal | 650 → 720 | 70 | esquerda (ícone x 659, texto x 684; cabeçalho x 661) |
| 2 | Investimento ⇕ | 720 → 795 | 75 | centro |
| 3 | Cliques | 795 → 845 | 50 | centro |
| 4 | Visitas | 845 → 895 | 50 | centro |
| 5 | Cadastros | 895 → 951 | 56 | centro |
| 6 | FTDs · Qtd. | 951 → 1000 | 49 | centro |
| 7 | FTDs · Valor (R$) | 1000 → 1079 | 79 | centro |
| 8 | Depósitos no período (R$) | 1079 → 1160 | 81 | centro |
| 9 | CPA (R$) ⓘ | 1160 → 1230 | 70 | centro |
| 10 | ROAS (Depósitos) ⓘ | 1230 → 1300 | 70 | centro |

Linhas (bordas y; divisórias horizontais 1 px #0B1E2B):

| Faixa | y | Altura |
|---|---|---|
| Título do card | 281 → 330 | 49 |
| Cabeçalho nível 1 (só "FTDs" sobre col. 6–7) | 330 → 360 | 30 |
| Cabeçalho nível 2 ("Qtd.", "Valor (R$)") | 360 → 397 | 37 |
| Cabeçalho completo (demais colunas, rowspan 2) | 330 → 397 | 67 |
| Meta | 397 → 446 | 49 |
| Email | 446 → 495 | 49 |
| SMS | 495 → 543 | 48 |
| Afiliados | 543 → 591 | 48 |
| Outros | 591 → 640 | 49 |
| Total | 640 → 702 | 62 |

Linha horizontal intermediária do cabeçalho em y 360 só entre x 951 e 1079.

Cabeçalho:
- 12 px, peso 400, `--text-secondary` (medido #BFCBD7); colunas de rowspan com texto centralizado
  verticalmente em 330–397 (topo-cap 357, base 366).
- "FTDs": topo-cap 342 (centrado em 330–360). "Qtd." e "Valor (R$)": topo-cap 374.
- "Depósitos no / período / (R$)": 3 linhas, topo 343 → base 384, entrelinha 14.
- "CPA / (R$)": 2 linhas (topo 340 → 378) com ícone `info` 1207, 340, 12, 13 à direita de "CPA".
- "ROAS / (Depósitos)": 2 linhas (341 → 379) com ícone `info` 1279, 340, 12, 13 em **verde** (#409EA1 ≈ `--accent-teal`).
- Ícone `ordenar` (⇕) após "Investimento": 785, 357, 6, 10.

Células:
- 12–13 px, peso 400, `--text-primary` (medido #DBE4EE), centralizadas na coluna e na linha
  (topo-cap = topo da linha + 20; ex. Meta 417 → 426).
- ROAS das linhas de canal: cor verde medida #3FBCAC–#42C9BA → `--positive`/`--accent-teal`
  (texto pequeno antialiasado; recomendo `--accent-teal` #24CCB6 para casar o tom medido).
- Coluna Canal: ícone 18 × 18 em x 659, centrado na linha; texto x 684. "Meta", "Email", "SMS":
  12 px (cap 8–9). **"Afiliados" e "Outros" são menores: ~9 px** (cap 6–7) na referência.
- Linha Total: fundo `--bg-total-row` (medido #0D2644 / #0B2644), y 640–702, largura total do card;
  divisórias verticais dentro dela mais escuras (#011C38). Texto 13 px, peso 600, `--text-primary`;
  "Total" em x 661; ROAS total em branco (não verde).
- Abaixo do Total (702 → 710): fundo do card.

### 2.7 Botões, ícones utilitários e estados

- Exportar: ver 2.2. Hover sugerido: fundo +4% de branco; foco: anel 2 px `--accent-blue` com offset 2 —
  estados não aparecem na referência e não entram no diff.
- Filtros: chevron 9 × 5; o campo interno é a área clicável.
- Limpar filtros: ver 2.3.

---

## 3. Textos literais por componente (ordem visual)

| Componente | Textos (exatos, incluindo pontuação) |
|---|---|
| Sidebar | (logo) · "Visão Geral" · "Gestão de Custos" · "Relatórios" · "Ajuda" |
| Cabeçalho | "Visão Geral de Aquisição" · "Acompanhe os resultados do marketing de forma simples e objetiva." · "Dados atualizados em:" · "24/05/2024 08:30" · "Exportar" |
| Filtros | "Período." · "01/05/2024 - 24/05/2024" · "Comparar com" · "Período anterior" · "Canal" · "Todos" · "Campanha" · "Todas" · "Limpar filtros" |
| KPI 1 | "Investimento total" · "R$ 33.840" · ▲ "12,5%" · "vs. período anterior" |
| KPI 2 | "FTDs" · "995" · ▲ "18,6%" · "vs. período anterior" |
| KPI 3 | "Custo por FTD (CPA)" · "R$ 33,97" · ▼ "-5,4%" · "vs. período anterior" |
| KPI 4 | "Depósitos no período" · "R$ 226.190" · ▲ "22,1%" · "vs. período anterior" |
| KPI 5 | "ROAS (Depósitos)" · "6,68x" · ▲ "16,8%" · "vs. período anterior" |
| Funil | "Funil de Aquisição" · "Base contatada" "320.840" · "Cliques" "40.000" · "Visitas ao site" "30.000" · "Cadastro" "6.000" · "FTD" "600" · "100%" "(base de referência)" · "12,5%" "de conversão" · "75,0%" "de conversão" · "20,0%" "de conversão" · "10,0%" "de conversão" |
| Tabela — cabeçalho | "Desempenho por canal" · "Canal" · "Investimento" · "Cliques" · "Visitas" · "Cadastros" · "FTDs" · "Qtd." · "Valor (R$)" · "Depósitos no" / "período" / "(R$)" · "CPA" / "(R$)" · "ROAS" / "(Depósitos)" |
| Tabela — Meta | "Meta" · "R$ 13.260" · "19.823" · "9.138" · "1,900" · "250" · "R$ 37.690" · "R$ 58.750" · "R$ 53,04" · "4,43x" |
| Tabela — Email | "Email" · "R$ 10.890" · "15.630" · "7.082" · "1.100" · "210" · "R$ 29.420" · "R$ 45.800" · "R$ 51,86" · "4,20x" |
| Tabela — SMS | "SMS" · "R$ 8.740" · "10.512" · "4.921" · "520" · "85" · "R$ 12.580" · "R$ 18.250" · "R$ 102,82" · "2,09x" |
| Tabela — Afiliados | "Afiliados" · "-" · "12.631" · "10.251" · "2.800" · "420" · "R$ 51.870" · "R$ 96.280" · "-" · "-" |
| Tabela — Outros | "Outros" · "R$ 950" · "1,420" · "862" · "48" · "30" · "R$ 5.640" · "R$ 7.110" · "R$ 31,67" · "7,48x" |
| Tabela — Total | "Total" · "R$ 33.840" · "70.386" · "32.254" · "6.368" · "995" · "R$ 137.780" · "R$ 226.190" · "R$ 33,97" · "6,68x" |

Notas: o traço de células vazias é hífen ASCII "-". "1,900" e "1,420" aparecem com vírgula na imagem
(conferido pixel a pixel; "15.630" usa ponto). Para o diff do protótipo estático, reproduzir a vírgula;
as fixtures (P1.3) já documentam que o dado real é 1.900 e 1.420.

---

## 4. Ícones necessários

Todos em SVG, `viewBox` quadrado, `currentColor`. Tamanho = caixa ocupada na referência.

| Nome | Tamanho (px) | Onde | Desenho |
|---|---|---|---|
| `visao-geral` | 18 × 18 | Sidebar, item ativo | 4 barras verticais cheias, alturas crescentes da esquerda para a direita, base alinhada, cantos levemente arredondados |
| `gestao-custos` | 18 × 20 | Sidebar | banco de dados: cilindro empilhado (3 discos) em contorno, traço ~1,6 |
| `relatorios` | 18 × 20 | Sidebar | folha com canto dobrado no topo direito e 3 linhas de texto, contorno |
| `ajuda` | 19 × 19 | Sidebar, rodapé | círculo em contorno com "?" dentro |
| `exportar` | 17 × 17 | Botão Exportar | seta para baixo entrando numa bandeja (U aberto), contorno |
| `chevron-down` | 9 × 5 | Exportar e 4 filtros | V aberto, traço 1,5, pontas arredondadas |
| `calendario` | 14 × 18 | Filtro Período | calendário cheio com 2 argolas no topo e grade de quadrados |
| `limpar` | 20 × 17 | Botão Limpar filtros | funil de filtro (triângulo invertido com haste), contorno |
| `investimento` | 28 × 28 | Tile KPI 1 | pilhas de moedas: 3 moedas empilhadas à esquerda + 2 à direita, cheio |
| `ftds` | 27 × 26 | Tile KPI 2 | pessoa (cabeça + ombros) grande e uma menor à direita/abaixo, cheio |
| `cpa` | 26 × 28 | Tile KPI 3 | alvo: círculos concêntricos com seta/dardo entrando pelo canto superior direito, contorno |
| `depositos` | 27 × 27 | Tile KPI 4 | carteira cheia com fecho/aba à direita |
| `roas` | 27 × 28 | Tile KPI 5 | gráfico de 4 barras crescentes com seta ascendente diagonal por cima |
| `seta-alta` | 10 × 9 | Delta positivo | triângulo cheio apontando para cima |
| `seta-baixa` | 10 × 9 | Delta do CPA | triângulo cheio apontando para baixo |
| `info` | 13 × 13 | Títulos do Funil e da Tabela; cabeçalhos CPA e ROAS | círculo em contorno com "i" |
| `ordenar` | 6 × 10 | Cabeçalho Investimento | dois chevrons (cima e baixo) empilhados |
| `canal-meta` | 18 × 18 | Tabela, Meta | símbolo de infinito azul (#1B8EE1) sobre círculo preto |
| `canal-email` | 18 × 15 | Tabela, Email | envelope cheio ciano (#20E8BC) com aba em V escura |
| `canal-sms` | 18 × 18 | Tabela, SMS | balão de fala azul (#1080F1) com "sms" escrito dentro |
| `canal-afiliados` | 18 × 18 | Tabela, Afiliados | três pessoas em pirâmide (1 em cima, 2 embaixo), ciano (#27EBC5) |
| `canal-outros` | 18 × 18 | Tabela, Outros | três pontos amarelos (#EDEB3A) sobre círculo preto |

O ponto de status (11 px) e os pontos dos conectores (7 px) são círculos CSS/SVG simples, não ícones.

---

## 5. Sparklines

Os 5 sparklines têm **a mesma forma** na referência (diferença ≤ 1 px entre eles). Caixa 52 × 23,
y 224–247 em todos os cards (x na tabela da seção 2.4).

- Linha: 1,5–2 px, cor medida #3CC9B8–#46D2C3 (`--positive` com antialias; usar `--positive` a ~85%).
- Área sob a linha: gradiente vertical de `--positive` a ~30% (junto à linha) até 0% na base da caixa.
- Brilho leve (glow) em volta da linha; opcional, impacto pequeno no diff.

Pontos normalizados (12 amostras igualmente espaçadas em x, y = 0 embaixo, 1 em cima), iguais para os 5:

| Card | Pontos (0–1) |
|---|---|
| 1 Investimento | 0,02 · 0,05 · 0,24 · 0,52 · 0,52 · 0,38 · 0,33 · 0,57 · 0,76 · 0,76 · 0,86 · 1,00 |
| 2 FTDs | 0,02 · 0,05 · 0,22 · 0,52 · 0,52 · 0,38 · 0,36 · 0,57 · 0,76 · 0,76 · 0,88 · 1,00 |
| 3 CPA | 0,00 · 0,05 · 0,19 · 0,48 · 0,52 · 0,38 · 0,33 · 0,57 · 0,76 · 0,76 · 0,86 · 1,00 |
| 4 Depósitos | 0,02 · 0,05 · 0,24 · 0,52 · 0,48 · 0,38 · 0,43 · 0,62 · 0,76 · 0,76 · 0,90 · 1,00 |
| 5 ROAS | 0,02 · 0,05 · 0,19 · 0,52 · 0,52 · 0,38 · 0,38 · 0,57 · 0,76 · 0,76 · 0,90 · 1,00 |

Polilinha exata do card 1 em coordenadas locais da caixa 52 × 23 (x, y com y para baixo), útil
para um `<polyline>` único reaproveitado nos 5 cards:

```
0,22 3,20 6,21 9,17 12,13 15,10 18,11 21,13 24,15 27,15 30,12 33,8 36,6 39,7 42,6 45,4 48,2 51,1
```

(Na CPA a linha também sobe, apesar do delta negativo.)

---

## 6. Observações para fidelidade (diff ≤ 2% a 1315 px)

O canvas tem 933.650 px; 2% = **18.673 px**. O orçamento acaba rápido se uma área grande errar.

Crítico (áreas grandes, cada uma pode sozinha estourar o limite):
1. **Faixas de artefato**: a faixa preta de 4 px no topo (5.260 px) e a de 3 px à direita (2.118 px)
   somam 0,8% do canvas. Reproduzir com divs sólidas.
2. **Fundo da área principal e da sidebar**: diferenças de cor de fundo contam em quase todo o canvas.
   Com `threshold` 0,1 do pixelmatch, erros de ±3–4 níveis passam; erros de ~10 níveis (ex. usar
   #03111E chapado onde o medido é #071829) podem falhar em faixas largas. Usar os valores medidos.
3. **Trapézios do funil** (≈ 45 mil px de cor saturada): vértices e cores da seção 2.5. Um deslocamento
   de 2 px na lateral de todos os trapézios custa ~1.100 px.
4. **Linha Total da tabela** (650 × 62 = 40 mil px) e **item ativo do menu** (160 × 40): cor de fundo exata.
5. **Tiles dos KPIs** (5 × 46 × 46) e **botão Limpar filtros** (162 × 58): fundo escurecido, não o acento puro.
6. **Posições de card**: larguras desiguais dos KPIs e proporção 444/650 embaixo. Um card 10 px fora
   desloca bordas, texto e sparkline de uma vez.

Tolerável (pouco peso no diff):
- Antialiasing e hinting de texto (Chromium Linux vs. captura original). O texto ocupa talvez 4–6% do
  canvas; mesmo que 30% dos pixels de texto difiram, são ~1,5%. Por isso **a fonte e a largura dos textos
  são o segundo maior risco**: se o texto ficar 15% mais largo, cada linha desalinha inteira.
- Bordas de 1 px dos cards, linhas da tabela, conectores e pontos do funil.
- Brilho/gradiente fino dentro dos trapézios e dos cards; glow das sparklines.
- Desenho interno dos ícones (contam poucos pixels cada).

Fonte (maior incerteza): a referência usa uma sans **mais estreita que Inter e que Segoe UI**. Na
mesma altura de maiúscula, "R$ 33.840" mede 85 px na imagem contra ~98 px em Segoe UI Semibold e ~108 px
em Inter; "Gestão de Custos" mede 101 px contra ~120 px em Segoe UI. Títulos grandes batem melhor
(título: 300 px medidos vs. 300 em Segoe UI 27 px). Calibrar no P1.5 usando as larguras desta página
como alvo: testar fonte com eixo de largura (ex.: Noto Sans/Open Sans variável com `wdth` ~85–90, ou
Roboto Flex) e/ou `letter-spacing` negativo nos números (−0,02 a −0,04 em). Não mexer em layout
para compensar fonte.
