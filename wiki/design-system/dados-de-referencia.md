---
tipo: design-system
atualizado: 2026-10-15
tags: [fixtures, referencia, dados]
---

# Dados exatos da imagem (fixtures)

Usados como seed da empresa demo (P2.4) e nos testes visuais. Em código: `packages/fixtures/referencia.json` (P1.3).

## KPIs
| KPI | Valor | Variação | Tile |
|---|---|---|---|
| Investimento total | R$ 33.840 | ▲ 12,5% | #0070F8 |
| FTDs | 995 | ▲ 18,6% | #0070F8 |
| Custo por FTD (CPA) | R$ 33,97 | ▼ -5,4% | #E13C5D |
| Depósitos no período | R$ 226.190 | ▲ 22,1% | #24CCB6 |
| ROAS (Depósitos) | 6,68x | ▲ 16,8% | #34DFCE |

## Funil
Base contatada 320.840 (100%, base de referência) · Cliques 40.000 (12,5%) · Visitas ao site 30.000 (75,0%) · Cadastro 6.000 (20,0%) · FTD 600 (10,0%).

## Canais
| Canal | Invest. | Cliques | Visitas | Cadastros | FTDs Qtd. | FTDs Valor | Depósitos | CPA | ROAS |
|---|---|---|---|---|---|---|---|---|---|
| Meta | 13.260 | 19.823 | 9.138 | 1.900 | 250 | 37.690 | 58.750 | 53,04 | 4,43x |
| Email | 10.890 | 15.630 | 7.082 | 1.100 | 210 | 29.420 | 45.800 | 51,86 | 4,20x |
| SMS | 8.740 | 10.512 | 4.921 | 520 | 85 | 12.580 | 18.250 | 102,82 | 2,09x |
| Afiliados | – | 12.631 | 10.251 | 2.800 | 420 | 51.870 | 96.280 | – | – |
| Outros | 950 | 1.420 | 862 | 48 | 30 | 5.640 | 7.110 | 31,67 | 7,48x |
| Total | 33.840 | 70.386 | 32.254 | 6.368 | 995 | 137.780 | 226.190 | 33,97 | 6,68x |

Armadilha: o funil (600 FTDs) e a tabela (995 FTDs) não batem entre si na imagem; são dados ilustrativos. O seed deve reproduzir a imagem como está, e a agregação real nunca precisa conciliar os dois.

## Correções (P1.3)
- Variação dos KPIs: a imagem não mostra sinal "+"; a seta (▲/▼) é um ícone separado e o texto é "12,5%", "18,6%", "22,1%", "16,8%". O negativo usa hífen ASCII ("-5,4%"), não o sinal de menos U+2212. Tabela de KPIs acima corrigida.
- Inconsistências internas da imagem, reproduzidas como estão (documentadas em `packages/fixtures/src/referencia.test.ts`): Total de Cliques 70.386 (soma das linhas = 60.016); Total de FTDs Valor R$ 137.780 (soma = 137.200); CPA total R$ 33,97 (33.840 / 995 = 34,01); ROAS Email 4,20x (45.800 / 10.890 = 4,2057).
- Erro tipográfico da imagem: "1,900" (Meta, Cadastros) e "1,420" (Outros, Cliques) aparecem com vírgula. O dado é 1.900 e 1.420; as fixtures formatam no padrão pt-BR com ponto.
- Textos da tela transcritos nas fixtures: filtro "Período." (com ponto), intervalo "01/05/2024 - 24/05/2024" (hífen), menu Visão Geral / Gestão de Custos / Relatórios / Ajuda, base do funil "100%" sem casa decimal com legenda "(base de referência)", demais etapas com "de conversão".
