---
tipo: especificacao
atualizado: 2026-10-15
tags: [webhook, hmac, idempotencia, fila, ingestao]
---

# Contrato de webhook

Implementado em P3.1/P3.2 (2026-10-15): `apps/api/src/webhooks/`, rota `apps/api/src/rotas/webhooks.ts`, documentação em `apps/api/docs/webhooks.md`, OpenAPI em `/docs`. Esta página fixa o contrato; onde a implementação difere do plano original, a diferença está marcada abaixo e em D13.

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
| 400 | `cabecalho_ausente` (falta `X-Signature` ou `X-Timestamp`) ou `json_invalido` |
| 401 | `assinatura_invalida` ou `timestamp_fora_da_janela` (janela `WEBHOOK_JANELA_SEGUNDOS`, padrão 300 s) |
| 404 | Empresa ou fonte desconhecida ou inativa (mesma mensagem nos dois casos) |
| 413 | Corpo acima de 1 MB |
| 429 | `limite_excedido`: `WEBHOOK_LIMITE_POR_MINUTO` por empresa/fonte (padrão 600) |

## Processamento
1. Grava em `webhook_events` com status `recebido` (payload e cabeçalhos íntegros).
2. Enfileira em pg-boss (job por evento, retry exponencial 5x).
3. Worker aplica a versão ativa das regras da fonte ([[regras-de-tratamento/motor-de-regras]]); sucesso → `events` + status `processado`; falha → status `erro` com motivo, visível na tela de dead-letter.
4. Agregação incremental em `metrics_daily`.

## Segredo da fonte
No banco só existe o hash scrypt. Até P5.2, o segredo em claro vem de `WEBHOOK_SEGREDOS` (JSON `{"empresa/fonte": "segredo"}`, nunca commitado) e só vale se bater com o hash; depois passa a `sources.secret_enc` cifrado (D13). O seed imprime o segredo da fonte `demo` uma única vez.

## Rotas autenticadas
`POST /empresas/:empresa/fontes/:fonte/reprocessar` (admin, `{ de?, ate? }`, 202, enfileira `webhook.reprocessar`) e `GET /empresas/:empresa/fontes/:fonte/entregas?limite=100` (analista ou acima). Empresa da URL diferente da empresa ativa da sessão responde 404.

## Reprocessamento
Admin pode reprocessar um evento, um intervalo de datas ou toda a fonte após publicar regras novas. Reprocessar apaga e recalcula os `events` derivados daqueles `webhook_events`; o bruto nunca é alterado.

## Testes
`packages/webhook-sim` (P3.6): `pnpm --filter @trafego/webhook-sim enviar --url http://localhost:3001 --empresa pasio --fonte demo --segredo <s> [--quantidade 30] [--semente N] [--arquivo payloads.json] [--invalido assinatura|timestamp|duplicado]` envia lotes assinados reproduzindo os dados da imagem de referência para a empresa demo. Teste de isolamento (gate G2, `apps/api/src/webhooks/g2.test.ts`): evento assinado para a empresa A nunca aparece em brutos, entregas, `events` ou `metrics_daily` da empresa B; assinatura de A no endpoint de B dá 401; o mesmo `X-Event-Id` em A e B são eventos distintos.

Relacionado: [[arquitetura/visao-geral]], [[arquitetura/modelo-de-dados]], [[operacao/runbooks]].
