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

## [2026-10-15] update | Fase 6 enxuta: CI e e2e de isolamento (G3)
- Pedido: "Sim, siga para a Fase 6 enxuta."
- Feito: `.github/workflows/ci.yml` (`pnpm check` + diff visual com mock da API, limite 5,5%, D19) e `apps/api/src/e2e/g3.test.ts`. Item Configurações na sidebar, acima da Ajuda, com ícone Tabler gerado por `gerar-icones.mjs`.
- Entregue: arquivos no disco, ainda sem commit.

## [2026-10-16] update | Configurações: perfil, usuários e convites, login, tag GTM e cruzamento com o webhook
- Pedido: aba de Configurações com informações do usuário (nome e sobrenome), admin que convida outros usuários para acompanhar, tag automática para o GTM captar atribuição (UTMs e click ids) e cruzá-la com o webhook da plataforma (cadastro, FTD, depósito, redepósito). Depois: usar um Gmail como provedor de e-mail temporário.
- Feito (API): migração 0005 (nome/sobrenome, senha, convites, toques de atribuição), rotas de conta (`/auth/login`, `/auth/recuperar`, `/auth/redefinir`, `GET/PATCH /me`), convites e membros (`/empresas/atual/usuarios|convites`, `/convites/:token`), coleta pública `POST /t/:empresa/clk` e herança do último toque no processamento (D20, D21). E-mail por SMTP lido de `apps/api/.env.local`, fora do git. 152 testes.
- Feito (web): abas Perfil, Usuários e Tag GTM; telas `/login`, `/redefinir`, `/convite`; sessão em cookie e `middleware.ts`; contratos em `packages/contratos/src/conta.ts`; teste da tag rodando o script num navegador falso (23 testes no web). `.env.example` com `SMTP_*`, `WEBHOOK_URL_PUBLICA` e `WEB_EXIGIR_LOGIN`, sem valores.
- Verificação: tsc, eslint e prettier limpos; telas conferidas no navegador com a API real; a tag respondeu 204. Convite não foi disparado no teste para não mandar e-mail real.
- Armadilha: `TaskStop` no shell da API deixa o `tsx` órfão segurando a porta 3011; é preciso encerrar o processo node.
- Entregue: código no disco, sem commit. Pendente: definir `WEBHOOK_URL_PUBLICA` em produção e trocar a senha de app do Gmail usada no teste.

## [2026-10-16] update | Página de retomada e retrato de ambiente e segurança
- Pedido: "salve tudo isso na wiki, deixe pronto e orientado para quando eu abrir possa continuar" (após o `/auto-mode-setup` do Claude Code).
- Feito: [[operacao/retomada]] (onde paramos, estado do CI, próximos passos em ordem, como subir local, armadilhas) e [[operacao/ambiente-e-seguranca]] (repositório público e sem proteção na `main`, segredos, alvos que pedem confirmação, rotina). Índice com seção "Comece por aqui"; `CLAUDE.md` aponta para a retomada.
- Achado: no primeiro run do CI novo (`5216d62`) o job check passou e o job visual falhou com `ERR_CONNECTION_REFUSED` em `localhost:3000` (o servidor web não chegou vivo ao passo do comparador no runner Windows). É o primeiro item da retomada.
- Entregue: wiki atualizada e commitada.

## [2026-10-16] fix | Conserto do job visual do CI (commit local, envio pelo usuário)
- Pedido: entender a falha do CI e "registre isso na wiki, vou fazer por fora no Claude Code".
- Feito: em sessão separada, o job visual passou a subir o web e rodar `pnpm qa:visual` no mesmo passo (commit `817bc01`). Enviado para `origin/main`; o run do CI estava em andamento e o resultado fica para o usuário conferir por fora.
- Conversa sobre escopo: o usuário questionou por que um painel de webhooks virou um projeto grande. Explicado: plano inicial pesado (multiempresa, RLS, fila, regras, diff de pixels, CI) e pedidos novos (usuários, convites, login, tag GTM). Sugestão registrada em [[operacao/retomada]]: priorizar o deploy e parar de acrescentar funcionalidades.
- Entregue: retomada e log atualizados, commit da wiki local sem push.

