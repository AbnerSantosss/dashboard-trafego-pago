# Plano de ação — Dashboard de tráfego pago multiempresa (alimentado por webhooks)

> Status: **plano para aprovação**. Nada foi implementado. Painel interativo deste plano:
> https://claude.ai/artifact/KcEDCoT1Qws3MjLLHMFgY6
> Imagem de referência: a tela "Visão Geral de Aquisição" enviada pelo usuário (1315×710). Fidelidade visual a ela é o critério número um.

---

## 0. Passo zero obrigatório: rodar `/gera-wiki`

**Antes de qualquer execução** (antes da Fase 0), o orquestrador roda o comando `/gera-wiki` nesta pasta do projeto.

- O comando vai perguntar nome do projeto, descrição, tipo e categorias. Respostas sugeridas:
  - Nome: Dashboard de Tráfego Pago Multiempresa
  - Descrição: Painel de resultados de aquisição (investimento, FTDs, CPA, depósitos, ROAS, funil e canais) alimentado por webhooks, com configuração de webhooks, regras de tratamento e apresentação por empresa.
  - Tipo: técnico
  - Categorias: arquitetura, decisoes-tecnicas, design-system, ingestao-webhooks, regras-de-tratamento, administracao-multiempresa, qa-visual, operacao
- Resultado esperado: `wiki/index.md`, `wiki/log.md`, subpastas por categoria e `CLAUDE.md` com a regra de leitura automática da wiki.
- Em seguida o `docs-wiki` complementa o `CLAUDE.md` (seção 9) e registra este plano no `wiki/log.md`.
- **Gate G0:** só depois de `wiki/index.md` existir e o log ter a entrada de setup é que a Fase 0 começa.

---

## 1. Objetivo e escopo

Sistema web multiempresa (multi-tenant) que:

1. Recebe eventos por **webhook**, com endpoint, segredo e regras próprios por empresa e por fonte.
2. Trata os eventos conforme **regras configuráveis por empresa**: mapeamento de campos, classificação de origem e canal (UTMs, referrer, página de entrada, afiliado), normalização de moeda e fuso.
3. Agrega por dia, canal, campanha e página e calcula KPIs (Investimento, FTDs, CPA, Depósitos, ROAS) e o funil (Base contatada → Cliques → Visitas → Cadastro → FTD).
4. Exibe um dashboard **idêntico à imagem de referência** para cada empresa, com filtros de período, comparação, canal e campanha, e exportação.
5. Tem uma área administrativa por empresa: webhooks, regras, apresentação (KPIs visíveis, nomes, paleta, logo, moeda, fuso) e usuários com papéis.

Fora de escopo nesta entrega: integrações diretas com APIs de anúncios (só webhook), billing, apps móveis.

---

## 2. Estrutura de orquestração

Um **orquestrador** (Maestro) coordena **nove subagentes**, todos **Opus 5.5 em modo Auto**. Regras:

- Cada agente escreve **só na sua área** do repositório (um escritor por conjunto de arquivos). Integração por PR revisado pelo orquestrador.
- Toda tarefa tem entrega, critério de aceite e dependência explícitos (seção 4). O orquestrador só despacha tarefa cuja dependência está concluída.
- **Gates** bloqueantes: G0 wiki gerada; G1 protótipo estático com diff ≤ 2% contra a imagem; G2 isolamento entre empresas provado por teste; G3 fluxo ponta a ponta para duas empresas; G4 aprovação visual do usuário na tela real.
- O orquestrador mantém `wiki/log.md` (entradas curadas) e o registro automático de sessão.
- Nenhuma chamada paga (geração de imagem, deploy) sem confirmação do usuário. Nenhuma chave de API em código, wiki, log ou artifact.

