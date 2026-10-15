---
tipo: design-system
atualizado: 2026-10-15
tags: [componentes, layout, referencia]
---

# Componentes da tela de referência

Spec detalhada com px, entregue em P1.2 (2026-10-15): `design/componentes.md` (grade, caixas, cores, fonte, vértices do funil, colunas da tabela, orçamento do diff). Esta página fixa o resumo do que a imagem mostra; a spec manda em caso de diferença.

1. **Sidebar** (180 px, `--bg-sidebar`): logo no topo (PASIO: ícone oficial + nome; trocáveis por empresa), menu Visão Geral (ativo, `--bg-nav-active`, raio 8), Gestão de Custos, Relatórios, Ajuda, com ícone de linha à esquerda.
2. **Cabeçalho**: "Visão Geral de Aquisição" (28/600) e "Acompanhe os resultados do marketing de forma simples e objetiva." (15, `--text-secondary`); à direita "Dados atualizados em: 24/05/2024 08:30" com ponto `--positive` e botão "Exportar ▾" (`--bg-button`).
3. **Barra de filtros** (56 px, `--bg-filter`): Período, Comparar com, Canal, Campanha; botão "Limpar filtros" verde contornado.
4. **Cinco cards de KPI** (112 px, gap 12): tile 44 px colorido, rótulo, valor 24/600, delta com seta e "vs. período anterior", sparkline verde à direita.
5. **Funil de Aquisição** (34%): cinco trapézios empilhados com gradiente azul → ciano → verde, rótulo e valor dentro, conectores para a taxa à direita.
6. **Desempenho por canal** (66%): cabeçalho em dois níveis (FTDs: Qtd., Valor (R$)), ROAS em verde, linha Total destacada.
7. **Botões e estados**: Exportar com seta; filtros com chevron; hover/foco a definir sem quebrar a fidelidade.

Critério de aceite da tela: diff ≤ 2% contra a imagem a 1315 px. Ver [[qa-visual/fidelidade-visual]].
