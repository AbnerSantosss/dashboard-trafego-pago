---
tipo: arquitetura
atualizado: 2026-10-19
tags: [arquitetura, producao, infraestrutura, fluxos, rotas, cloudflare, portainer, kapanda, mapa]
---

# Mapa do sistema

O sistema inteiro numa página: quem fala com quem, onde cada peça roda e de onde vem cada número do painel. O fluxo conceitual está em [[arquitetura/visao-geral]], as escolhas de tecnologia em [[arquitetura/stack]] e as tabelas em [[arquitetura/modelo-de-dados]]. Os problemas em aberto estão em [[operacao/problemas-atuais]].

## 1. Visão de ponta a ponta
```
 ENTRADAS DE DADOS                           USUÁRIO DO PAINEL
 ─────────────────                           ─────────────────
 Site pasion.bet (GTM-KWXQWW6V, Tag 42)       navegador
   └─ POST api.kapanda.lat/t/pasio/clk          └─ https://kapanda.lat
 Plataforma / afiliados (webhooks)                  │
   └─ POST api.kapanda.lat/webhooks/pasio/{fonte}   │
 Meta Ads (Graph API)  ◄── a API busca o gasto      │
                          de hora em hora           │
            │                                       │
            ▼                                       ▼
 ┌──────────────────────── Cloudflare ────────────────────────┐
 │ zona kapanda.lat (NS eva/joel) · certificado universal     │
 │ HTTPS sempre · TLS ≥ 1.2 · www → raiz (301)                │
 │ túnel "servidor-abner": kapanda.lat, www → localhost:3480  │
 │                         api.kapanda.lat  → localhost:3481  │
 └─────────────────────────────┬──────────────────────────────┘
                               │ (saída do cloudflared, nenhuma porta aberta)
 ┌─────────────────────── VPS (host) ─────────────────────────┐
 │ cloudflared (no host) · Docker · Portainer CE 2.39.1       │
 │ cerca de 64 contêineres de outros projetos na mesma máquina│
 │                                                            │
 │  stack trafego-pasio (rede interna do compose)             │
 │  ┌─────────────┐   API_URL=http://api:3001  ┌────────────┐ │
 │  │ web (Next)  │ ─────────────────────────► │ api        │ │
 │  │ 127.0.0.1:  │                            │ (Fastify)  │ │
 │  │ 3480 → 3000 │                            │ 127.0.0.1: │ │
 │  └─────────────┘                            │ 3481→3001  │ │
 │                                             └─────┬──────┘ │
 │  segredos (alpine, gera e sai) ──► volume segredos│        │
 │                                             ┌─────▼──────┐ │
 │                                             │ db         │ │
 │                                             │ Postgres 16│ │
 │                                             │ volume     │ │
 │                                             │ pgdata     │ │
 │                                             └────────────┘ │
 └────────────────────────────────────────────────────────────┘
```

## 2. Infraestrutura
| Peça | Onde | Papel | Observação |
|---|---|---|---|
| Domínio `kapanda.lat` | Hostinger (registro) | registro do domínio | só os nameservers apontam para a Cloudflare; DNSSEC desligado |
| DNS e borda | Cloudflare (Free) | zona, certificado, redirecionamento, proxy | os CNAMEs para o túnel são criados pela própria Cloudflare |
| Túnel `servidor-abner` | cloudflared no host | publica as portas locais sem abrir porta no firewall | compartilhado com outros projetos do servidor (rotas `painel`, `portainer` etc.) |
| VPS | servidor do usuário | Docker | 4 CPUs, 6,4 GB de RAM, cerca de 64 contêineres e 55 imagens (2026-10-19) |
| Portainer | `portainer.proxserverabner.site` (também pelo túnel) | cria e atualiza a stack a partir do Git | ambiente `local` (id 3), stack id 135 |
| Repositório | `github.com/AbnerSantosss/dashboard-trafego-pago` (público) | fonte da stack e CI | o Portainer clona `refs/heads/main` |
| GTM | contêiner `GTM-KWXQWW6V` | carrega a Tag de atribuição no site | versão 12 publicada com a Tag 42 |

Endereços, variáveis da stack e rotas do túnel em detalhe: [[operacao/producao]].