## [2026-10-16] fix | Job visual do CI verde
- Pedido: consertar o job "visual (diff contra ref-1.png)", que falhava com `ERR_CONNECTION_REFUSED` em `localhost:3000`.
- Feito: em `.github/workflows/ci.yml`, servidor web e comparador passaram a rodar no mesmo passo (commit `817bc01`), mantendo `WEB_MOCK_API=1` e o limite de 5,5% (D19). Push confirmado pelo usuário.
- Verificação: run 38856270127 com os dois jobs verdes; diff visual de 5,19% no runner Windows (local 5,16%).
- Entregue: CI verde e [[operacao/retomada]] atualizada.

## [2026-10-16] ux | revisão impeccable, responsividade, aba Instalação e movimento
- Pedidos: revisão de UX com o impeccable; um especialista de UX para responsividade e tamanhos de texto; aba Instalação com o passo a passo para colocar o painel no ar; um especialista Hyperframes para deixar o visual mais profissional; e, antes de continuar, ver tudo o que falta e montar um agente orquestrador com subagentes para adiantar o trabalho.
- Feito, por área (um escritor por conjunto de arquivos, D7):
  - **Configurações**: nova aba **Instalação** com 7 passos e estado calculado em `apps/web/lib/instalacao.ts`. Layout fluido (grid de 181 px mais o conteúdo, barra superior abaixo de 48em, tabelas viram cartões no celular), escala tipográfica própria (`--cfg-fs-*`), confirmação de ações destrutivas com `<dialog>` (`BotaoConfirmar`), tokens de erro e aviso, `revalidatePath('/', 'layout')` ao salvar Apresentação, e um h2 por aba (Fontes de webhook, Nome e logo da empresa, Tag do Google Tag Manager, Convidar pessoas, Dados pessoais), visível também nas telas de erro. Ver [[administracao-multiempresa/configuracao-por-empresa]].
  - **Dashboard, acessibilidade**: tabela semântica sobreposta com `aria-sort` e botões "Ordenar por <rótulo>"; dicas ⓘ com `role=tooltip` (foco, hover, clique, Esc); menus Exportar e Período com Esc, clique fora, setas e foco devolvido; foco visível ciano; KPIs esmaecidos durante o carregamento; faixa de erro com "Tentar de novo"; link "Pular para o conteúdo"; telas em construção leem a marca da Apresentação. Para o botão de nova tentativa caber, o topo da faixa de erro mudou de 684 para 680 px.
  - **Dashboard, movimento**: entrada dos cards em CSS (300 ms, stagger de 40 ms), contadores por `requestAnimationFrame` sem GSAP (800 ms), funil como único momento autoral (barras em `scaleX`, até cerca de 900 ms) e sparkline revelada por `clip-path`. Tudo dentro de `prefers-reduced-motion: no-preference`, terminando no estado do SSR. Corrigido de quebra o `clearProps` do GSAP que apagava o blur do trapézio.
  - **Portão de validação**: prettier nos arquivos alterados (3 só de formatação), `pnpm lint`, `pnpm typecheck` e `pnpm test` verdes.
  - Decisões registradas: D22 a D30 em [[decisoes-tecnicas/decisoes]].
- Verificação: 280 testes passando e 1 pulado (web 46, gráficos 19, API 152). Contra o `next dev` com a API real, o diff visual mediu **5,419%**, abaixo do limite de 5,5%. Com movimento reduzido, a captura antes e depois deu 0 px de diferença, e a captura sem JS bateu com a captura com JS. O `tsconfig.tsbuildinfo` foi restaurado byte a byte.
- Entregue: código no disco, **sem commit**. Pendências em [[operacao/retomada]]: `pnpm qa:visual` em build de produção com `WEB_MOCK_API=1`, conferência no navegador do diálogo de confirmação e de Perfil/Tag, e o commit, que só sai quando o usuário pedir.
- Complemento (orquestrador): `pnpm qa:visual` em build de produção com `WEB_MOCK_API=1`, como no CI, deu **5,19%** (limite 5,5%), igual ao de antes; conferido no navegador o diálogo de "Gerar segredo" (foco inicial em Cancelar, Esc fecha sem enviar).

