---
tipo: indice
atualizado: 2026-10-19
tags: [wiki, indice, dashboard, trafego-pago, multiempresa]
---

# Dashboard de Tráfego Pago Multiempresa (PASIO)

Painel de resultados de aquisição (investimento, FTDs, CPA, depósitos, ROAS, funil e canais) alimentado por webhooks, com configuração de webhooks, regras de tratamento e apresentação por empresa. Primeira empresa: PASIO (pasion.poker). Projeto técnico.

Documento-mestre: `PLANO-DE-ACAO.md` na raiz (8 fases; fases 5–7 enxutas desde D15). Painel interativo do plano: https://claude.ai/artifact/KcEDCoT1Qws3MjLLHMFgY6

## Comece por aqui
- [[operacao/retomada]] — onde o trabalho parou, CI, próximos passos em ordem, como subir local
- [[operacao/producao]] — painel no ar em `kapanda.lat`: endereços, stack do Portainer, túnel, segredos, atualizar, backup

## Como usar esta wiki
- Antes de mexer em qualquer área, leia a página da categoria correspondente.
- Toda decisão que os commits não explicam vai em [[decisoes-tecnicas/decisoes]].
- Toda entrega relevante gera entrada em [[log]] no formato `## [AAAA-MM-DD] <tipo> | <resumo>`.
- Convenções: frontmatter YAML (`tipo`, `atualizado`, `tags`), nomes kebab-case sem acento, links `[[nome]]`.

## Arquitetura
- [[arquitetura/visao-geral]] — fluxo webhook → regras → agregação → painel, limites do sistema
- [[arquitetura/stack]] — monorepo pnpm, Next.js, Fastify, PostgreSQL, d3, movimento em CSS + rAF, pacotes contratos e graficos, imagens Docker de produção
- [[arquitetura/modelo-de-dados]] — tabelas, isolamento por tenant, tipos canônicos de evento

## Decisões técnicas
- [[decisoes-tecnicas/decisoes]] — registro de decisões (ADR) com motivo e consequências

## Design system
- [[design-system/tokens]] — paleta, tipografia, espaçamentos e raios da imagem de referência; tokens de estado e das Configurações
- [[design-system/componentes-referencia]] — cada bloco da tela Visão Geral com medidas
- [[design-system/dados-de-referencia]] — valores exatos da imagem usados como fixture

## Ingestão por webhooks
- [[ingestao-webhooks/contrato-webhook]] — endpoint, assinatura, idempotência, respostas, fila

## Regras de tratamento
- [[regras-de-tratamento/motor-de-regras]] — mapeamento JSONPath, classificação de canal, versionamento
- [[regras-de-tratamento/metricas-e-kpis]] — definição de cada KPI, funil e taxa

## Administração multiempresa
- [[administracao-multiempresa/configuracao-por-empresa]] — aba Instalação (passo a passo), webhooks, regras, apresentação, usuários, convites, perfil, tag GTM

## QA visual
- [[qa-visual/fidelidade-visual]] — gates G0 a G4, limite do CI (5,5%), medições, como medir igual ao CI e armadilhas

## Operação
- [[operacao/producao]] — o que está no ar (endereços, stack `trafego-pasio`, rotas do túnel, segredos gerados no servidor), senha do admin, atualizar, logs, backup, armadilhas e pendências
- [[operacao/deploy-kapanda]] — plano e execução da passagem para `kapanda.lat` (zona na Cloudflare, rotas do túnel, variáveis da stack, Tag no GTM, agentes)
- [[operacao/runbooks]] — onboarding de empresa, rotação de segredo (sem carência), reprocessamento, dead-letter, instalação de produção do zero
- [[operacao/retomada]] — estado atual e próximos passos
- [[operacao/ambiente-e-seguranca]] — repositório público, segredos, alvos que exigem confirmação, rotina

## Orquestração de agentes
- [[orquestracao-agentes/agentes-e-fases]] — orquestrador, subagentes, áreas exclusivas, fases, gates e o formato de workflow usado na rodada de UX

## Registro
- [[log]] — histórico curado da wiki
