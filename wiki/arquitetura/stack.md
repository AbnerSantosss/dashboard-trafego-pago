---
tipo: arquitetura
atualizado: 2026-10-19
tags: [stack, nextjs, fastify, postgresql, pnpm, d3, movimento, docker, producao]
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
| Animação | CSS + `requestAnimationFrame` (GSAP sem uso desde D29) | Entrada em cascata em CSS, contadores e funil por rAF, só `transform`/`opacity`/`clip-path`, desligado em reduced-motion |
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
packages/contratos  tipos compartilhados API↔web (contrato de /metricas/visao-geral)
packages/graficos   Funil (d3), Sparkline e Contador (CSS + rAF, D29), SSR-safe, prefers-reduced-motion
prototype/          protótipo estático pixel-fiel (Fase 1)
wiki/               esta wiki
```

## Ferramentas no ambiente (2026-10-15)
Node v24.19.0, git 2.55 e pnpm 12.11.2 (instalado por `npm i -g --allow-scripts=pnpm pnpm`; o corepack falhou por permissão em Program Files). Versões resolvidas: Next 15.5.28, React 19, Tailwind 4, Fastify 5, TypeScript 5.9, ESLint 9.39, Vitest 3.2. Rodar pnpm pelo PowerShell (o shim do Git Bash quebra o caminho). Scripts de build de dependências precisam de `allowBuilds` em `pnpm-workspace.yaml`.

## Postgres local (2026-10-15)
`docker compose up -d db` sobe Postgres 16 em **127.0.0.1:5460** (a 5432 e vizinhas já estão ocupadas por outros projetos nesta máquina). `DATABASE_URL` padrão em `.env.example`. A aplicação conecta como papel sem `BYPASSRLS`; migrações usam a URL de admin. Ver [[arquitetura/modelo-de-dados]].

## Produção (2026-10-16, D39)
- **Imagens**: um `Dockerfile` com dois alvos sobre `node:24-alpine` (Node 24 pelo `crypto.argon2`). O store do pnpm vem só do lockfile (`pnpm fetch`) e cada alvo instala filtrado pela sua app. Cerca de 1,3 GB por imagem, porque levam devDependencies.
- **API**: roda com `tsx` (`node --import tsx`), sem compilar, porque os pacotes internos exportam a fonte TypeScript. Antes do servidor, `src/segredos-do-servidor.ts` lê os segredos e `src/db/producao.ts` prepara o banco.
- **Web**: `next build` na imagem e `next start` na porta 3000; fala com a API pela rede interna (`API_URL=http://api:3001`).
- **Compose**: `docker-compose.prod.yml` com `segredos` (gera as senhas e sai), `db` (Postgres 16), `api` e `web`. Web e API só em `127.0.0.1`; o túnel Cloudflare do host publica os dois. Sem Redis e sem cloudflared na stack.
- **Build e registro (desde 2026-10-19, D41)**: as imagens `api` e `web` são construídas no GitHub Actions (workflow `.github/workflows/deploy.yml`) e publicadas no GHCR (`ghcr.io/abnersantosss/dashboard-trafego-pago/{api,web}`, tags `latest` e `sha-xxxxxxx`). O compose de produção só as baixa (`pull_policy: always`); a VPS não compila mais.
- Onde está, endereços e como atualizar: [[operacao/producao]].