| Agente | Papel | Especialidade | Entrega principal |
|---|---|---|---|
| `orquestrador` | Maestro | Coordenação, gates, integração | Tarefas despachadas, gates, log |
| `design-fidelity` | Fidelidade Visual | Tokens, spec de componentes, diff pixel a pixel (Playwright + pixelmatch) | `packages/design/tokens.css`, spec, relatório de diff |
| `frontend-ui` | Front-end | React, TypeScript, Tailwind, layout | Shell, KPI cards, filtros, tabela |
| `charts-motion` | Gráficos e animação | d3, GSAP, doutrina Hyperframes | Funil trapezoidal, sparklines, contadores |
| `backend-ingestion` | Ingestão | Node/TS, HMAC, idempotência, filas | API de webhooks, workers, console de teste |
| `data-model-rules` | Modelo e regras | PostgreSQL + RLS, DSL de mapeamento, classificador, agregações | Migrações, motor de regras, API de métricas |
| `tenant-admin` | Administração | Telas por empresa | Admin de webhooks, regras, apresentação, usuários |
| `qa-visual` | QA | Regressão visual, e2e, contrato, carga | Suítes e relatórios |
| `assets-icons` | Ícones | SVG do @tabler/icons (MIT); raster só pela muapi, com confirmação | Pacote de ícones SVG |
| `docs-wiki` | Documentação | Wiki, CLAUDE.md, runbooks | `wiki/`, `CLAUDE.md`, `log.md` |

Fluxo: plano aprovado → `/gera-wiki` → tarefa despachada com área exclusiva → entrega → revisão → gate → PR integrado → log.

---

## 3. Fases (resumo)

| Fase | Dias | O que fecha a fase |
|---|---|---|
| 0 Preparação | 0–2 | `/gera-wiki` rodado (P0.0), monorepo, CLAUDE.md, tooling |
| 1 Especificação visual | 1–7 | Tokens, spec, fixtures, protótipo estático, ícones, **Gate G1** |
| 2 Fundação | 3–8 | Esquema multiempresa com RLS, auth e papéis, API base, seed |
| 3 Ingestão | 7–15 | Webhooks assinados, armazenamento bruto, fila, regras, classificador, agregações |
| 4 Dashboard | 7–16 | Shell, KPIs, funil, animações, tabela, filtros, exportar, ligação à API |
| 5 Administração (enxuta) | 12–14 | Apresentação (nome, logo), webhooks por empresa (segredo) · D15 |
| 6 QA (enxuta) | 14–15 | `pnpm check` + diff visual contra a imagem; e2e mínimo de isolamento (**Gate G3**) · D15 |
| 7 Entrega | 15–17 | Wiki essencial, Portainer + túnel Cloudflare, **Gate G4** · D15 |

> **Escopo reduzido em 2026-10-15 (D15):** a pedido do usuário, as fases 5–7 ficam só com o essencial. Itens riscados abaixo saem do plano e podem voltar como melhorias depois da entrega.

Dias são úteis e estimados; fases 2/3 e 4/5 correm em paralelo porque os agentes são distintos.

---

## 4. Tarefas detalhadas

Formato: **ID** — tarefa · agente · entrega · critério de aceite · depende de · dias.

### Fase 0 — Preparação
- **P0.0** — PRÉ-REQUISITO: rodar `/gera-wiki` na pasta do projeto · orquestrador · `wiki/` gerada · `wiki/index.md` e `wiki/log.md` existem com a entrada de setup · — · D0–D1
- **P0.1** — Criar repositório git e monorepo (`apps/web`, `apps/api`, `packages/design`, `packages/rules`) · orquestrador · repositório · primeiro commit feito · P0.0 · D1
- **P0.2** — Complementar `CLAUDE.md`: ponteiro para a wiki Hyperframes, regra de segredos, registro de sessão · docs-wiki · `CLAUDE.md` · snippet aplicado; nenhuma chave no repositório · P0.0 · D1–D2
- **P0.3** — Registrar no `wiki/log.md` o plano aprovado e a distribuição por agente · docs-wiki · entrada no log · lint da wiki passa · P0.0 · D1–D2
- **P0.4** — Tooling: pnpm, TypeScript estrito, ESLint, Prettier, Vitest, Playwright · frontend-ui · configs · `pnpm lint`, `test` e `build` passam · P0.1 · D1–D2