## [2026-10-16] update | Wiki completa da rodada de UX (/gera-wiki "registre tudo")
- Pedido: "registre tudo".
- Feito:
  - [[design-system/tokens]]: nova seção com os tokens de estado (`--p-erro-*`, `--p-aviso`) e das Configurações (`--cfg-*`, com valores para celular e desktop).
  - [[qa-visual/fidelidade-visual]]: medições de 2026-10-16 (CI e produção local em 5,19%, dev com a API real em 5,419%, por região) e armadilhas novas: medir só como o CI, `.next` dividido entre build e dev, re-rasterização de 684 px ao tocar `.kpi-val`, movimento só dentro de `no-preference`.
  - [[arquitetura/stack]]: o movimento passa a ser CSS + rAF, com GSAP sem uso (D29).
  - [[orquestracao-agentes/agentes-e-fases]]: formato do workflow de 6 subagentes (implementar → portão → registrar) e regras do brief comum.
  - [[operacao/retomada]]: estado com o diff em produção; caminho do relatório do impeccable; resíduos da revisão; `/impeccable init` como opção.
  - [[index]]: descrições atualizadas.
- Correção: [[operacao/runbooks]] dizia que a rotação de segredo tinha 24 h de carência com os dois segredos valendo. O código invalida o antigo no clique, como diz o diálogo de confirmação. O runbook agora descreve o fluxo real e a carência virou pendência.
- Entregue: wiki atualizada, sem commit.

## [2026-10-16] update | Gasto em anúncios: lançamento manual e Meta Ads
- Pedido: receber o gasto das contas de anúncio do Meta Ads no Investimento do painel e ter uma aba de lançamento manual.
- Feito:
  - API: tabelas `custos` e `meta_contas` (migração 0006), rotas `/empresas/atual/custos` e `/empresas/atual/meta/contas`, sincronização de hora em hora no `server.ts`, códigos de erro novos em `apps/api/docs/erros.md`, OpenAPI regenerado.
  - Web: abas Configurações → Gastos e Meta Ads; "Gestão de Custos" leva para Gastos.
  - Wiki: D31, [[arquitetura/modelo-de-dados]], [[administracao-multiempresa/configuracao-por-empresa]], [[operacao/runbooks]] (token do Meta), [[operacao/retomada]].
- Entregue: código no disco, testes verdes, sem commit.

## [2026-10-16] fix | Painel ocupa a tela inteira no desktop
- Pedido: "o app está minimizado ou cortado no desktop, ele não ocupa a tela inteira do usuário".
- Feito: escala proporcional da tela fixa em `apps/web/app/tela.css` (D32 em [[decisoes-tecnicas/decisoes]]). Vale também para Relatórios e Ajuda, que usam a mesma `.tela`.
- Entregue: CSS no disco, diff visual inalterado (5,419% contra o dev), sem commit.

## [2026-10-16] update | Configurações ocupam a tela, transição por aba, hover do funil e Instalação com submenu
- Pedido: "as outras opções também estão curtas, não respeitam a tela do usuário"; animar as transições com Hyperframes; funil em SVG; hover em cada etapa do funil; Tag GTM, Webhooks e Meta Ads dentro de Instalação, como submenus com passo a passo.
- Feito (D33 em [[decisoes-tecnicas/decisoes]]):
  - Configurações na moldura e na escala do painel;
  - `template.tsx` com entrada por aba;
  - hover e dica no funil (que já era SVG puro);
  - submenu de Instalação com guias de passo a passo para Tag do GTM, Webhooks e Meta Ads.
- Medidas da wiki de UX (especialista 1): contêiner de até 1440 px, margem de 48 px e texto de no mínimo 15–16 px.
- Entregue: código no disco, diff visual 5,419% (inalterado) e testes verdes, sem commit.

