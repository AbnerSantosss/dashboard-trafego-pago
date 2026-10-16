---
tipo: indice
atualizado: 2026-10-15
tags: [wiki, indice, dashboard, trafego-pago, multiempresa]
---

# Dashboard de Tráfego Pago Multiempresa (PASIO)

Painel de resultados de aquisição (investimento, FTDs, CPA, depósitos, ROAS, funil e canais) alimentado por webhooks, com configuração de webhooks, regras de tratamento e apresentação por empresa. Primeira empresa: PASIO (pasion.poker). Projeto técnico.

Documento-mestre: `PLANO-DE-ACAO.md` na raiz (8 fases; fases 5–7 enxutas desde D15). Painel interativo do plano: https://claude.ai/artifact/KcEDCoT1Qws3MjLLHMFgY6

## Como usar esta wiki
- Antes de mexer em qualquer área, leia a página da categoria correspondente.
- Toda decisão que os commits não explicam vai em [[decisoes-tecnicas/decisoes]].
- Toda entrega relevante gera entrada em [[log]] no formato `## [AAAA-MM-DD] <tipo> | <resumo>`.
- Convenções: frontmatter YAML (`tipo`, `atualizado`, `tags`), nomes kebab-case sem acento, links `[[nome]]`.

## Arquitetura
- [[arquitetura/visao-geral]] — fluxo webhook → regras → agregação → painel, limites do sistema
- [[arquitetura/stack]] — monorepo pnpm, Next.js, Fastify, PostgreSQL, d3, GSAP, pacotes contratos e graficos
- [[arquitetura/modelo-de-dados]] — tabelas, isolamento por tenant, tipos canônicos de evento

## Decisões técnicas
- [[decisoes-tecnicas/decisoes]] — registro de decisões (ADR) com motivo e consequências

## Design system
- [[design-system/tokens]] — paleta, tipografia, espaçamentos e raios extraídos da imagem de referência
- [[design-system/componentes-referencia]] — cada bloco da tela Visão Geral com medidas
- [[design-system/dados-de-referencia]] — valores exatos da imagem usados como fixture

## Ingestão por webhooks
- [[ingestao-webhooks/contrato-webhook]] — endpoint, assinatura, idempotência, respostas, fila

## Regras de tratamento
- [[regras-de-tratamento/motor-de-regras]] — mapeamento JSONPath, classificação de canal, versionamento
- [[regras-de-tratamento/metricas-e-kpis]] — definição de cada KPI, funil e taxa

## Administração multiempresa
- [[administracao-multiempresa/configuracao-por-empresa]] — webhooks, regras, apresentação (logo, nome, paleta), usuários

## QA visual
- [[qa-visual/fidelidade-visual]] — gates G0 a G4, limite de 2% de diff, como rodar a comparação

## Operação
- [[operacao/runbooks]] — onboarding de empresa, rotação de segredo, reprocessamento, dead-letter

## Orquestração de agentes
- [[orquestracao-agentes/agentes-e-fases]] — orquestrador, nove subagentes, áreas exclusivas, fases e gates

## Registro
- [[log]] — histórico curado da wiki
