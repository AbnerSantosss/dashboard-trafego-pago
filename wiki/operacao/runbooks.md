---
tipo: operacao
atualizado: 2026-10-15
tags: [runbook, onboarding, segredo, reprocessamento, dead-letter]
---

# Runbooks

Esboço; cada runbook ganha passos exatos quando a funcionalidade existir (Fase 5 e 6).

## Onboarding de empresa
1. Admin global cria o tenant (slug, nome, moeda, fuso).
2. Apresentação: nome exibido e logo (PASIO já vem com o ícone oficial). Ver [[administracao-multiempresa/configuracao-por-empresa]].
3. Cria a primeira fonte; copia URL e segredo para o sistema emissor.
4. Configura regras de mapeamento e canal; valida com a simulação.
5. Envia evento de teste com `webhook-sim`; confere no painel.
6. Convida usuários com papéis.

## Rotação de segredo
Gerar novo segredo na fonte → período de graça de 24 h em que ambos valem → atualizar o emissor → revogar o antigo. Eventos com assinatura antiga após a revogação caem em 401 e ficam visíveis no log da fonte.

## Reprocessamento
Publicar nova versão de regras → escolher intervalo ou fonte → confirmar → job em lote recalcula `events` e `metrics_daily` do intervalo. Monitorar progresso na tela de dead-letter.

## Dead-letter
Lista de `webhook_events` com status `erro`, motivo e payload. Ações: reprocessar com a versão atual, marcar como ignorado, exportar.

## Ambiente local
```
docker compose up -d      # PostgreSQL
pnpm install
pnpm db:migrate && pnpm db:seed   # empresa demo com os dados da imagem
pnpm dev                  # web em :3000, api em :3001
```
Variáveis em `.env.example` (sem valores). Nenhum segredo no repositório ([[decisoes-tecnicas/decisoes]] D8).

Relacionado: [[ingestao-webhooks/contrato-webhook]], [[arquitetura/stack]].
