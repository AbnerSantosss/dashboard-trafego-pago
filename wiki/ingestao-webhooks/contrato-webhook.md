---
tipo: especificacao
atualizado: 2026-10-15
tags: [webhook, hmac, idempotencia, fila, ingestao]
---

# Contrato de webhook

Especificação completa (OpenAPI) sai na tarefa P3.1 (`apps/api/docs/webhooks.md`). Esta página fixa o contrato acordado no plano.

## Endpoint
`POST /webhooks/{empresa}/{fonte}` com corpo JSON livre (o formato é da fonte; o mapeamento é das regras).

## Cabeçalhos obrigatórios
| Cabeçalho | Conteúdo |
|---|---|
| `X-Signature` | HMAC-SHA256 hex de `timestamp + "." + corpo bruto`, com o segredo da fonte |
| `X-Timestamp` | Unix epoch em segundos; rejeitado fora de uma janela de 5 min |
| `X-Event-Id` | Identificador único do evento na fonte; repetido = 200 sem reprocessar |

Sem `X-Event-Id`, a chave de idempotência é o hash SHA-256 do corpo.

## Respostas
| Código | Quando |
|---|---|
| 202 | Aceito e enfileirado |
| 200 | Duplicado (já recebido) |
| 400 | JSON inválido ou cabeçalho faltando |
| 401 | Assinatura inválida ou timestamp fora da janela |
| 404 | Empresa ou fonte desconhecida ou inativa |
| 413 | Corpo acima de 1 MB |
| 429 | Limite de taxa por fonte |

## Processamento
1. Grava em `webhook_events` com status `recebido` (payload e cabeçalhos íntegros).
2. Enfileira em pg-boss (job por evento, retry exponencial 5x).
3. Worker aplica a versão ativa das regras da fonte ([[regras-de-tratamento/motor-de-regras]]); sucesso → `events` + status `processado`; falha → status `erro` com motivo, visível na tela de dead-letter.
4. Agregação incremental em `metrics_daily`.

## Reprocessamento
Admin pode reprocessar um evento, um intervalo de datas ou toda a fonte após publicar regras novas. Reprocessar apaga e recalcula os `events` derivados daqueles `webhook_events`; o bruto nunca é alterado.

## Testes
`webhook-sim` (P3.2) envia lotes assinados reproduzindo os dados da imagem de referência para a empresa demo. Teste de isolamento (gate G2): evento assinado para a empresa A nunca aparece nas métricas da empresa B.

Relacionado: [[arquitetura/visao-geral]], [[arquitetura/modelo-de-dados]], [[operacao/runbooks]].
