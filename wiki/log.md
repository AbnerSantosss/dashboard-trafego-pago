---
tipo: log
atualizado: 2026-10-15
tags: [log, historico]
---

# Log da wiki

## [2026-10-15] setup | Wiki criada pelo /gera-wiki (tarefa P0.0 do plano)
- Pedido: iniciar a execução do plano aprovado pelo usuário (stack Next.js + Fastify + PostgreSQL), começando obrigatoriamente pelo `/gera-wiki`.
- Feito: estrutura `wiki/` com 9 categorias e 14 páginas iniciais derivadas do `PLANO-DE-ACAO.md` (único arquivo do projeto neste momento; ainda não há código). `CLAUDE.md` e `GEMINI.md` criados com regra de leitura automática da wiki, ponteiro para a wiki Hyperframes e regra de segredos.
- Decisão registrada: a primeira empresa é a PASIO; o ícone oficial (PNG de 44 KB em pasion.poker) é o logo padrão dela, e a configuração de apresentação por empresa permite trocar ícone e nome. Ver [[administracao-multiempresa/configuracao-por-empresa]] e [[decisoes-tecnicas/decisoes]].
- Entregue: `wiki/index.md`, `wiki/log.md`, páginas por categoria, `CLAUDE.md`, `GEMINI.md`. Gate G0 cumprido.

## [2026-10-15] update | Plano de ação aprovado e distribuição por agente registrada (P0.3)
- Plano aprovado pelo usuário em 2026-10-15 com a stack recomendada. Distribuição: ver [[orquestracao-agentes/agentes-e-fases]]. Fonte: `PLANO-DE-ACAO.md` seções 2 a 4.

## [2026-10-15] update | Fase 0 concluída: repositório, monorepo pnpm e tooling validados (P0.1 a P0.4)
- Feito: `git init` (branch main); pnpm 12.11.2 instalado via `npm i -g --allow-scripts=pnpm pnpm` (corepack falhou por permissão em Program Files); monorepo com `apps/web` (Next 15.5 + React 19 + Tailwind 4), `apps/api` (Fastify 5 com `/health` e teste), `packages/design` (tokens placeholder + `brand/pasio-logo.png`), `packages/rules` (tipos canônicos + teste), `packages/fixtures` (placeholder), `prototype/`, `design/`, `tests/`, `docker-compose.yml` (PostgreSQL 16), `.env.example` sem valores.
- Tooling: TS estrito (`tsconfig.base.json`), ESLint 9 flat + typescript-eslint, Prettier, Vitest 3. `pnpm check` (lint, format, typecheck, test, build) passa com 2 testes.
- Armadilhas: pnpm 12 exige `allowBuilds` em `pnpm-workspace.yaml` para scripts de build (esbuild, sharp); `onlyBuiltDependencies` não funciona mais. No Git Bash o shim `pnpm` quebra o caminho; usar PowerShell ou `pnpm.cmd`.
- Pendências para agentes: `eslint-config-next` ainda não configurado (aviso no build; agente Frontend em P4.1); Playwright entra na Fase 6 (download de browsers só quando necessário).
- Entregue: repositório com commit inicial. Próximo: Fase 1 (P1.1 tokens, P1.3 fixtures em paralelo; depois P1.2, P1.4, P1.5, P1.6 → gate G1).