## 3. Contêineres da stack `trafego-pasio`
| Serviço | Imagem | Sobe depois de | Faz |
|---|---|---|---|
| `segredos` | `alpine:3.20` | — | grava 4 segredos aleatórios no volume `segredos` se ainda não existirem e sai com 0 |
| `db` | `postgres:16-alpine` | `segredos` | banco `trafego`; senha lida de arquivo; nenhuma porta publicada |
| `api` | `ghcr.io/.../api` (alvo `api` do `Dockerfile`, construída no GitHub Actions, D41) | `db` saudável | `segredos-do-servidor.ts` monta as variáveis → `db/producao.ts` (migrações, `app_user`, PASIO, admin) → Fastify na 3001 |
| `web` | `ghcr.io/.../web` (alvo `web`, D41) | `api` saudável | `next start` na 3000; não recebe segredo nenhum |

Volumes: `trafego-pasio_pgdata` (dados) e `trafego-pasio_segredos` (senhas e chave de cifra). Os dois andam juntos no backup e **nunca** podem ser apagados sozinhos.

## 4. Código (monorepo pnpm)
| Pasta | O que é |
|---|---|
| `apps/web` | Next.js 15: painel, Leads, Relatórios, Gestão de Custos, Configurações e telas de conta |
| `apps/api` | Fastify 5: webhooks, fila, regras, métricas, conta, administração, gasto e Tag |
| `packages/contratos` | tipos compartilhados entre API e web |
| `packages/rules` | motor de regras (mapeamento JSONPath e classificador de canal) |
| `packages/graficos` | funil (d3), sparkline e contador |
| `packages/design` | tokens, ícones SVG e marca |
| `packages/fixtures` | números da imagem de referência (testes e diff visual) |

### Módulos da API (`apps/api/src`)
| Módulo | Responsabilidade |
|---|---|
| `server.ts`, `app.ts`, `env.ts` | sobe o Fastify, registra rotas, CORS (só `WEB_URL`), rate-limit por `cf-connecting-ip`, relógio do Meta (1 h) |
| `segredos-do-servidor.ts` | lê `/run/segredos` e preenche senhas, `AUTH_SECRET`, chave de cifra e URLs do banco |
| `db/` | esquema Drizzle, migrações, `comTenant` (RLS), preparo de produção, seed e dados fictícios (só local) |
| `rotas/webhooks.ts`, `webhooks/` | recepção com HMAC, idempotência, fila pg-boss e worker que aplica as regras |
| `rules/` | carrega a versão ativa da regra da fonte |
| `metricas/`, `rotas/metricas.ts` | agregação diária e `/metricas/visao-geral` |
| `atribuicao/` | coleta da Tag do GTM (`/t/:empresa/clk`), toques e visitas |
| `custos/` | gasto manual, contas do Meta Ads e sincronização de hora em hora |
| `conta/`, `rotas/auth.ts`, `auth/` | login (Argon2id, JWT com `sv`), recuperação, convites, usuários e perfil |
| `admin/` | fontes de webhook, segredos cifrados (AES-256-GCM) e apresentação |
| `leads/` | lista por etapa do funil e ficha da pessoa |

### Rotas HTTP da API
| Grupo | Rotas |
|---|---|
| Saúde | `GET /health`, `GET /ready` |
| Entrada de dados | `POST /webhooks/:empresa/:fonte`, `POST …/reprocessar`, `GET …/entregas`; `POST` e `OPTIONS /t/:empresa/clk` |
| Conta | `POST /auth/login`, `/auth/recuperar`, `/auth/redefinir`; `GET`/`PATCH /me`, `POST /me/empresa` (troca a empresa ativa); `GET /convites/:token`, `POST /convites/:token/aceitar` (`/auth/sessao-dev` só existe em desenvolvimento) |
| Painel | `GET /metricas/visao-geral`, `GET /empresas/atual/eventos`, `GET /empresas/atual/leads/:leadKey` |
| Administração da empresa | `/empresas/atual` (dados), `/apresentacao`, `/fontes` (+ `:id`, `:id/segredo`), `/usuarios`, `/convites`, `/custos`, `/meta/contas` (+ `:id`, `:id/sincronizar`) |

### Páginas do web (`apps/web/app`)
`/` (Visão Geral), `/leads`, `/relatorios`, `/gestao-de-custos`, `/configuracoes` com as abas `apresentacao`, `gastos`, `instalacao`, `meta-ads`, `perfil`, `tag`, `usuarios` e `webhooks`; e as públicas `/login`, `/redefinir` e `/convite`. O `middleware.ts` manda para `/login` quem não tem o cookie `sessao`.

