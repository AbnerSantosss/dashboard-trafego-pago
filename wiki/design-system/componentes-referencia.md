---
tipo: design-system
atualizado: 2026-10-16
tags: [componentes, layout, referencia, acessibilidade, movimento]
---

# Componentes da tela de referência

Spec detalhada com px, entregue em P1.2 (2026-10-15): `design/componentes.md` (grade, caixas, cores, fonte, vértices do funil, colunas da tabela, orçamento do diff). Esta página fixa o resumo do que a imagem mostra; a spec manda em caso de diferença.

1. **Sidebar** (180 px, `--bg-sidebar`): logo no topo (PASIO: ícone oficial + nome; trocáveis por empresa), menu Visão Geral (ativo, `--bg-nav-active`, raio 8), Gestão de Custos, Relatórios, com ícone de linha à esquerda. A imagem mostra ainda a Ajuda na última linha; ela saiu do app (D38). Fora da imagem: Configurações logo abaixo de Relatórios (y 237.5) e o rodapé de conta colado ao fim da coluna (D35, D38), com avatar de iniciais, nome, e-mail e Sair. Avatar, nome e e-mail formam um link para o Perfil (D36).
2. **Cabeçalho**: "Visão Geral de Aquisição" (28/600) e "Acompanhe os resultados do marketing de forma simples e objetiva." (15, `--text-secondary`); à direita "Dados atualizados em: 24/05/2024 08:30" com ponto `--positive` e botão "Exportar ▾" (`--bg-button`).
3. **Barra de filtros** (56 px, `--bg-filter`): Período, Comparar com, Canal, Campanha; botão "Limpar filtros" verde contornado.
4. **Cinco cards de KPI** (112 px, gap 12): tile 44 px colorido, rótulo, valor 24/600, delta com seta e "vs. período anterior", sparkline verde à direita.
5. **Funil de Aquisição** (34%): cinco trapézios empilhados com gradiente azul → ciano → verde, rótulo e valor dentro, conectores para a taxa à direita.
6. **Desempenho por canal** (66%): cabeçalho em dois níveis (FTDs: Qtd., Valor (R$)), ROAS em verde, linha Total destacada.
7. **Botões e estados**: Exportar com seta; filtros com chevron. Desde 2026-10-16 (D30):
   - foco visível com contorno ciano de 2 px nos menus Exportar e Período;
   - dicas ⓘ com `role=tooltip`, que abrem no foco, no hover e no clique;
   - KPIs esmaecidos (`filter: opacity`) durante o carregamento;
   - faixa de erro com "Tentar de novo";
   - link "Pular para o conteúdo".

   Nada disso aparece no estado de repouso.
8. **Movimento** (D29, `@trafego/graficos/src/movimento.ts` e a regra `.entrada` de `tela.css`):
   - entrada dos cards em CSS;
   - `Contador` por `requestAnimationFrame`;
   - funil crescendo em `scaleX`;
   - sparkline revelada por `clip-path`.

   Só sob `prefers-reduced-motion: no-preference`, e o estado final é o mesmo do SSR.
9. **Funil interativo** (D34): hover e foco acendem a etapa com neon (filtro SVG) sem escurecer as outras. O clique abre a `GavetaFunil` à direita, com a lista da etapa por canal e, ao clicar numa pessoa, a ficha (origem com UTMs e click ids, linha do tempo, corpo dos webhooks). Nada disso aparece parado, então o diff não muda.

Telas internas fora do diff (Relatórios): `FundoOndas` (D37) é o fundo de ondas em SVG atrás do conteúdo, com geometria em `componentes/fundo-ondas.ts`. A animação para sozinha em cerca de 86 s. Não entra no painel `/`.

Componentes das Configurações (fora do diff, D23): `BotaoConfirmar` (`Confirmar.tsx`, diálogo para ações destrutivas, D25) e `Copiavel` (`instalacao/Copiavel.tsx`, valor ou bloco de código com botão Copiar), ver [[administracao-multiempresa/configuracao-por-empresa]].

Critério de aceite da tela: diff ≤ 2% contra a imagem a 1315 px. Ver [[qa-visual/fidelidade-visual]].
