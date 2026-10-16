---
tipo: processo
atualizado: 2026-10-15
tags: [orquestracao, agentes, fases, gates, opus]
---

# Agentes e fases

Orquestrador (esta sessão) despacha subagentes Opus 5.5 em modo Auto, um por especialidade, cada um escrevendo só na sua área ([[decisoes-tecnicas/decisoes]] D7). Fonte completa: `PLANO-DE-ACAO.md` seções 2 a 4 e dataset `agentes`/`fases` do artifact do plano.

## Agentes e áreas exclusivas
| Agente | Área de escrita | Tarefas |
|---|---|---|
| Orquestrador | `wiki/`, `CLAUDE.md`, `PLANO-DE-ACAO.md`, revisão de PRs | P0.0, P0.2, P0.3, gates |
| Design System | `packages/design/`, `design/` | P1.1 tokens, P1.2 componentes, P1.4 ícones SVG |
| Protótipo Visual | `prototype/` | P1.5 protótipo estático, P1.6 diff ≤ 2% |
| Fixtures | `packages/fixtures/` | P1.3 dados exatos da imagem |
| Banco de Dados | `apps/api/src/db/`, `apps/api/drizzle/` (migrações), `drizzle.config.ts`, `docker-compose.yml`, scripts de `apps/api/package.json` | P2.1 schema + RLS + migrações, P2.4 seed demo |
| Ingestão (backend) | `apps/api/src/` exceto `src/db/` e `src/rules/`, `packages/webhook-sim/` | P2.2 auth e papéis, P2.3 API base, P3.1 endpoint, P3.2 fila, P3.6 simulador e reprocessamento, teste G2 |
| Regras | `packages/rules/`, `apps/api/src/rules/` | P3.3 motor, P3.4 classificador, P3.5 agregação e processador (`processarWebhookEvent`, `reprocessarFonte`) |
| Frontend | `apps/web/` (dashboard), seção `# Web` do `.env.example` | P4.1, P4.2, P4.5, P4.6, P4.7, parte web de P4.8 |
| Gráficos | `packages/graficos/` | P4.3 funil d3, P4.4 sparklines e contadores GSAP |
| Métricas (backend) | `apps/api/src/metricas/`, `apps/api/src/rotas/metricas.ts`, `auth.ts` (sessão dev) | P4.8 `GET /metricas/visao-geral`, `POST /auth/sessao-dev` |
| Contratos | `packages/contratos/` (orquestrador) | tipos compartilhados API↔web (`VisaoGeralResposta`) |
| Administração | `apps/web/app/(admin)/`, `apps/api/src/admin/` | P5.1 apresentação (nome/logo), P5.2 webhooks (segredo) — escopo enxuto, D15 |
| QA | `tests/`, `.github/workflows/` | P6.1 pnpm check + diff visual no CI, P6.2 e2e duas empresas (G3), P7.x docs essenciais, deploy e aprovação (G4) — escopo enxuto, D15 |

## Fases (dias)
| Fase | Dias | Entrega | Gate |
|---|---|---|---|
| 0 Fundação | 0–1 | wiki, repo, monorepo, tooling | G0 |
| 1 Design e protótipo | 1–4 | tokens, componentes, fixtures, protótipo fiel | G1 |
| 2 Dados | 3–6 | schema, RLS, migrações, seed | — |
| 3 Ingestão e regras | 5–10 | webhooks, fila, motor, classificador | G2 |
| 4 Dashboard React | 8–14 | tela Visão Geral conectada à API (concluída 2026-10-15) | — |
| 5 Administração (enxuta, D15) | 12–14 | apresentação (nome/logo), webhooks (segredo) (concluída 2026-10-15) | — |
| 6 QA (enxuta, D15) | 14–15 | pnpm check + diff visual no CI, e2e isolamento | G3 |
| 7 Entrega | 15–17 | wiki essencial, Portainer + túnel, aprovação | G4 |

## Regras de despacho
- Brief de cada subagente: objetivo, arquivos permitidos, página da wiki a ler, critério de pronto, proibições (segredos, Hyperframes runtime, chamadas pagas).
- Dois agentes nunca escrevem nos mesmos arquivos ao mesmo tempo; integração por PR revisado pelo orquestrador.
- Toda entrega relevante atualiza a wiki ([[log]]) via orquestrador.
- Chamadas pagas (geração de imagem, deploy) só com confirmação do usuário.
