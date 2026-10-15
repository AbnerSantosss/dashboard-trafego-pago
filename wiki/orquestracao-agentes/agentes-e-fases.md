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
| Banco de Dados | `apps/api/db/`, migrações, seed | P2.1 schema, P2.2 RLS, P2.3 migrações, P2.4 seed demo |
| Ingestão | `apps/api/src/webhooks/`, `webhook-sim/` | P3.1 endpoint, P3.2 simulador, P3.3 fila, P3.4 isolamento (G2) |
| Regras | `packages/rules/`, `apps/api/src/rules/` | P3.5 motor, P3.6 classificador, P3.7 reprocessamento |
| Frontend | `apps/web/` (dashboard) | P4.1 a P4.6 componentes React, GSAP, API de métricas |
| Administração | `apps/web/app/(admin)/`, `apps/api/src/admin/` | P5.1 webhooks, P5.2 regras, P5.3 usuários, P5.4 apresentação (logo/nome) |
| QA | `tests/`, `.github/workflows/` | P6.1 unit, P6.2 e2e duas empresas (G3), P6.3 regressão visual, P7.x docs e aprovação (G4) |

## Fases (dias)
| Fase | Dias | Entrega | Gate |
|---|---|---|---|
| 0 Fundação | 0–1 | wiki, repo, monorepo, tooling | G0 |
| 1 Design e protótipo | 1–4 | tokens, componentes, fixtures, protótipo fiel | G1 |
| 2 Dados | 3–6 | schema, RLS, migrações, seed | — |
| 3 Ingestão e regras | 5–10 | webhooks, fila, motor, classificador | G2 |
| 4 Dashboard React | 8–14 | tela Visão Geral conectada à API | — |
| 5 Administração | 12–17 | webhooks, regras, usuários, apresentação | — |
| 6 QA | 15–19 | unit, e2e, regressão visual | G3 |
| 7 Entrega | 19–20 | docs, runbooks, aprovação | G4 |

## Regras de despacho
- Brief de cada subagente: objetivo, arquivos permitidos, página da wiki a ler, critério de pronto, proibições (segredos, Hyperframes runtime, chamadas pagas).
- Dois agentes nunca escrevem nos mesmos arquivos ao mesmo tempo; integração por PR revisado pelo orquestrador.
- Toda entrega relevante atualiza a wiki ([[log]]) via orquestrador.
- Chamadas pagas (geração de imagem, deploy) só com confirmação do usuário.
