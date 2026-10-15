# @trafego/api

API Fastify 5 do dashboard (TypeScript, ESM, zod 4 via `fastify-type-provider-zod`).

## Rodar

```powershell
pnpm --filter @trafego/api dev     # tsx watch, logs com pino-pretty quando NODE_ENV=development
pnpm --filter @trafego/api build   # tsc para dist/
pnpm --filter @trafego/api start   # node dist/server.js
pnpm --filter @trafego/api test    # vitest (NODE_ENV=test, sem .env)
```

## Variáveis de ambiente

Validadas em `src/env.ts` na subida; se algo faltar, o processo sai listando as variáveis (sem valores).

| Variável | Obrigatória | Default | Observação |
|---|---|---|---|
| `NODE_ENV` | não | `development` | `development`, `test` ou `production` |
| `API_PORT` | não | `3001` | |
| `DATABASE_URL` | sim | — | `postgres://` ou `postgresql://` |
| `AUTH_SECRET` | sim | — | mínimo 32 caracteres em produção |
| `WEB_URL` | não | `http://localhost:3000` | URL do front |
| `LOG_LEVEL` | não | `info` | `fatal`…`trace` ou `silent` |

Em `NODE_ENV=test` todas recebem defaults seguros.

## Endpoints de infraestrutura

- `GET /health` — liveness `{ status, service, versao, uptime }`.
- `GET /ready` — prontidão: `select 1` no Postgres; 503 `servico_indisponivel` se falhar (limite de 3 s).
- `GET /docs` — Swagger UI; `GET /docs/json` — documento OpenAPI 3.
- `docs/openapi.json` — cópia exportada, regenerada por `pnpm --filter @trafego/api exec vitest run src/openapi.test.ts`.

## Autenticação e empresa ativa

O login do usuário final é do web (Auth.js). A API só valida um **JWT HS256** assinado com `AUTH_SECRET` (segredo compartilhado com o web):

| Claim | Obrigatória | Conteúdo |
|---|---|---|
| `sub` | sim | uuid do usuário (`users.id`) |
| `email` | sim | e-mail do usuário |
| `tenant` | não | uuid da empresa ativa |
| `exp`/`iat` | — | validade padrão de 12 h quando emitido pela API |

- `emitirToken(app, { sub, email, tenant? })` em `src/auth/plugin.ts` gera um token válido (testes e web).
- Empresa ativa: cabeçalho `x-tenant` (slug ou id) tem prioridade sobre a claim `tenant`. O papel é lido em `memberships` sob `comUsuario` (RLS).
- Na rota: `preHandler: app.autenticar` (só token), `app.exigirEmpresa` (token + empresa) ou `app.exigirPapel('analista')` (token + empresa + papel; admin > analista > leitor).
- Toda consulta a tabela por empresa usa `request.comTenant((tx) => ...)`, que fixa `app.tenant_id` e `app.user_id` na transação.

Rotas:

- `GET /me` — usuário, empresas com papel e `empresaAtiva` (claim).
- `POST /me/empresa` `{ empresa: slug|id }` — devolve `{ token, empresa }`: um token novo com `tenant` trocado. O cliente substitui o token anterior.
- `GET /empresas/atual` — empresa ativa, papel, moeda, fuso e apresentação (lidos sob RLS).

CORS: só `WEB_URL`, com credenciais. Rate limit global: 300 req/min por IP (429 `limite_excedido`).

## Convenções

- Erros: contrato único `{ erro: { codigo, mensagem, detalhes?, requestId } }`. Ver [docs/erros.md](docs/erros.md).
- Logs: JSON (pino), `requestId` em toda linha e no cabeçalho `x-request-id`; `authorization`, `x-signature` e `cookie` são omitidos.
- Limite de corpo: 1 MB.
- Rotas novas: plugin em `src/rotas/`, schemas zod em `schema` (entram no OpenAPI automaticamente).
