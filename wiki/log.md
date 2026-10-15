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