## [2026-10-16] update | Funil com neon e clique que abre a lista da etapa e a ficha do usuário
- Pedido: "no funil o hover deve acender mais onde está em cima e não apagar o restante, adicione um efeito neon; se o usuário clicar deve abrir uma lista, por exemplo do FTD, e de onde veio com ícone do canal; clicando na lista abre o usuário como um CRM, com UTM e dados que o webhook informa".
- Feito (D34 em [[decisoes-tecnicas/decisoes]]):
  - hover com neon e sem escurecer as outras etapas;
  - etapas clicáveis e acessíveis por teclado;
  - rotas `/empresas/atual/eventos` e `/empresas/atual/leads/:leadKey` (analista ou acima, com RLS e mascaramento);
  - gaveta com a lista por canal e a ficha (origem, linha do tempo e webhooks);
  - amostra de 36 pessoas no seed;
  - ícones novos do @tabler: fechar, voltar, usuário, webhook e link.
- Corrigido no teste: clique numa etapa durante a saída da gaveta não abria a etapa; o rótulo "Depósitos depois" virou "Depósitos (com o FTD)".
- Entregue: código no disco, testes verdes, diff visual 5,357%, sem commit.

## [2026-10-16] update | Tutoriais em balão, conta e Sair na sidebar, gaveta com 10 itens e fundos
- Pedidos:
  - "na área de gestão de custo, vc precisa ter um ux e uma explicação explícita, use o hyperframe para fazer uma animação explicando", em formato de "balãozinho";
  - "temos que ter aquele ícone da foto do usuário e o botão de sair da plataforma que leva pra tela de login";
  - limitar a gaveta de eventos a 10 itens, mantendo o botão de ver mais;
  - fundos das imagens #4, #5 e #6, otimizados.
- Feito (D35 em [[decisoes-tecnicas/decisoes]]):
  - tutoriais GSAP em popover com seta (Gastos, Meta Ads, Tag, Webhooks e Instalação);
  - rodapé de conta na sidebar, com avatar de iniciais e Sair levando para `/login`;
  - gaveta com 10 itens e "Ver todos";
  - fundos em WebP: 123 KB no total, contra 3,2 MB dos originais.
- Também nesta sessão:
  - atalho Hoje nos filtros;
  - script `pnpm --filter @trafego/api db:ficticio`, que gera 30 dias de dados fictícios de todos os canais com UTMs (`--remover` apaga).
- Entregue:
  - código no disco, sem commit;
  - diff visual 5,198% (CI, limite 5,5%) e 67 testes do web verdes.

## [2026-10-16] update | Login em vidro, Argon2id, "lembrar de mim" e avatar clicável
- Pedido: avatar do usuário clicável; login igual à imagem enviada; "Faça seu login" no primeiro acesso e "Bem-vindo de volta" depois; validação toda no backend com JWT e hash seguro.
- Feito (D36 em [[decisoes-tecnicas/decisoes]]):
  - senha em Argon2id (OWASP), migração automática do scrypt antigo, comparação em tempo constante;
  - JWT com claim `sv` (trocar a senha derruba as outras sessões), 30 dias com "lembrar de mim";
  - cookie `ja_entrou` decide o título; login em cartão de vidro com ícones do @tabler, olho na senha e botão em gradiente;
  - avatar, nome e e-mail na sidebar levam ao Perfil;
  - fundo de Configurações mais visível.
- Entregue: código no disco, sem commit. Testes novos de senha e sessão verdes; diff 5,198%; web 67 testes.

## [2026-10-16] update | Fundo de ondas em SVG nas telas internas
- Pedido: "faça os fundos de dentro do app com svg utilizando o hyperframe" e "nada que deixe o site muito pesado".
- Feito (D37 em [[decisoes-tecnicas/decisoes]]):
  - `FundoOndas` em Relatórios e Ajuda: fitas de fios, crista e pontos em SVG, gerados por hash, sem imagem;
  - entrada e respiração GSAP no contrato Hyperframes; para sozinha em cerca de 86 s;
  - enxugado depois da medição: pontos em 3 caminhos, sem filtro, halo parado, GSAP sob demanda, `will-change` só durante a animação;
  - prettier aplicado em arquivos pendentes de sessões anteriores (`acoes-funil.ts`, `TelaLeads.tsx`, `contratos/src/leads.ts`, `icons/index.ts`, `gaveta-funil.test.tsx`), que reprovariam o CI.
- Entregue:
  - código no disco, sem commit;
  - 61 quadros por segundo no pior caso;
  - HTML de `/relatorios` de 93 KB para 47 KB;
  - diff 5,198%; web com 71 testes.
