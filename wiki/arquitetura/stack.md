---
tipo: arquitetura
atualizado: 2026-10-15
tags: [stack, nextjs, fastify, postgresql, pnpm, d3, gsap]
---

# Stack

Aprovada pelo usuário em 2026-10-15 (alternativa Python FastAPI descartada).

| Camada | Escolha | Motivo |
|---|---|---|
| Monorepo | pnpm workspaces | Um escritor por pacote; agentes com áreas exclusivas |
| Web | Next.js 15, React, TypeScript estrito, Tailwind | Rotas, SSR para primeira pintura rápida, tokens via CSS vars |
| API | Node + Fastify | Webhooks de alta vazão, schema de validação, OpenAPI |
| Banco | PostgreSQL + Drizzle ORM | RLS nativa por `tenant_id`, jsonb para payload bruto |
| Fila | pg-boss | Sem Redis no início; BullMQ/Redis se a carga exigir |
| Gráficos | d3 v7 | Funil trapezoidal, sparklines |
| Animação | GSAP | Contadores, entrada em cascata, seek-safe, reduced-motion |
| Auth | Auth.js | Papéis por empresa: admin, analista, leitor |
| Testes | Vitest, Playwright, pixelmatch | Unitário, e2e, regressão visual |
| Lint/format | ESLint, Prettier | Padrão em todos os pacotes |

## Estrutura do repositório
```
apps/web            Next.js (dashboard e administração)
apps/api            Fastify (webhooks, métricas, admin)
packages/design     tokens.css, tokens.json, ícones SVG, marca (logo PASIO)
packages/rules      motor de regras (mapeamento, classificador)
packages/fixtures   dados exatos da imagem de referência
prototype/          protótipo estático pixel-fiel (Fase 1)
wiki/               esta wiki
```

## Ferramentas no ambiente (2026-10-15)
Node v24.19.0, git 2.55 e pnpm 12.11.2 (instalado por `npm i -g --allow-scripts=pnpm pnpm`; o corepack falhou por permissão em Program Files). Versões resolvidas: Next 15.5.28, React 19, Tailwind 4, Fastify 5, TypeScript 5.9, ESLint 9.39, Vitest 3.2. Rodar pnpm pelo PowerShell (o shim do Git Bash quebra o caminho). Scripts de build de dependências precisam de `allowBuilds` em `pnpm-workspace.yaml`.
