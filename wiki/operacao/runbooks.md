---
tipo: operacao
atualizado: 2026-10-16
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
Configurações → Webhooks → "Rotacionar segredo" (ou "Gerar segredo", quando a fonte não tem segredo utilizável) → confirmar no diálogo (D25) → copiar o segredo novo, exibido uma única vez → atualizar a plataforma emissora.

**Não há período de graça:** o segredo antigo deixa de valer no clique. Até a plataforma receber o novo, os eventos dela são recusados com 401 e aparecem nas entregas da fonte (aba Instalação, passo "regras"). Faça a troca quando a plataforma puder ser atualizada logo em seguida. Ter dois segredos válidos ao mesmo tempo é uma melhoria pendente ([[operacao/retomada]]).

## Token do Meta Ads
1. No Gerenciador de Negócios: Configurações do negócio → Usuários do sistema → criar ou escolher um usuário do sistema.
2. Dar a ele acesso à conta de anúncios (ao menos visualização).
3. "Gerar novo token", com a permissão `ads_read` e validade "nunca expira".
4. No painel: Configurações → Meta Ads → colar o ID da conta (`act_…` ou só os números) e o token → Conectar.
- O token fica só cifrado no banco; nunca vai para log, wiki ou commit. Se o Meta recusar (erro 190, token expirado), a conta mostra o erro na coluna Situação: use "Trocar token".
- Versão da Graph API: `v23.0`, trocável por `META_GRAPH_VERSAO`.

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
