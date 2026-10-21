---
tipo: especificacao
atualizado: 2026-10-21
tags: [kpi, metricas, funil, roas, cpa, redeposito]
---

# Métricas e KPIs

Agregadas em `metrics_daily` por empresa, dia, canal, campanha e página. O painel soma o período e divide os derivados depois da soma (nunca média de razões).

## KPIs do topo (ordem e cores da imagem)
| KPI | Fórmula | Formato | Tile |
|---|---|---|---|
| Investimento total | Σ gasto | R$ sem centavos | azul |
| FTDs | Σ ftds (quantidade) | inteiro | azul |
| Custo por FTD (CPA) | Σ gasto / Σ ftds | R$ com centavos | vermelho |
| Depósitos no período | Σ depósitos (valor) | R$ sem centavos | teal |
| ROAS (Depósitos) | Σ depósitos / Σ gasto | `0,00x` | teal claro |

Variação = (atual − comparação) / comparação, com seta ↑ verde ou ↓ vermelha e texto "vs. período anterior". Comparação padrão: período imediatamente anterior de mesma duração.

## Funil
Base contatada → Cliques → Visitas ao site → Cadastro → FTD. Taxa de cada etapa = etapa / etapa anterior (a primeira mostra 100%). Base contatada vem de eventos `clique` com `base=true` (coluna `events.base`; esses cliques contam em `base_contatada` e **não** em `cliques`, D14) ou de uma fonte de envio (email/SMS), configurável por empresa. Na demo os valores do funil vivem no canal reservado `__funil__` (D11).

**Redepósito (implementado em 2026-10-21, D43)**: sexta etapa abaixo de FTD, com a quantidade de eventos `deposito` no período (mesmos filtros de canal e campanha) e taxa = redepósitos / FTD, que pode passar de 100%. `IndicadoresAgregados.redepositos` é `null` quando a empresa nunca teve um `deposito`; nesse caso, e no funil da demo (`__funil__`), a etapa não aparece e o funil segue com 5 trapézios. Clicar na etapa abre a lista dos eventos `deposito`. Detalhes em [[decisoes-tecnicas/decisoes]], D43.

## Tabela por canal
Investimento, Cliques, Visitas, Cadastros, FTDs (Qtd. e Valor), Depósitos, CPA, ROAS, mais linha Total. Canal sem gasto exibe `–` em CPA e ROAS.

## Formatação (pt-BR)
Milhar com ponto, decimal com vírgula, moeda `R$ 33.840`, percentuais com uma casa (`+12,5%`), ROAS com duas casas e `x`.

## Armadilhas
- Depósitos inclui FTDs ou não? Na imagem, "Depósitos" (226.190) é maior que "FTDs Valor" (137.780), então inclui. Configurável por empresa; o padrão inclui.
- Fuso: dia fecha no fuso da empresa, não em UTC.

Relacionado: [[design-system/dados-de-referencia]], [[regras-de-tratamento/motor-de-regras]].