### Fase 1 — Especificação visual
- **P1.1** — Consolidar tokens da imagem (paleta, tipografia, espaçamento, raios, sombras) · design-fidelity · `tokens.css` e `tokens.json` · cada token tem valor e origem (amostrado, medido, inferido) · P0.4 · D1–D3
- **P1.2** — Especificar cada componente com medidas em px (sidebar, cabeçalho, filtros, KPI, funil, tabela, botões) · design-fidelity · `design/componentes.md` · os 7 blocos têm largura, altura, padding, fonte e cor · P1.1 · D2–D4
- **P1.3** — Fixtures com os dados exatos da imagem (5 KPIs, 5 etapas, 6 linhas por canal) · data-model-rules · `packages/fixtures/referencia.json` · valores idênticos à imagem · P1.1 · D2–D3
- **P1.4** — Protótipo estático HTML/CSS pixel-fiel da Visão Geral · frontend-ui · `prototype/visao-geral.html` · diff ≤ 2% dos pixels a 1315 px · P1.2 · D3–D6
- **P1.5** — Conjunto de ícones SVG (menu, KPIs, canais, ações) · assets-icons · `packages/design/icons/*.svg` · 14 ícones em 20 e 24 px, `currentColor` · P1.2 · D3–D5
- **P1.6** — **Gate G1**: comparação por sobreposição do protótipo com a imagem · qa-visual · relatório de diff · aprovado pelo orquestrador · P1.4 · D6–D7

### Fase 2 — Fundação
- **P2.1** — Esquema multiempresa: `tenants`, `users`, `memberships`, `sources`, `webhook_events`, `events`, `metrics_daily`, `rules`, `presentation` · data-model-rules · migrações Drizzle · toda tabela tem `tenant_id` e política RLS · P0.4 · D3–D6
- **P2.2** — Auth e papéis por empresa (admin, analista, leitor) com troca de empresa · backend-ingestion · módulo de auth · usuário só vê a empresa ativa; testes de isolamento passam · P2.1 · D5–D8
- **P2.3** — API base, contrato de erros, logs estruturados, variáveis e segredos · backend-ingestion · `apps/api` com healthcheck · OpenAPI gerado; nenhum segredo em código · P2.1 · D5–D7
- **P2.4** — Seed da empresa demo com as fixtures · data-model-rules · script seed · dashboard mostra exatamente os números da imagem a partir do banco · P2.1 · D6–D7

### Fase 3 — Ingestão
- **P3.1** — `POST /webhooks/{empresa}/{fonte}` com HMAC, timestamp, janela de replay e idempotência · backend-ingestion · rota e testes de contrato · assinatura inválida 401; repetido não duplica · P2.3 · D7–D10
- **P3.2** — Armazenamento bruto (payload jsonb, cabeçalhos, status) e fila com retentativa · backend-ingestion · `webhook_events` e worker · bruto nunca se perde; falha vai para dead-letter com motivo · P3.1 · D8–D11
- **P3.3** — Motor de regras por empresa e fonte: JSONPath, tipos de evento, moeda, fuso · data-model-rules · `packages/rules` · regras versionadas; teste com payload devolve evento canônico · P3.2 · D9–D13
- **P3.4** — Classificador de origem e canal (utm_source/medium/campaign, referrer, página, afiliado) · data-model-rules · módulo · reproduz Meta, Email, SMS, Afiliados, Outros · P3.3 · D11–D13
- **P3.5** — Agregações diárias e cálculo de CPA, ROAS e taxas do funil · data-model-rules · jobs e `metrics_daily` · totais batem com as fixtures · P3.4 · D12–D15
- **P3.6** — Reprocessamento em lote e console de teste de webhook · backend-ingestion · comando e tela · 10 mil eventos em < 2 min local · P3.3 · D13–D15

