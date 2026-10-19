---
tipo: arquitetura
atualizado: 2026-10-19
tags: [arquitetura, webhooks, multiempresa, fluxo]
---

# Visão geral da arquitetura

O mapa completo de produção e do código (Cloudflare, túnel, contêineres, rotas e a origem de cada número do painel) está em [[arquitetura/mapa-do-sistema]].

Sistema web multiempresa que recebe eventos por webhook, trata conforme regras de cada empresa, agrega por dia e exibe um dashboard idêntico à imagem de referência.

## Fluxo principal
```
POST /webhooks/{empresa}/{fonte}
  → valida HMAC-SHA256 (segredo da fonte), timestamp (janela de 5 min), id do evento (idempotência)
  → grava webhook_events (payload jsonb, cabeçalhos, status=recebido) → responde 202
  → fila (pg-boss) → regras da fonte (versão ativa) → evento canônico em events
  → classificador de canal → agregação diária em metrics_daily
  → API de métricas (período, comparação, canal, campanha) → dashboard
```

## Limites e princípios
- **Isolamento**: todo dado tem `tenant_id`; RLS no PostgreSQL; segredo por fonte; o painel lê só a empresa ativa do usuário. Ver [[arquitetura/modelo-de-dados]].
- **Bruto nunca se perde**: o payload é gravado antes de qualquer tratamento. Falha de regra vai para dead-letter com motivo; reprocessamento em lote reaplica regras novas. Ver [[ingestao-webhooks/contrato-webhook]].
- **Configuração por empresa**: webhooks, regras, apresentação e usuários. Ver [[administracao-multiempresa/configuracao-por-empresa]].
- **Fidelidade visual** é o critério número um: ver [[qa-visual/fidelidade-visual]].

## Fora de escopo (primeira entrega)
Integração direta com APIs de anúncios (só webhook), billing, apps móveis.

## Armadilhas conhecidas
- Hyperframes é framework de vídeo: usamos só a doutrina de animação e o catálogo de blocos, nunca o runtime. Ver [[decisoes-tecnicas/decisoes]].
- Eventos duplicados ou fora de ordem inflam KPIs: idempotência por fonte e agregação recalculável por período.
