# Webhooks (ingestão)

Contrato acordado em `wiki/ingestao-webhooks/contrato-webhook.md`. Código em `src/rotas/webhooks.ts` e `src/webhooks/`.

## Recebimento: `POST /webhooks/{empresa}/{fonte}`

`empresa` e `fonte` são slugs. Corpo JSON livre, até 1 MB, `Content-Type: application/json` (com ou sem `; charset=utf-8`). Assinatura e idempotência usam sempre o corpo bruto, como chegou.

A requisição se autentica de um de dois modos, os dois com o **segredo da fonte**.

### Modo HMAC (padrão)

| Cabeçalho | Obrigatório | Conteúdo |
|---|---|---|
| `X-Timestamp` | sim | Unix epoch em segundos; aceito em ±300 s (`WEBHOOK_JANELA_SEGUNDOS`) |
| `X-Signature` | sim | HMAC-SHA256 **hex** de `X-Timestamp + "." + corpo bruto`, chave = segredo da fonte |
| `X-Event-Id` | não | Chave de idempotência por fonte; sem ele, `sha256:<hex do corpo>` |

### Modo Basic (plataformas que só oferecem credencial BASIC, ex.: GTech/Globaltech)

Usado **só quando não vem `X-Timestamp` nem `X-Signature`**. Se vier qualquer um dos dois, vale o modo HMAC, mesmo que haja `Authorization`.

| Cabeçalho | Obrigatório | Conteúdo |
|---|---|---|
| `Authorization` | sim | `Basic base64(usuario:senha)` (RFC 7617) |
| `X-Event-Id` | não | Igual ao HMAC; sem ele, `sha256:<hex do corpo>` (cobre reenvio idêntico) |

No backoffice da plataforma, configure:

- **Usuário**: qualquer valor, não é validado. Sugestão: o slug da fonte (ex.: `gtech`).
- **Senha**: o segredo da fonte (o mesmo que seria a chave do HMAC).
- **URL**: `https://<api>/webhooks/<empresa>/<fonte>`.

A senha é comparada em tempo constante (SHA-256 dos dois lados + `timingSafeEqual`, então tamanhos diferentes não vazam pelo tempo). Neste modo não há janela de tempo nem proteção contra replay além da idempotência: o reenvio do mesmo corpo vira 200 duplicado. Prefira HMAC quando a plataforma suportar.

Ordem das verificações: cabeçalhos (e formato do Basic) → empresa/fonte → timestamp (só HMAC) → assinatura ou senha (tempo constante) → JSON → idempotência.

| Código | Corpo | Quando |
|---|---|---|
| 202 | `{ id, status: "recebido" }` | Gravado em `webhook_events` e enfileirado |
| 200 | `{ id, duplicado: true }` | Mesmo `event_key` já recebido nesta fonte; nada é reprocessado |
| 400 | `cabecalho_ausente` | Sem `X-Timestamp`/`X-Signature` e sem `Authorization: Basic`, ou só um dos dois cabeçalhos HMAC |
| 400 | `json_invalido` | Corpo autenticado, mas não é JSON |
| 401 | `timestamp_fora_da_janela` | `X-Timestamp` fora da janela ou malformado (só HMAC) |
| 401 | `assinatura_invalida` | HMAC não confere, senha Basic errada, Basic malformado (base64 inválido, sem `:` ou senha vazia) ou servidor sem segredo utilizável para a fonte. Mesma mensagem em todos os casos |
| 404 | `nao_encontrado` | Empresa ou fonte desconhecida ou inativa (mesma mensagem nos três casos) |
| 413 | `corpo_grande` | Acima de 1 MB |
| 415 | `tipo_conteudo_invalido` | `Content-Type` diferente de JSON |
| 429 | `limite_excedido` | Mais de 600 req/min na mesma fonte (`WEBHOOK_LIMITE_POR_MINUTO`) |

Erros seguem o contrato de [erros.md](erros.md). Exemplo de assinatura (Node):

```js
const ts = Math.floor(Date.now() / 1000).toString();
const sig = createHmac('sha256', segredo).update(`${ts}.${corpo}`).digest('hex');
```

O que é gravado: `payload` (jsonb), `event_key`, status `recebido` e os cabeçalhos `content-type`, `user-agent`, `x-event-id`, `x-timestamp`, `x-request-id`, `x-forwarded-for`. `X-Signature` e `Authorization` nunca são gravados nem logados (ficam fora dessa lista e estão no `redact` do logger em `src/app.ts`). Log por evento: `tenant`, `fonte`, `eventKey`, `resultado` (sem corpo).

