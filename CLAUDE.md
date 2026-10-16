# Dashboard de Tráfego Pago Multiempresa (PASIO)

## Leitura automática da wiki
- No início de toda sessão, leia `wiki/index.md` e as últimas 30 linhas de `wiki/log.md`.
- Para retomar o trabalho, leia `wiki/operacao/retomada.md` (estado, CI e próximos passos em ordem) e mantenha essa página atualizada ao fim de cada sessão.
- Antes de mexer em uma área, leia a página da categoria correspondente em `wiki/`.
- Ao concluir trabalho relevante, registre em `wiki/log.md` (`## [AAAA-MM-DD] <tipo> | <resumo>`) e atualize a página afetada. Decisões vão em `wiki/decisoes-tecnicas/decisoes.md`.
- Convenções da wiki: frontmatter YAML (`tipo`, `atualizado`, `tags`), kebab-case sem acento, links `[[nome]]`.

## Documento-mestre
`PLANO-DE-ACAO.md` (41 tarefas, 8 fases, 10 agentes, gates G0–G4). Painel do plano: https://claude.ai/artifact/KcEDCoT1Qws3MjLLHMFgY6

## Regras do projeto
- Idioma: respostas, wiki, commits e comentários em português do Brasil.
- Fidelidade visual à imagem de referência é o critério número um (diff ≤ 2% a 1315 px). Ver `wiki/qa-visual/fidelidade-visual.md`.
- Stack aprovada: pnpm monorepo, Next.js 15 + TS + Tailwind, Fastify, PostgreSQL + Drizzle com RLS por `tenant_id`, pg-boss, d3, GSAP, Auth.js, Vitest/Playwright/pixelmatch.
- Primeira empresa: PASIO. Logo padrão em `packages/design/brand/pasio-logo.png`; ícone e nome exibido são trocáveis em Configurações → Apresentação.
- Um escritor por conjunto de arquivos: subagentes só escrevem na área definida em `wiki/orquestracao-agentes/agentes-e-fases.md`.
- Chamadas pagas (geração de imagem, deploy) só com confirmação explícita do usuário. Ícones: SVG primeiro.

## Hyperframes (só referência)
Doutrina de animação e catálogo de blocos em `C:\Users\binho\Documents\Projetos de IA\Obsidian\Especialistas\18 - Hyperframes\wiki\`. Nunca rode `hyperframes init/publish/cloud/lambda` neste projeto; não modifique aquela wiki.

## Segredos
Nenhuma chave de API (OpenRouter, kie.ai, muapi, banco) entra em código, wiki, log, commit ou artifact. Use variáveis de ambiente e `.env.example` sem valores.

## Registro de sessão
Os hooks gravam o registro bruto em `registro/sessoes/`. Antes de cada trabalho, acrescente ali `- Entrega esperada: …`; o `wiki/log.md` continua obrigatório para entregas relevantes.
