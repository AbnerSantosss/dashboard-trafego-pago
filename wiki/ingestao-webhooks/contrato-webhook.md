---
tipo: especificacao
atualizado: 2026-10-20
tags: [webhook, hmac, basic, gtech, idempotencia, fila, ingestao]
---

# Contrato de webhook

Implementado em P3.1/P3.2 (2026-10-15): `apps/api/src/webhooks/`, rota `apps/api/src/rotas/webhooks.ts`, documentação em `apps/api/docs/webhooks.md`, OpenAPI em `/docs`. Esta página fixa o contrato; onde a implementação difere do plano original, a diferença está marcada abaixo e em D13.

## Endpoint
`POST /webhooks/{empresa}/{fonte}` com corpo JSON livre (o formato é da fonte; o mapeamento é das regras).

## Autenticação: dois modos
A rota decide pelo que chega (D42):
- **HMAC** (padrão): se vier `X-Timestamp` ou `X-Signature`, valem os cabeçalhos da tabela abaixo.
- **Basic** (plataformas que só aceitam credencial Basic, ex.: GTech): sem `X-Timestamp` e sem `X-Signature`, a rota lê `Authorization: Basic base64(usuário:senha)`. A **senha é o segredo da fonte**; o usuário é livre (convenção: o slug da fonte, ex.: `gtech`). A senha é comparada em tempo constante (SHA-256 dos dois lados + `timingSafeEqual`). Não há janela de tempo; a idempotência é por `X-Event-Id`, se vier, ou pelo `sha256:` do corpo.
- Nenhum dos dois → 400 `cabecalho_ausente`. Basic malformado, senha errada ou fonte sem segredo → 401 `assinatura_invalida` (a mesma resposta do HMAC, para não revelar o motivo).
- O cabeçalho `authorization` **nunca é gravado** em `webhook_events`.

Exemplo: `curl -u gtech:SEGREDO -H 'content-type: application/json' -d @evento.json https://api.kapanda.lat/webhooks/pasio/gtech`.

## Cabeçalhos do modo HMAC
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
| 400 | `cabecalho_ausente` (falta `X-Signature`/`X-Timestamp` e não há `Authorization: Basic`) ou `json_invalido` |
| 401 | `assinatura_invalida` (HMAC errado ou senha Basic errada) ou `timestamp_fora_da_janela` (só HMAC; janela `WEBHOOK_JANELA_SEGUNDOS`, padrão 300 s) |
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

## GTech (plataforma de cassino)
Página própria, com estado, configuração do backoffice, fluxo ponta a ponta e validação: [[ingestao-webhooks/gtech]]. Resumo do formato real observado no backoffice demo `latam.gtech.uy` e na documentação da plataforma (2026-10-20):
- POST com **um JSON por requisição**, `Content-Type: application/json; charset=utf-8`, só `Authorization: Basic` (sem HMAC nem `X-Event-Id`).
- Configuração: backoffice → Personalizar → Webhook. Cada seção (Criação de Usuário, Pagamento de Depósito etc.) tem seus webhooks com Nome, Status, URL, Tipo de credencial (só BASIC), Usuário e Senha. Para o painel: URL `https://api.kapanda.lat/webhooks/pasio/gtech`, Usuário `gtech`, Senha = segredo da fonte.
- Eventos: `USER_CREATED`, `DEPOSIT_CREATED` (status `PENDENT`) e `DEPOSIT_PAYMENT` (status `PAID`; `approved_deposits == 1` indica FTD). `amount` em reais, `currency` `"R$"`, UTMs em `tracker.utm_*`, afiliado em `tracker.afp`.
- **Dados pessoais**: o payload traz e-mail, nome, documento, data de nascimento, `user_token` e `qrcode`. O preset não lê nenhum deles, mas o bruto inteiro fica em `webhook_events.payload` (pendência LGPD em [[operacao/problemas-atuais]] e [[ingestao-webhooks/gtech]]). Fixtures só fictícias (`packages/rules/src/presets/gtech.fixtures.ts`).
- Regras: preset `gtech` ([[regras-de-tratamento/motor-de-regras]]), aplicado por `apps/api/src/rules/aplicar-preset.ts`.

Relacionado: [[ingestao-webhooks/gtech]], [[arquitetura/visao-geral]], [[arquitetura/modelo-de-dados]], [[operacao/runbooks]], [[decisoes-tecnicas/decisoes]] (D13, D42).