## [2026-10-15] update | Fase 1 concluída: tokens, fixtures, spec, ícones Tabler, harness de diff e protótipo (4,18%, gate G1 em decisão)
- Pedido: "despache a Fase 1 agora: P1.1 tokens e P1.3 fixtures em paralelo, depois P1.2, P1.4, P1.5 e P1.6 até o gate G1".
- Feito por subagentes com área exclusiva (D7); o orquestrador validou cada entrega:
  - **P1.1 tokens**: `packages/design/tokens.css` e `tokens.json` com 95 tokens medidos na imagem; [[design-system/tokens]] atualizada.
  - **P1.3 fixtures**: `packages/fixtures/referencia.json` + `src/{referencia,formatacao,tipos}.ts`, 42 testes Vitest; [[design-system/dados-de-referencia]] atualizada.
  - **P1.2 spec**: `design/componentes.md` (407 linhas) com grade, caixas, cores, fonte, vértices do funil, colunas da tabela e orçamento do diff (2% = 18.673 px; a imagem tem faixa preta de 4 px no topo e 3 px à direita).
  - **P1.4 ícones**: 23 SVGs da @tabler/icons 3.49.0 gerados por `packages/design/scripts/gerar-icones.mjs` (`pnpm --filter @trafego/design icones`), com sprite, `index.ts`, README e prévia. Decisão D5 revisada: ícones de biblioteca, nunca por IA.
  - **P1.6 harness**: `tests/visual` (`pnpm qa:visual`): Playwright Chromium 1315×710, pixelmatch threshold 0,1 sem AA, relatório por região em `tests/visual/saida/relatorio.json` (pasta fora do git), sai com código 1 acima de 2%.
  - **P1.5 protótipo**: `prototype/index.html` gerado por `gerar.mjs` a partir da spec, dos fixtures e do sprite; `estilo.css` com 38 variáveis `--p-*` medidas; `calibrar.mjs` ajusta cada texto por descida coordenada (`calibracao.json`). Logo alternável por `data-logo="referencia|pasio"`.
- Resultado do diff: **4,178%** (39.012 px). Por região: kpis 6,87%, cabeçalho 6,74%, tabela 3,93%, funil 3,81%, filtros 2,55%, sidebar 1,61%. O `diff.png` mostra só contorno de glifos, bordas e ícones; layout, cores e posições batem. A imagem usa uma fonte ~15% mais estreita que Inter/Segoe UI e nenhuma fonte disponível (Open Sans, Noto Sans, Roboto Flex com eixo wdth) reduziu o diff; o agente parou após três iterações sem ganho, como manda a regra.
- Decisão pendente do usuário: aceitar 4,18% como G1 (o restante é rasterização de texto, ~3,1% da tela), continuar iterando ou mudar o critério (por exemplo, diff com blur ou excluindo texto). Ver [[qa-visual/fidelidade-visual]].
- Armadilhas: o protótipo usa Segoe UI local, então o número vale só no Windows; em CI Linux o diff sobe. `prototype/index.html` e `calibracao.json` são gerados e ficam fora do Prettier (reformatar o HTML muda o render). 18 tokens divergem do que o protótipo mediu (lista em `prototype/estilo.css`); reconciliar em P1.1 antes do React.
- Também nesta sessão: repositório público criado (D9, `https://github.com/AbnerSantosss/dashboard-trafego-pago`) após varredura de segredos; `pnpm check` passa (44 testes).
- Entregue: commit da Fase 1 enviado ao repositório. Próximo: decisão do gate G1; depois Fase 2 (banco e API).

## [2026-10-15] update | Gate G1 aceito em 4,18% (D10); Fase 2 iniciada
- Usuário aceitou o diff de 4,18% (resto é texto). Registrado em [[decisoes-tecnicas/decisoes]] D10 e em [[qa-visual/fidelidade-visual]]. Próximo: Fase 2 (P2.1 esquema e RLS, P2.2 auth e papéis, P2.3 API base, P2.4 seed demo).

## [2026-10-15] update | Fase 2 concluída: esquema multiempresa com RLS, auth por JWT e papéis, API base Fastify e seed da PASIO
- Pedido: "siga para a Fase 2" (após D10).
- Feito por três subagentes em paralelo com áreas exclusivas (D7), validados pelo orquestrador (`pnpm check` verde: 104 testes, 61 na API com Postgres local de pé):
  - **P2.1 banco** (`apps/api/src/db/`, `drizzle/`): 9 tabelas Drizzle, RLS com `FORCE` e política por `app.tenant_id`, papel `app_user` sem BYPASSRLS, helpers `comTenant`/`comUsuario`, testes de isolamento. Postgres local via `docker compose up -d db` na porta 5460 (5432 estava ocupada por outro projeto). Ver [[arquitetura/modelo-de-dados]].
  - **P2.3 API base** (`apps/api/src/`): Fastify 5 + zod, contrato de erros em pt-BR (`apps/api/docs/erros.md`), logs pino com requestId e redação de segredos, OpenAPI em `/docs`. `openapi.json` é gerado por teste e entrou no `.prettierignore`.
  - **P2.2 auth e papéis** (`src/auth/`, `src/rotas/auth.ts`): JWT HS256, `x-tenant`, `exigirPapel`, `/me`, `/me/empresa`, `/empresas/atual`, `/ready`, CORS e rate limit. D12.
  - **P2.4 seed** (`src/db/seed.ts`, `db:seed`): empresa `pasio`, apresentação, fonte `demo` (segredo impresso uma vez, só hash no banco), `admin@pasio.local`, 264 linhas de `metrics_daily` iguais à imagem por canal; funil em canal reservado `__funil__` e coluna `base_contatada` (migração 0002). D11.