Idempotência: índice único `(tenant_id, source_id, event_key)`; o mesmo `X-Event-Id` em fontes ou empresas diferentes são eventos distintos.

## Segredo da fonte (provisório até a P5.2)

O banco guarda só `sources.secret_hash` (scrypt), e HMAC precisa do segredo em claro. Hoje o segredo vem de `obterSegredo(fonte)` (injetável em `buildApp({ webhooks: { obterSegredo } })`); o padrão lê `WEBHOOK_SEGREDOS`:

```
WEBHOOK_SEGREDOS={"pasio/demo":"<segredo impresso pelo seed>"}
```

O valor só é aceito se `scrypt(segredo, sal)` bater com `secret_hash` (resultado em cache por fonte). Sem segredo utilizável a resposta é 401 `assinatura_invalida` e o servidor loga um aviso.

**P5.2:** coluna `sources.secret_enc` (bytea/text, AES-256-GCM `iv|tag|cifra`) com chave `WEBHOOK_CHAVE_CIFRA` (32 bytes base64); `obterSegredo` passa a decifrar do banco, `WEBHOOK_SEGREDOS` sai, e `secret_hash` pode ficar só para exibição/rotação.

## Fila e worker

- pg-boss em `DATABASE_ADMIN_URL` (o `app_user` não tem `CREATE` no banco para o schema `pgboss`). Sem essa variável a API sobe, grava os brutos e avisa que não processa.
- Filas: `webhook.processar` (job `{ tenantId, webhookEventId }`, `singletonKey` = `webhookEventId`) e `webhook.reprocessar`.
- Retry: 5 retentativas, backoff exponencial a partir de 5 s, teto 300 s.
- Worker (`criarWorker({ db, boss, fila, processar })`), dados sempre pelo `Db` do `app_user` sob `comTenant`:
  - `processado` → status `processado`, `processed_at`, `tentativas`.
  - `erro` de regra → status `erro` com o motivo, sem retentativa (dead-letter lógico).
  - exceção → `tentativas` incrementa e o job é relançado; na última vira `erro` com `retentativas_esgotadas`.
- `processar` é o `processarWebhookEvent` do motor de regras (`src/rules/processar.ts`); deve ser idempotente (apagar os `events` derivados do bruto antes de recriar), porque retentativa e reprocessamento chamam de novo.

## Administração

- `POST /webhooks/{empresa}/{fonte}/reprocessar` (admin, JWT): body `{ de?, ate? }` (ISO 8601, filtra `received_at` em `[de, ate)`). Responde 202 `{ status: "enfileirado", jobId }`. O worker reenfileira cada bruto em `webhook.processar`; o bruto nunca muda.
- `GET /webhooks/{empresa}/{fonte}/entregas?limite=100` (analista): `{ entregas: [{ id, eventKey, status, erro, tentativas, receivedAt, processedAt }] }`, mais recentes primeiro.
- Nas duas, `{empresa}` precisa ser a empresa ativa do token (claim `tenant` ou `x-tenant`); outra empresa → 404.

## Simulador (`@trafego/webhook-sim`)

```powershell
$env:WEBHOOK_SIM_SEGREDO = '<segredo>'
pnpm --filter @trafego/webhook-sim enviar --url http://localhost:3001 --empresa pasio --fonte demo --lote 30
pnpm --filter @trafego/webhook-sim enviar --arquivo payloads.json
pnpm --filter @trafego/webhook-sim enviar --lote 1 --invalido assinatura   # 401
pnpm --filter @trafego/webhook-sim enviar --lote 1 --invalido timestamp    # 401
pnpm --filter @trafego/webhook-sim enviar --lote 1 --invalido duplicado    # 202 e depois 200
```

Payloads sintéticos: `$.event` (`ad_spend`, `click`, `page_view`, `signup`, `first_deposit`, `deposit`), `$.created_at` ISO, `$.amount` em centavos (gasto, FTD, depósito), `$.user.id`, `$.utm.{source,medium,campaign}`, `$.landing_page`, `$.affiliate_id` e `$.referrer`. Um lote de 30 cobre os 5 canais (Afiliados, Meta, Email, SMS, Outros) × 6 tipos.

## Testes

- `src/rotas/webhooks.test.ts`: contrato da rota (fila em memória), inclusive o modo Basic com um `USER_CREATED` fictício da GTech.
- `src/webhooks/worker.test.ts`, `fila.test.ts` (pg-boss real via `DATABASE_ADMIN_URL`), `unidade.test.ts`.
- `src/webhooks/g2.test.ts`: gate G2 (isolamento entre empresas).
