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