- Armadilhas: a imagem de referência é aritmeticamente inconsistente (Total de cliques, FTDs valor, CPA, variações de CPA e ROAS); o banco devolve a soma real e a Fase 4 decide o que a tela mostra ([[design-system/dados-de-referencia]]). `db:migrate` não lê `.env` sozinho: passar `DATABASE_ADMIN_URL` no ambiente. O seed usa `referencia.json` direto porque o `index.ts` das fixtures não compila na API (imports sem extensão).
- Entregue: commit da Fase 2 enviado ao repositório público. Próximo: Fase 3 (recepção de webhooks, motor de regras, agregação; gate G2).

## [2026-10-15] update | Fase 3 concluída: webhooks assinados, fila com retentativa, motor de regras, classificador, agregação e gate G2
- Pedido: "Siga para a Fase 3."
- Dois subagentes em paralelo (D7), interface `processarWebhookEvent(db, { tenantId, webhookEventId })` fixada no brief; `pnpm check` verde: 163 testes (100 na API, 17 em rules, 4 em webhook-sim, 42 em fixtures).
  - **Ingestão (P3.1, P3.2, P3.6)**: `POST /webhooks/:empresa/:fonte` com HMAC-SHA256 (`X-Signature`, `X-Timestamp`, `X-Event-Id`), idempotência por fonte, 600/min por fonte, bruto em `webhook_events`; fila pg-boss (5 retentativas, backoff 5–300 s) com worker que não retenta erro de regra; rotas `reprocessar` (admin) e `entregas` (analista); pacote `packages/webhook-sim` (CLI que assina e envia lotes, modos inválidos). Docs em `apps/api/docs/webhooks.md`. Ver [[ingestao-webhooks/contrato-webhook]], D13.
  - **Regras (P3.3, P3.4, P3.5)**: `@trafego/rules` puro (`aplicarRegras`, `validarConjunto`, `classificarCanal`, `agregarEventos`, `derivar`, `taxasDoFunil`) e `apps/api/src/rules/` (`processarWebhookEvent`, `reagregarDias` em SQL, `reprocessarFonte` em lotes de 500: 10.001 brutos em 15,8 s). Linha Meta das fixtures reproduzida a partir de eventos sintéticos. Ver [[regras-de-tratamento/motor-de-regras]], D14.
  - **Gate G2 cumprido** (`apps/api/src/webhooks/g2.test.ts`, 6 casos): bruto, entregas, `events` e `metrics_daily` da empresa A invisíveis para B; assinatura de A em B dá 401; mesmo `X-Event-Id` em A e B são distintos.
  - Orquestrador: coluna `events.base` (migração 0003), `ate` exclusivo no reprocessamento (`lt`), teste de determinismo do simulador fixado em data (dependia do relógio), `.env.example` com `WEBHOOK_*`.
- Armadilhas: segredo do webhook ainda vem de `WEBHOOK_SEGREDOS` até P5.2 (D13); pg-boss precisa de `DATABASE_ADMIN_URL`; `db:migrate` não lê `.env`; status `processando` não existe; o teste de 10 mil eventos só roda com `TESTE_LENTO=1`.
- Entregue: commit da Fase 3 enviado ao repositório. Próximo: Fase 4 (dashboard React ligado à API, fidelidade ao protótipo).