### Fase 4 — Dashboard
- **P4.1** — Layout: sidebar, cabeçalho com data, Exportar, barra de filtros · frontend-ui · shell · igual ao protótipo P1.4 · P1.6 · D7–D9
- **P4.2** — Cards de KPI (ícone, valor, delta, sparkline) · frontend-ui · `KpiCard` · 5 cards com tokens; delta verde ou vermelho conforme a métrica · P4.1 · D8–D10
- **P4.3** — Funil trapezoidal em d3, gradiente azul→ciano→verde, conectores para as taxas · charts-motion · `Funnel` · formas e cores idênticas; taxas da etapa anterior · P4.1 · D9–D12
- **P4.4** — Sparklines e contadores GSAP, entrada em cascata · charts-motion · presets · respeita `prefers-reduced-motion`; sem layout shift · P4.2 · D10–D12
- **P4.5** — Tabela Desempenho por canal: cabeçalho em dois níveis, ordenação, linha Total · frontend-ui · `ChannelTable` · colunas e Total como na imagem · P4.1 · D10–D13
- **P4.6** — Filtros funcionais (período, comparar com, canal, campanha, limpar) · frontend-ui · `FilterBar` ligada à API · mudar filtro atualiza tudo; URL guarda o estado · P3.5 · D13–D15
- **P4.7** — Exportar CSV e PNG; rotas Gestão de Custos e Relatórios (estrutura) · frontend-ui · exportação e rotas · CSV com as colunas da tabela; PNG na resolução da tela · P4.5 · D14–D16
- **P4.8** — Ligação à API de métricas com cache por empresa e período · backend-ingestion · hooks · primeira pintura com dados < 1,5 s com seed local · P3.5 · D14–D16

### Fase 5 — Administração (enxuta, D15)
- **P5.1** — Apresentação: nome exibido e logo (upload PNG/SVG) em Configurações → Apresentação · tenant-admin · tela + rota PATCH /empresas/atual/apresentacao · painel reflete após recarregar · P4.8 · **concluída 2026-10-15**
- **P5.2** — Webhooks por empresa: listar fontes, gerar/rotacionar segredo (exibido uma vez) · tenant-admin · tela + rotas · segredo nunca persistido em claro · P3.1 · **concluída 2026-10-15** (D18)
- ~~P5.3 Editor de regras com teste ao vivo~~ · ~~P5.4 KPIs/paleta/colunas configuráveis~~ · ~~P5.5 Usuários, papéis e convites~~ — removidos (D15); papéis continuam só via seed/SQL.

### Fase 6 — QA (enxuta, D15)
- **P6.1** — `pnpm check` (lint, typecheck, testes) e `pnpm qa:visual` contra a imagem (≤ 4,5%, D10) rodando no CI do GitHub · qa-visual · workflow · falha bloqueia merge · P4.8
- **P6.2** — E2E mínimo: webhook → agregação → `/metricas/visao-geral` para 2 empresas isoladas (**Gate G3**) · qa-visual · teste Vitest · passa nas duas · P4.8
- ~~P6.3 Carga 500 ev/s~~ · ~~P6.4 Acessibilidade e responsividade~~ — removidos (D15).

### Fase 7 — Entrega
- **P7.1** — Wiki essencial: como rodar local, como cadastrar empresa e webhook, runbook de deploy · docs-wiki · `wiki/` · pessoa nova sobe e usa só com a wiki · P6.2
- **P7.2** — Deploy em produção · backend-ingestion · ambientes · webhook de produção processa evento de teste · P6.2
  - P7.2a — Repositório **público** já criado em 2026-10-15 (`github.com/AbnerSantosss/dashboard-trafego-pago`); manter sem segredos (varredura antes de cada push; `.env` e `registro/` fora do git) · com confirmação · D9
  - P7.2b — Stack no Portainer (`portainer.proxserverabner.site`): `docker-compose.prod.yml` com web, api, postgres e cloudflared; segredos só em variáveis do Portainer · com confirmação · D9
  - P7.2c — Túnel Cloudflare (conta `fb20af5d…`) apontando o hostname público para o serviço web; token do túnel fora do repositório · com confirmação · D9
- **P7.3** — Entrega final: demo com a empresa seed, `log.md`, pendências · orquestrador · entrega · **Gate G4**: usuário aprova a fidelidade na tela real · P7.2

---

## 5. Especificação visual (análise da imagem)

