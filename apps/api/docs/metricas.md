# Métricas — Visão Geral (P4.8)

Contrato TypeScript: `packages/contratos/src/metricas.ts` (`VisaoGeralQuery`, `VisaoGeralResposta`).
Código: `src/rotas/metricas.ts` (rota e schema zod), `src/metricas/` (consulta, cálculo, cache).

## `GET /metricas/visao-geral`

- Autenticação: `Authorization: Bearer <JWT>` + empresa ativa (claim `tenant` ou cabeçalho `x-tenant`).
  Qualquer papel (inclusive `leitor`). Toda leitura roda em `request.comTenant` (RLS).
- Query:
  - `de`, `ate` — `AAAA-MM-DD`, inclusivos, no fuso da empresa. `de > ate` → 400 `validacao_invalida`;
    período máximo de 400 dias.
  - Sem `de`/`ate`: `ate` = último `day` com dados em canal visível; sem dados, hoje no fuso da empresa.
    `de` = `ate` − 23 (24 dias). Com só um dos dois, o outro é completado com a mesma janela de 24 dias.
  - `comparar` = `anterior` (padrão: período imediatamente anterior, mesma duração; 01/05–24/05 → 07/04–30/04) ou `nenhum`.
  - `canal` (padrão `todos`) e `campanha` (padrão `todas`).
- Resposta: `VisaoGeralResposta`. Números crus (sem arredondar); `null` = indefinido, nunca 0.

### Como é calculada

1. Uma consulta agregada em `metrics_daily` cobre comparação + período:
   `select day, channel, sum(...) ... where day between <início comparação> and <ate>
   [and (left(channel,2)='__' or campaign = <campanha>)] group by day, channel`.
2. Em memória (`src/metricas/calculo.ts`):
   - Canais `__*` (reservados, D11) ficam fora de `kpis`, `canais`, `total`, `opcoes` e do filtro.
   - KPIs: somas do período e da comparação; CPA e ROAS via `derivar` de `@trafego/rules`
     (depois da soma; sem gasto → `null`). `variacaoPct = (v − a) / a · 100`, `null` se `a` nulo/0.
     `sparkline`: um ponto por dia do período (dia sem base → 0); vazio se não houver dados.
   - Funil: se houver linha `__*` no período, só elas (empresa demo); senão soma dos canais
     visíveis filtrados. Taxas via `taxasDoFunil` (× 100).
   - Tabela: uma linha por canal, ordem de `presentation.channels[].ordem` e depois alfabética.
   - `opcoes.canais`: todos os canais visíveis da empresa (ignora filtro); `opcoes.campanhas`:
     campanhas não vazias do período.
   - `apresentacao.kpis`/`columns`: aceitam no jsonb tanto `["id", ...]` quanto
     `[{ id, visivel, ordem }]`; saem como lista de ids visíveis em ordem.
   - `atualizadoEm`: `max(processed_at)` de `webhook_events` da empresa.

### Cache

Em memória, chave = empresa + query normalizada, TTL 15 s, até 500 entradas (descarta a mais
antiga). Resposta com `Cache-Control: private, max-age=15`. **O cache é por instância**: com várias
instâncias, cada uma tem o seu, e uma alteração só some das outras pelo TTL.
`limparCacheMetricas(tenantId?)` (em `src/metricas/cache.ts`) invalida uma empresa ou todas.

## `POST /auth/sessao-dev` (somente desenvolvimento)

Login **sem senha**, temporário até o Auth.js (Fase 5). Body `{ "email": "..." }`; devolve
`{ token, usuario, empresas }` com token de 12 h sem claim `tenant`. E-mail inexistente → 404
`nao_encontrado`. A rota **só é registrada quando `NODE_ENV !== 'production'`**; em produção não
existe (404). Uso local: `admin@pasio.local` (usuário do seed).