## [2026-10-15] update | Fase 4 concluída: dashboard React ligado à API de métricas, funil d3, GSAP, filtros na URL, exportação
- Pedido: "Siga para a Fase 4." e, no meio, "reduz, mantém só o essencial" (plano enxugado, D15).
- Três subagentes em paralelo (D7) com contrato fixado em `packages/contratos` pelo orquestrador; `pnpm check` verde (lint, prettier, typecheck, testes, build).
  - **API (P4.8)**: `GET /metricas/visao-geral` (período padrão de 24 dias até o último dia com dados, comparação com período anterior, filtros de canal/campanha, funil por canal `__funil__`, sparkline diária, cache 15 s) e `POST /auth/sessao-dev`. 7 testes reproduzem os números da imagem (33.840 / 995 / 226.190, funil 320.840→600) e o isolamento entre empresas. Docs em `apps/api/docs/metricas.md`. Ver D16.
  - **Gráficos (P4.3, P4.4)**: `@trafego/graficos` com `Funil` (vértices do protótipo, viewBox absoluto, degradê por etapa, conectores), `Sparkline` (curva monotônica desenhada por dashoffset) e `Contador` (GSAP 900 ms, tabular-nums); SSR mostra o estado final, `prefers-reduced-motion` desliga tudo; 10 testes.
  - **Web (P4.1, P4.2, P4.5–P4.7)**: layout do protótipo em React (`apps/web/componentes`, `lib/regras.ts`, `lib/api.ts`), filtros na URL, ordenação da tabela, exportação CSV/PNG, rotas de casca (Gestão de Custos, Relatórios, Ajuda), faixa de erro quando a API falha, `WEB_MOCK_API=1` para medir sem API; 10 testes.
  - Orquestrador: corrigiu o `top` do funil (3 px), o import `./metricas.js` em `@trafego/contratos`, plano e wiki enxutos (D15), gate visual D17.
- Medição: 5,39% contra a imagem, 1,45% contra o protótipo (ver [[qa-visual/fidelidade-visual]]).
- Armadilhas: porta 3001 pode estar ocupada por outro processo da máquina (usar `API_PORT`); o `<Funil>` só pode ser montado em `top: 322`; `sessao-dev` não existe em produção, então o web em produção ainda não tem token (pendência para a Fase 7).
- Entregue: commit da Fase 4. Próximo: Fase 5 enxuta (apresentação nome/logo, webhooks por empresa).

## [2026-10-15] update | Fase 5 enxuta concluída: apresentação (nome/logo) e webhooks por empresa com segredo rotacionável
- Pedido: "Sim, Fase 5" e, ao final, "Sim, atualize a wiki, commite e envie a Fase 5."
- Contrato fixado pelo orquestrador em `packages/contratos/src/admin.ts`; dois subagentes em paralelo (D7).
  - **API**: `apps/api/src/admin/` (apresentação, fontes, validação de logo, cifra AES-256-GCM), coluna `sources.secret_enc` (migração 0004), `WEBHOOK_CHAVE_CIFRA`, recebimento banco → `WEBHOOK_SEGREDOS`. 31 testes novos, inclusive ponta a ponta (criar fonte, webhook assinado 202, rotação invalida o segredo antigo) e isolamento entre empresas. Docs em `apps/api/docs/admin.md`.
  - **Web**: `/configuracoes/apresentacao` e `/configuracoes/webhooks` com server actions (o navegador não fala com a API), segredo exibido uma vez, mensagens de erro em português; Sidebar mostra o nome em texto quando não há logo; link na Ajuda. 10 testes novos.
  - Orquestrador: `extensionAlias` no `next.config.ts` para os imports `.js` dos pacotes; decisão D18.
- Verificação: `pnpm check` verde (API 141 testes, web 20, gráficos 10); telas conferidas no navegador ligadas à API real.
- Pendência visual menor: na largura do painel do navegador a tabela de fontes corta a coluna de ações (sem rolagem horizontal); revisar na Fase 6 se incomodar.
- Entregue: commit da Fase 5. Próximo: Fase 6 enxuta (CI com `pnpm check` + diff visual, e2e de isolamento, gate G3).