## 5. Fluxos
**Webhook (cadastro, FTD, depósito, clique, gasto)**: `POST /webhooks/pasio/{fonte}` → assinatura HMAC com o segredo da fonte, janela de 5 min e id do evento → grava o bruto em `webhook_events` e responde 202 → pg-boss → regra ativa da fonte → evento canônico em `events` → agregação em `metrics_daily`. Falha de regra fica com status `erro` e pode ser reprocessada. Contrato: [[ingestao-webhooks/contrato-webhook]].

**Tag do GTM (visitas e atribuição)**: a Tag 42 roda em todas as páginas do site e envia `page_view` por `sendBeacon` para `/t/pasio/clk`. Cada envio vira um toque em `attribution_touches`; a primeira página da sessão (`cv: 1`) também vira um evento `visita`, agregado alguns segundos depois. Responde 204.

**Gasto**: lançado à mão em Configurações → Gastos, ou puxado da Graph API do Meta pelas contas conectadas (token cifrado), de hora em hora ou pelo botão "sincronizar". Vai para `custos` e soma no `investimento` de `metrics_daily`.

**Leitura do painel**: o web chama `GET /metricas/visao-geral` pela rede interna com o cookie da sessão repassado; a API fixa `app.tenant_id` e o RLS do Postgres só devolve linhas da empresa ativa.

**Login**: `/auth/login` confere a senha (Argon2id) e devolve o JWT assinado com `AUTH_SECRET`; o web guarda no cookie `sessao`. Trocar a senha incrementa `sv`, o que derruba as sessões antigas. Primeiro acesso: o preparo imprime no log um link `/redefinir` de 1 hora enquanto o admin não tem senha.

**Subida da API (preparo)**: migrações → `app_user` com LOGIN → empresa PASIO, se faltar → admin de `ADMIN_EMAIL`. Na subida de 2026-10-19 às 20:07: "migrações aplicadas", "papel app_user com LOGIN", "empresa PASIO já existia; admin ok", sem link novo (o admin já tem senha).

**Atualização (deploy, desde 2026-10-19, D41)**: push na `main` → CI (lint, tipos, testes, build e diff visual) e, em paralelo, o workflow Deploy, que constrói `api` e `web` no GitHub Actions e publica no GHCR (`latest` e `sha-xxxxxxx`) → Portainer → stack → "Pull and redeploy" (manual; o webhook de stack é da Business Edition) → a stack baixa as imagens prontas (`pull_policy: always`) e recria os contêineres em segundos. O preparo aplica as migrações novas. Rollback pela variável `IMAGEM_TAG`. Antes de D41, o servidor clonava o commit e **construía as duas imagens na própria VPS** (`pull_policy: build`), o que causou as falhas do item 2 de [[operacao/problemas-atuais]].

## 6. De onde vem cada número do painel
| Número | Origem | Situação em 2026-10-19 |
|---|---|---|
| Investimento total, CPA, ROAS | `custos` (manual ou Meta Ads) | vazio: nenhuma conta do Meta conectada e nenhum gasto lançado |
| Base contatada | webhook `clique` com `base=true` ou fonte de envio | 0: nenhuma fonte |
| Cliques | webhook `clique` | 0: nenhuma fonte (a sincronização do Meta traz só o gasto) |
| Visitas ao site | Tag do GTM (`cv: 1`) ou webhook `visita` | **funcionando**: 69 visitas no canal Meta pela Tag |
| Cadastros, FTDs, valor do FTD, depósitos | webhooks da plataforma | 0: nenhuma fonte de webhook criada em produção |
| Canal | classificador da regra ou UTM do toque | Meta (pelas UTMs das visitas) |

Por isso o painel mostra só as visitas: o resto depende das fontes de webhook e da conta do Meta Ads, que ainda não foram configuradas em produção. Ver [[operacao/problemas-atuais]].

## 7. Segurança e isolamento
- Toda tabela de dados tem `tenant_id` com RLS forçado; a app conecta como `app_user`, sem BYPASSRLS ([[arquitetura/modelo-de-dados]]).
- Segredos gerados no servidor, nunca digitados nem versionados; segredos de fonte e tokens do Meta cifrados com `WEBHOOK_CHAVE_CIFRA`.
- Web e API escutam só em `127.0.0.1`; quem vem de fora passa pela Cloudflare.
- CORS da API só para `https://kapanda.lat`; rate-limit por visitante (login 10/min, Tag 120/min).
- Repositório público: nenhum segredo nem o e-mail do admin no código, na wiki ou no log ([[operacao/ambiente-e-seguranca]]).

Relacionado: [[operacao/producao]], [[operacao/problemas-atuais]], [[operacao/deploy-kapanda]], [[decisoes-tecnicas/decisoes]] (D39, D40, D41).