### 5.1 Estrutura da tela
- **Sidebar** 180 px, fundo `#051424`: logo roxo (`#524EA1`) com texto "Logo" na imagem; na empresa PASIO entra o ícone oficial (`https://pasion.poker/imagens/20260919_6aaf26189bd87.png`, salvo em `packages/design/brand/pasio-logo.png`) com o nome da empresa, ambos trocáveis em Configurações → Apresentação (P5.4); menu Visão Geral (ativo, fundo `#0A307C`, raio 8), Gestão de Custos, Relatórios, Ajuda; ícones de linha à esquerda de cada item.
- **Cabeçalho**: título "Visão Geral de Aquisição" (28 px / 600, branco); subtítulo "Acompanhe os resultados do marketing de forma simples e objetiva." (15 px, `#D1E3F4`); à direita, "Dados atualizados em: 24/05/2024 08:30" com ponto verde `#06F6C7` e botão "Exportar ▾" (fundo `#101A32`).
- **Barra de filtros** (56 px, fundo `#051E31`): Período (01/05/2024 – 24/05/2024), Comparar com (Período anterior), Canal (Todos), Campanha (Todas), botão "Limpar filtros" (texto e borda `#26C89F`, fundo `#004231`).
- **Cinco cards de KPI** (112 px de altura, gap 12 px, fundo `#061B28`, borda 1 px `#0C2030`, raio 8): tile de ícone 44 px colorido, rótulo (13 px `#D1E3F4`), valor (24 px / 600 branco), delta (13 px / 600 `#06F6C7`, seta ▲/▼) + "vs. período anterior" em `#8FA6BD`, sparkline verde à direita.
- **Funil de Aquisição** (34% da largura): cinco trapézios empilhados (56 px cada, recuo lateral de 12 px por etapa), cores `#0162FF`, `#6ED5FF`, `#04ADDF`, `#00C98B`, `#04C67E`; rótulo e valor dentro; linhas conectoras para a taxa à direita (16 px / 600) com legenda "de conversão" ou "base de referência".
- **Desempenho por canal** (66%): cabeçalho em dois níveis (FTDs agrupa Qtd. e Valor (R$)), células 12 px `#EDF2FF`, ROAS em verde, linha Total com fundo `#0D2644`.

### 5.2 Dados exatos da imagem (fixtures)
KPIs: Investimento total R$ 33.840 (+12,5%) · FTDs 995 (+18,6%) · Custo por FTD (CPA) R$ 33,97 (−5,4%, tile vermelho `#E13C5D`) · Depósitos no período R$ 226.190 (+22,1%, tile `#24CCB6`) · ROAS (Depósitos) 6,68x (+16,8%, tile `#34DFCE`).

Funil: Base contatada 320.840 (100%) · Cliques 40.000 (12,5%) · Visitas ao site 30.000 (75,0%) · Cadastro 6.000 (20,0%) · FTD 600 (10,0%).

| Canal | Invest. | Cliques | Visitas | Cadastros | FTDs Qtd. | FTDs Valor | Depósitos | CPA | ROAS |
|---|---|---|---|---|---|---|---|---|---|
| Meta | 13.260 | 19.823 | 9.138 | 1.900 | 250 | 37.690 | 58.750 | 53,04 | 4,43x |
| Email | 10.890 | 15.630 | 7.082 | 1.100 | 210 | 29.420 | 45.800 | 51,86 | 4,20x |
| SMS | 8.740 | 10.512 | 4.921 | 520 | 85 | 12.580 | 18.250 | 102,82 | 2,09x |
| Afiliados | – | 12.631 | 10.251 | 2.800 | 420 | 51.870 | 96.280 | – | – |
| Outros | 950 | 1.420 | 862 | 48 | 30 | 5.640 | 7.110 | 31,67 | 7,48x |
| **Total** | 33.840 | 70.386 | 32.254 | 6.368 | 995 | 137.780 | 226.190 | 33,97 | 6,68x |

### 5.3 Tokens
A tabela completa (43 tokens com origem) está no dataset `tokens` do artifact. Resumo: fundos `#03111E` (app), `#051424` (sidebar), `#061B28` (cards), `#051E31` (filtros); textos `#FFFFFF`, `#D1E3F4`, `#8FA6BD` (inferido); acentos `#0070F8`, `#24CCB6`, `#E13C5D`; positivo `#06F6C7`, negativo `#FF5C7A` (inferido); fonte Inter / Segoe UI (inferida); raio 8 px em tudo.

