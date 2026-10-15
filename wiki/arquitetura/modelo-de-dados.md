---
tipo: arquitetura
atualizado: 2026-10-15
tags: [modelo-de-dados, postgresql, rls, tenant]
---

# Modelo de dados

Toda tabela tem `tenant_id` e política RLS. Nenhuma consulta roda sem `SET app.tenant_id`.

| Tabela | Campos principais | Observações |
|---|---|---|
| `tenants` | id, slug, nome, logo_url, moeda, fuso | Nome e logo trocáveis em apresentação; padrão da PASIO: ícone oficial |
| `users` | id, email, nome | Globais; o vínculo com empresa é em memberships |
| `memberships` | tenant_id, user_id, role (admin, analista, leitor) | Troca de empresa ativa pelo usuário |
| `sources` | tenant_id, slug, secret_hash, rules_version, ativo | Uma fonte = um endpoint de webhook |
| `webhook_events` | tenant_id, source_id, payload jsonb, headers jsonb, status, received_at, event_key | Bruto; `event_key` único por fonte (idempotência) |
| `events` | tenant_id, type, occurred_at, value, currency, channel, campaign, page, lead_key, utm_source, utm_medium, utm_campaign, referrer | Evento canônico depois das regras |
| `metrics_daily` | tenant_id, day, channel, campaign, page, investimento, cliques, visitas, cadastros, ftds, ftds_valor, depositos | Recalculável por período |
| `rules` | tenant_id, source_id, version, mapping jsonb, channel_rules jsonb, ativo | Versionada; ver [[regras-de-tratamento/motor-de-regras]] |
| `presentation` | tenant_id, nome_exibicao, logo_url, kpis jsonb, columns jsonb, palette jsonb, currency, timezone | Ver [[administracao-multiempresa/configuracao-por-empresa]] |

## Tipos canônicos de evento
`gasto`, `clique`, `visita`, `cadastro`, `ftd`, `deposito`.

## Derivados
CPA = gasto / ftds; ROAS = depósitos / gasto; taxa do funil = etapa / etapa anterior. Definições completas em [[regras-de-tratamento/metricas-e-kpis]].

## Armadilhas
- Afiliados pode não ter investimento: CPA e ROAS ficam nulos, nunca zero (a imagem mostra "–").
- Moeda e fuso são da empresa; conversão acontece nas regras, antes de gravar em `events`.
