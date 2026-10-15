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

## Implementação (P2.1, 2026-10-15)
Esquema em `apps/api/src/db/schema.ts` (Drizzle), migrações em `apps/api/drizzle/` (`pnpm --filter @trafego/api db:generate` / `db:migrate`). O que a implementação acrescentou à tabela acima:

- Todas as tabelas têm `created_at`/`updated_at`. `sources.nome`; `webhook_events.erro`, `tentativas`, `processed_at`; `events.webhook_event_id` e `source_id`; `rules.created_by`; `presentation.subtitulo` e `channels jsonb`. `metrics_daily.investimento` é anulável (afiliados sem gasto); `campaign`/`page` são `NOT NULL DEFAULT ''` para a chave do dia funcionar. `channel` é texto livre (não enum), para novos canais não exigirem migração.
- Chaves compostas `(tenant_id, source_id)` e `(tenant_id, webhook_event_id)`: um registro nunca aponta para linha de outra empresa. `rules` única por `(tenant_id, source_id, version)` e índice parcial que garante **uma regra ativa por fonte**. `users.email` único; `presentation` única por empresa; índice `webhook_events (tenant_id, status, received_at)` para a fila de processamento.
- **RLS**: `tenants` e `users` são globais (sem RLS). As demais têm `ENABLE` + `FORCE ROW LEVEL SECURITY` com política `tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid` (USING e WITH CHECK); `memberships` tem política extra de leitura por `app.user_id`, para listar as empresas do usuário antes de fixar a ativa. Sem a variável de sessão, nenhuma linha aparece.
- **Papel `app_user`** (sem BYPASSRLS; a app sempre conecta com ele, `DATABASE_URL`). Criado em dois caminhos: `docker/initdb/01-papeis.sql` no Postgres local do compose (LOGIN, senha só local) e migração `0001` (cria se não existir, NOLOGIN, GRANTs e privilégios padrão); em produção a senha é definida fora do repositório. Migrações rodam como dono (`DATABASE_ADMIN_URL`).
- Helpers em `src/db/client.ts`: `comTenant(db, tenantId, userId?, fn)` abre transação e faz `set_config(..., true)` (vale só na transação); `comUsuario(db, userId, fn)`. Testes: `rls.test.ts` (isolamento entre empresas) e `schema.test.ts`; pulam com aviso se o Postgres local (porta 5460) não responder.
- Pendente: `app_user` ainda lê e escreve `tenants`/`users` sem restrição; avaliar restringir em P5.3.

### Ingestão (P3, migração 0003)
- `events.base boolean not null default false`: clique marcado como base contatada (D14). `webhook_events.status` fica em `recebido | processado | erro`; erro de regra grava o motivo em `erro` e soma `tentativas`. Fila pg-boss no schema `pgboss`, criado com `DATABASE_ADMIN_URL` (D13).
- Pendente para P5.2: `sources.secret_enc` (segredo cifrado, AES-256-GCM) para substituir `WEBHOOK_SEGREDOS`. Pendente: opção por empresa "depósitos incluem FTD".

### Funil e seed demo (P2.4, migração 0002)
- `metrics_daily.base_contatada` (inteiro, não nulo, padrão 0): primeira etapa do funil. Em produção vem de envios de email/SMS ou cliques marcados como base; na demo os canais reais ficam com 0.
- **Canal reservado `__funil__`**: os números do funil da imagem (320.840 / 40.000 / 30.000 / 6.000 / 600) não fecham com a tabela por canal (600 FTDs contra 995), então ficam em um canal próprio. Regra para toda consulta: **canais que começam com `__` ficam fora da tabela, dos KPIs e da lista de canais** e só alimentam o funil (D11).
- Seed: `pnpm --filter @trafego/api db:seed` (`src/db/seed.ts`, recusa `NODE_ENV=production`, idempotente). Cria empresa `pasio`, apresentação completa, fonte `demo` (segredo impresso uma vez no console; no banco só o hash scrypt) e `admin@pasio.local` (admin). 264 linhas em `metrics_daily` (24 dias × canais, período atual e anterior), somas por canal iguais à imagem. Ver [[design-system/dados-de-referencia]] para o que a imagem não permite reproduzir.

## Tipos canônicos de evento
`gasto`, `clique`, `visita`, `cadastro`, `ftd`, `deposito`.

## Derivados
CPA = gasto / ftds; ROAS = depósitos / gasto; taxa do funil = etapa / etapa anterior. Definições completas em [[regras-de-tratamento/metricas-e-kpis]].

## Armadilhas
- Afiliados pode não ter investimento: CPA e ROAS ficam nulos, nunca zero (a imagem mostra "–").
- Moeda e fuso são da empresa; conversão acontece nas regras, antes de gravar em `events`.