### 5.4 Como a fidelidade é garantida
1. Protótipo estático primeiro (P1.4), sem React, comparado por sobreposição com a imagem (P1.6, Gate G1).
2. Regressão visual no CI (P6.1) com limite de 2% de pixels divergentes por tela.
3. Aprovação final do usuário na tela real (Gate G4).

---

## 6. Arquitetura

### 6.1 Stack recomendada (decisão a confirmar)
- **Monorepo pnpm**: `apps/web` (Next.js 15, React, TypeScript, Tailwind), `apps/api` (Node, Fastify), `packages/design` (tokens, ícones), `packages/rules` (motor de regras), `packages/fixtures`.
- **Banco**: PostgreSQL com Drizzle ORM; **RLS por `tenant_id`** em toda tabela; fila com **pg-boss** (sem Redis no início; BullMQ/Redis se a carga exigir).
- **Gráficos/animação**: d3 (funil, sparklines) e GSAP (contadores, entrada em cascata), seguindo o contrato de animação da wiki Hyperframes (seek-safe, sem layout shift, reduced-motion). Hyperframes é framework de **vídeo**; dele usamos a doutrina e o catálogo de blocos como referência, não o runtime.
- **Auth**: Auth.js, papéis por empresa (admin, analista, leitor).
- **Testes**: Vitest, Playwright, pixelmatch.
- Alternativa, se preferir Python: FastAPI + SQLAlchemy + React/Vite com o mesmo modelo de dados. Decidir antes de P0.1.

### 6.2 Fluxo do webhook
```
POST /webhooks/{empresa}/{fonte}
  → valida HMAC-SHA256 (segredo da fonte), timestamp (janela de 5 min), id do evento (idempotência)
  → grava webhook_events (payload jsonb, cabeçalhos, status=recebido) → responde 202
  → fila → regras da fonte (versão ativa) → evento canônico em events
  → classificador de canal → agregação diária em metrics_daily
  → API de métricas (filtros: período, comparação, canal, campanha) → dashboard
```
Evento repetido responde 200 sem duplicar; falha de tratamento vai para dead-letter com motivo; reprocessamento em lote reaplica regras novas sobre `webhook_events`.

### 6.3 Modelo de dados (principal)
`tenants`, `users`, `memberships(tenant_id, user_id, role)`, `sources(tenant_id, slug, secret_hash, rules_version)`, `webhook_events(tenant_id, source_id, payload jsonb, headers, status, received_at)`, `events(tenant_id, type, occurred_at, value, currency, channel, campaign, page, lead_key, utm_*)`, `metrics_daily(tenant_id, day, channel, campaign, page, investimento, cliques, visitas, cadastros, ftds, ftds_valor, depositos)`, `rules(tenant_id, source_id, version, mapping jsonb, channel_rules jsonb)`, `presentation(tenant_id, kpis jsonb, columns jsonb, palette jsonb, logo, currency, timezone)`.

Tipos canônicos de evento: `gasto`, `clique`, `visita`, `cadastro`, `ftd`, `deposito`. KPIs derivados: CPA = gasto / ftds; ROAS = depósitos / gasto; taxas do funil = etapa / etapa anterior.

### 6.4 Regras de tratamento por empresa
- **Mapeamento**: por campo canônico, um JSONPath no payload + conversão (moeda, fuso, texto→número) + valor padrão.
- **Canal**: lista ordenada de regras sobre `utm_source`, `utm_medium`, `referrer`, página de entrada e código de afiliado; a primeira que casa define o canal; o resto cai em "Outros". Regras padrão reproduzem Meta, Email, SMS, Afiliados, Outros.
- **Versionamento**: toda mudança gera nova versão; é possível reprocessar um período com a versão nova.
- **Apresentação**: KPIs visíveis e ordem, nome exibido, ícone/logo (padrão da PASIO: ícone oficial; outras empresas: iniciais), colunas da tabela, paleta, moeda e fuso por empresa. Decisão D6 na wiki (pedido do usuário em 2026-10-15).

---

## 7. Critérios de aceite globais
1. Tela Visão Geral com diff ≤ 2% contra a imagem (G1 e P6.1) e aprovada pelo usuário (G4).
2. Duas empresas com dados diferentes nunca enxergam dados uma da outra (teste automatizado, G2).
3. Webhook assinado → regra → agregação → painel funciona ponta a ponta para as duas empresas (G3).
4. 500 eventos/s sem perda em teste local; replay e assinatura inválida rejeitados.
5. Admin configura webhook, regra e apresentação sem tocar em código.
6. Wiki permite que uma pessoa nova onboarde uma empresa sozinha.

---

## 8. Riscos
| ID | Risco | Impacto | Mitigação | Dono |
|---|---|---|---|---|
| R3 | Vazamento entre empresas | Crítico | `tenant_id` + RLS, testes de isolamento no CI, segredo por fonte | backend-ingestion |
| R1 | Fidelidade visual abaixo do exigido | Alto | Protótipo + G1, diff automatizado ≤ 2%, tokens com origem | design-fidelity |
| R2 | Payloads variam por empresa/fonte | Alto | Bruto sempre guardado, regras versionadas, editor com teste, reprocessamento | data-model-rules |
| R4 | Eventos duplicados/fora de ordem | Alto | Idempotência, janela de replay, agregação recalculável | backend-ingestion |
| R5 | Hyperframes é framework de vídeo | Médio | Usar só doutrina de animação e catálogo; app em React + d3 | charts-motion |
| R7 | Subagentes editando os mesmos arquivos | Médio | Áreas exclusivas, um escritor por conjunto, PRs | orquestrador |
| R8 | Escopo da administração crescer | Médio | Fase 5 limitada; o resto vira pendência | orquestrador |
| R6 | Custo de ícones por IA | Baixo | SVG do @tabler/icons; raster só pela muapi, com confirmação (D5) | assets-icons |

---

## 9. Ícones e ativos (custos)
| Opção | Custo/imagem | Quando |
|---|---|---|
| SVG da biblioteca @tabler/icons (MIT) | grátis | Padrão para toda a interface (D5) |
| RealVisXL V5.0 local (stable-diffusion.cpp, RTX 4060) | grátis | Ilustrações e logos placeholder |
| FLUX.2 klein 4B (OpenRouter) | US$ 0,015 | Raster rápido |
| Nano Banana 2 Lite (OpenRouter) | US$ 0,034 | Ícone estilizado com instrução textual |
| Nano Banana 2 (kie.ai) | US$ 0,04 | Alternativa sem OpenRouter |
| Nano Banana 2 Edit (muapi.ai) | US$ 0,06 | Só retoque de imagem existente |

Toda chamada paga exige confirmação do usuário. A pasta Dubra Frame (`app/gerar_imagem.py`) é usada como está, sem alterações.

---

## 10. Snippet para o CLAUDE.md do projeto (aplicado em P0.2, depois do `/gera-wiki`)
```markdown
## Wiki de referência externa: Hyperframes
Para animação (GSAP, seek-safe, reduced-motion) e blocos de gráfico, leia primeiro
`C:\Users\binho\Documents\Projetos de IA\Obsidian\Especialistas\18 - Hyperframes\wiki\index.md`
e `wiki/08-integracao/como-usar-esta-wiki-em-outro-projeto.md`. Hyperframes é framework de vídeo:
use a doutrina, não o runtime. Nunca rode `hyperframes init/publish/cloud/lambda` neste projeto.

## Segredos
Nenhuma chave de API (OpenRouter, kie.ai, muapi, banco) entra em código, wiki, log ou artifact.
Use variáveis de ambiente e `.env.example` sem valores.
```

---

## 11. Decisões pendentes do usuário
1. Aprovar este plano e a ordem das fases.
2. Confirmar a stack (Next.js + Fastify + PostgreSQL) ou escolher a alternativa Python.
3. Confirmar que o repositório fica nesta pasta (`10.1 - Eventos PASIO`) ou indicar outra.
4. Autorizar o início: o orquestrador roda `/gera-wiki` e só então começa a Fase 0.
