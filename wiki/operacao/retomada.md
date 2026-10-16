---
tipo: retomada
atualizado: 2026-10-16
tags: [retomada, estado-atual, proximos-passos, ci, operacao]
---

# Retomada: comece por aqui

Página para quem abre o projeto depois de uma pausa. Diz onde o trabalho parou, o que está pendente e em que ordem. Atualize ao fim de cada sessão de trabalho relevante.

## Onde paramos (2026-10-16, fim do dia)
- **Deploy (P7.2) no ar** em `https://pasio.proxserverabner.site` (API em `https://pasio-api.proxserverabner.site`). Stack `trafego-pasio` no Portainer, rotas no túnel `servidor-abner`. Falta: o usuário definir a senha do admin pelo link do log (se passar de 1 hora, reiniciar o contêiner `trafego-pasio-api-1` gera outro), entrar e configurar a Tag do GTM, os webhooks e o Meta Ads com os endereços públicos. Atualizar: Portainer → stack → Pull and redeploy. Backup: volumes `trafego-pasio_pgdata` e `trafego-pasio_segredos`, juntos.
- **Histórico do deploy** (D39 em [[decisoes-tecnicas/decisoes]], passo a passo em [[operacao/runbooks]], seção Produção):
  - arquivos novos: `Dockerfile`, `.dockerignore`, `docker-compose.prod.yml`, `deploy/producao.env.example`, `apps/api/src/db/producao.ts`, `segredos-do-servidor.ts` e os testes de ambos;
  - os segredos são gerados no próprio servidor (serviço `segredos`): ninguém cola senha no Portainer. O backup leva os volumes `pgdata` **e** `segredos`;
  - mudanças: `/health` sem log por requisição, rate-limit pelo `cf-connecting-ip` (API) com repasse no web (`lib/api.ts`), aviso de tabela vazia abaixo do Total;
  - stack completa validada localmente (projeto `trafego-prod-teste`, já derrubado com o volume);
  - feito: `ce3703a` e `e71438c` com CI verde (run 38913876520); stack criada pelo Git (primeiro build em cerca de 4,5 minutos); rotas `pasio` e `pasio-api` (`painel` já estava em uso). O e-mail do admin está só na variável `ADMIN_EMAIL` da stack;
  - o próprio Portainer pede `pull_policy: build` para reconstruir no "Pull and redeploy", e o compose já o tem.
- **D38 no GitHub**: `cf22150` (código) e `dc325ae` (wiki), CI verde nos dois jobs (run 38905350545). painel e Configurações sem o pequeno scroll (moldura de 735 px fora da janela do diff; conteúdo de Configurações e Leads sem a ampliação do zoom), sidebar com Configurações abaixo de Relatórios, conta no fim e sem Ajuda (página `/ajuda` apagada), formulários menores numa folha translúcida e Perfil em duas colunas. Web: 71 testes; diff 5,193%.
- **D34 a D37 commitados e no GitHub**: `64c95a4` (código) e `752c4dc` (wiki), CI verde nos dois jobs (run 38895390480). Fora do commit, de propósito: `apps/web/tsconfig.tsbuildinfo` e `.impeccable/` (locais). As notas "sem commit" abaixo ficam como histórico.
- **D37, sem commit**: fundo de ondas em SVG em Relatórios e Ajuda (GSAP sob demanda, para em cerca de 86 s), medido a 61 quadros por segundo. Arquivos novos: `apps/web/componentes/FundoOndas.tsx`, `apps/web/componentes/fundo-ondas.ts` e `apps/web/testes/fundo-ondas.test.ts`. Web: 71 testes; diff 5,198%. Configurações → Gastos (destino de Gestão de Custos) mantém as engrenagens, por decisão do usuário.
- **D36, sem commit**: login em vidro com título pela primeira visita (`ja_entrou`), senha em Argon2id, JWT com `sv` e "lembrar de mim" (30 dias), avatar da sidebar levando ao Perfil. Arquivos novos: `apps/api/src/conta/senha.test.ts` e os SVGs `email`, `cadeado`, `olho`, `olho-fechado`, `seguir` de `packages/design/icons/`. Exige Node ≥ 24.7 (o CI usa 24). Os testes `seed.test` e `metricas.test` falham só localmente por causa dos dados de `db:ficticio`; rode `pnpm --filter @trafego/api db:ficticio --remover` antes da suíte completa.
- **D35, sem commit**:
  - tutoriais animados em balão (GSAP no contrato Hyperframes) em Gastos, Meta Ads, Tag, Webhooks e Instalação;
  - conta e botão Sair no rodapé da sidebar;
  - gaveta do funil com 10 itens e "Ver todos";
  - fundos em WebP no login, em nova senha e convite, e em Configurações.

  Diff como no CI: 5,198%. Web: 67 testes.

  No commit, incluir os arquivos novos `Tutorial.tsx`, `tutoriais.tsx`, `linha-do-tempo.ts`, `tutorial.css`, `app/(conta)/FundoConta.tsx`, `apps/web/public/fundos/`, `apps/api/src/db/ficticio.ts` e `packages/design/icons/sair.svg`.

  Falta conferir com sessão real o clique em Sair e olhar os fundos na largura do celular.

  Dados fictícios no banco local: `pnpm --filter @trafego/api db:ficticio --remover` apaga tudo o que o script gravou. O gasto `ceqw` foi lançado pelo usuário e não deve ser apagado.
- **D34, sem commit**: funil com neon no hover e clique que abre a lista da etapa e a ficha do usuário (rotas `/empresas/atual/eventos` e `/empresas/atual/leads/:leadKey`, gaveta `GavetaFunil.tsx`, amostra `demo-*` no seed). Diff 5,357%. Testes: API 183 + 1 pulado, web 56, gráficos 21. No commit, incluir os arquivos novos: `apps/api/src/leads/`, `apps/api/src/db/seed/pessoas.ts`, `packages/contratos/src/leads.ts`, `apps/web/app/acoes-funil.ts`, `apps/web/componentes/GavetaFunil.tsx`, `gaveta-funil.css`, `testes/gaveta-funil.test.tsx` e os SVGs novos de `packages/design/icons/`.
- **D33, sem commit**: Configurações na moldura e na escala do painel no desktop, transição de entrada por aba, hover no funil e Instalação com submenu (Tag do GTM, Webhooks e Meta Ads, cada um com passo a passo). Diff 5,419% (inalterado).
- **Gasto em anúncios (D31), sem commit**: abas Configurações → Gastos (lançamento manual) e Meta Ads (conectar conta com token). Falta o usuário gerar o token no Meta e conectar a conta real. Migração 0006 já aplicada no banco local. Testes: API 178 + 1 pulado, web 51.
- **Rodada de UX sem commit**: no disco, fora do git (ver o log "revisão impeccable, responsividade, aba Instalação e movimento" e as decisões D22 a D30 em [[decisoes-tecnicas/decisoes]]):
  - aba **Instalação** com 7 passos;
  - Configurações fluidas e responsivas;
  - diálogo de confirmação nas ações destrutivas;
  - acessibilidade do dashboard;
  - animações de entrada e contagem.

  Antes do commit, falta só a conferência no navegador (passo 2); o diff visual como no CI já passou (passo 1).
- Local: `pnpm lint`, `pnpm typecheck` e `pnpm test` verdes, com 280 testes passando e 1 pulado. Diff visual medido como o CI (build de produção com `WEB_MOCK_API=1`): **5,19%**, igual ao de antes da rodada. Contra o `next dev` com a API real dá 5,419%; essa diferença vem do modo de medir, não do código ([[qa-visual/fidelidade-visual]]).
- Relatório da revisão de UX (impeccable, dual-agent, 20/40 antes das correções e cerca de 28/40 estimado depois): `.impeccable/critique/2026-10-16T07-32-12Z__apps-web.md`, fora do git. Decidir se `.impeccable/critique/` entra no repositório. A pasta `.impeccable/live/` é descartável.
- **Direção sugerida, aguardando decisão do usuário**: parar de adicionar funcionalidades e ir direto para o deploy (Fase 7), para o painel ser usado de verdade; o resto entra só se fizer falta no uso. Motivo: o pedido original era "receber webhooks e transformar em dados no painel", e o plano de 41 tarefas mais os pedidos novos (usuários, convites, login, tag GTM) tornaram o projeto um produto completo. O que importa para o usuário já funciona localmente: tela igual à imagem com dados reais, webhooks virando métricas e Configurações.
- Fases 1 a 6 concluídas e enviadas para `main` em `github.com/AbnerSantosss/dashboard-trafego-pago` (repositório **público**, ver [[operacao/ambiente-e-seguranca]]).
  - `a567b2b`: Fase 6 (CI, e2e de isolamento G3, item Configurações na sidebar).
  - `5216d62`: Configurações (perfil, usuários e convites, login, tag GTM e cruzamento com o webhook). Detalhes em [[administracao-multiempresa/configuracao-por-empresa]] e nas decisões D19 a D21 de [[decisoes-tecnicas/decisoes]].
- Fora do git, de propósito: `apps/api/.env.local` (credenciais SMTP de teste) e `registro/`. O `apps/web/tsconfig.tsbuildinfo` aparece como modificado e não deve ser commitado (é gerado).

## CI: estado
O workflow `.github/workflows/ci.yml` tem dois jobs, e os dois estão **verdes** desde o commit `817bc01` (run 38856270127, 2026-10-16); continuam verdes no `752c4dc` (run 38895390480, D34 a D37) e no `dc325ae` (run 38905350545, D38). Aviso do GitHub: as actions `@v4` rodam em Node 20, que está obsoleto (forçadas para Node 24), e `ubuntu-latest` passa para Ubuntu 26 a partir de 2026-10-19; vale atualizar as versões das actions.
- **check** (ubuntu: lint, formato, tipos, testes com banco, build): passou.
- **visual** (windows: diff contra `ref-1.png`, limite 5,5%, `WEB_MOCK_API=1`): passou com **5,19%** (local mede 5,16%). Regiões que mais divergem: kpis 7,4%, cabeçalho 7,0%, funil 5,8%.
- O que foi consertado: nos runs de `5216d62` e `a59517f` o visual falhava com `ERR_CONNECTION_REFUSED` em `localhost:3000`, porque o `next start` iniciado com `Start-Process` morria ao fim do passo. Agora um único passo ("Sobe o web com a fixture e compara com a referência") sobe o servidor, espera o 200, roda `pnpm qa:visual`, imprime `web.log` se o diff falhar e encerra o servidor.
- Para conferir: `gh run list` e, se falhar, `gh run view <id> --log-failed`. O artefato `diff-visual` do run traz `atual.png` e `diff.png`.

## Próximos passos, em ordem
1. ~~Diff visual como no CI~~ **feito em 2026-10-16**: build de produção com `WEB_MOCK_API=1` + `next start` + `pnpm qa:visual --limite 5.5` → **5,19%, aprovado**, mesmo valor de antes das mudanças (nenhum pixel do estado final mudou).
2. **Conferir no navegador** (o diálogo de "Gerar segredo" já foi conferido: abre com foco em Cancelar e Esc fecha sem enviar):
   - o diálogo nas demais ações (remover membro, cancelar convite, remover logo) e o clique no fundo;
   - as abas Perfil e Tag GTM, no celular e no desktop;
   - a aba Instalação com a API fora do ar: deve aparecer "Não foi possível conferir agora." e nenhum passo concluído.
3. **Commit**: só quando o usuário pedir.
   - Não incluir `apps/web/tsconfig.tsbuildinfo`.
   - Antes, varrer segredos (o repositório é público) e conferir que `.env.local` e `registro/` seguem ignorados.
   - Arquivos novos a incluir: `Confirmar.tsx`, a pasta `instalacao/`, `lib/instalacao.ts` e os testes `em-construcao`, `instalacao` e `painel-acessibilidade`.
4. **Pequenos ajustes deixados pelos agentes** (sem pressa):
   - ~~**Link fora da região principal** em `/ajuda`~~: resolvido em 2026-10-16, a página saiu (D38).
   - **`pnpm format` falhando localmente**: falha só por `.claude/settings.local.json` e `.impeccable/hook.cache.json`, ambos ignorados pelo git. A saída é acrescentá-los ao `.prettierignore`.
   - **`icons/index.ts` gerado**: `packages/design/icons/index.ts` é gerado. Ou o `gerar-icones.mjs` passa a rodar o prettier no fim, ou o arquivo entra no `.prettierignore`.
   - **Lint de acessibilidade**: o lint não tem `jsx-a11y` nem `@next/eslint-plugin-next`. Adicionar exige dependência nova, que só entra com aval do usuário.
   - **GSAP sem uso**: `criarTimelineCascata` (GSAP) ficou sem uso em `@trafego/graficos`. Decidir se o `gsap` sai das dependências.
   - **Animação em produção**: o estado final em produção já foi medido (5,19%); falta só olhar a animação rodando num build de produção. Em produção não há a montagem dupla do StrictMode.
   - **Rotação de segredo sem carência**: o segredo antigo para de valer no clique ([[operacao/runbooks]]). Melhoria possível: dois segredos válidos por um período.
   - **Resíduos da revisão de UX**:
     - o dashboard ainda rola na horizontal abaixo de 1315 px;
     - o login não tem marca;
     - a ordenação da tabela não fica na URL;
     - a diferença entre funil e KPI (499 contra 995 FTDs) não tem explicação na tela.

     Detalhes no relatório do impeccable.
   - **`/impeccable init`**: ainda não há `PRODUCT.md`/`DESIGN.md`; rodar só se o usuário quiser fixar o contexto de design.
5. **Segurança de conta**: trocar a senha de app do Gmail usada no teste de e-mail; em produção, as credenciais SMTP vão só nas variáveis do Portainer.
6. **Testar o login real**: em Configurações → Usuários, convidar um e-mail de verdade, aceitar o convite pelo link e entrar. O admin do seed (`admin@pasio.local`) não recebe e-mail; em dev, sem cookie, o painel continua como admin demo (`sessao-dev`).
7. **Fase 7 — Entrega** (ver `PLANO-DE-ACAO.md`). A aba Instalação é o roteiro de colocar uma empresa no ar.
   - P7.1 wiki essencial (como rodar, cadastrar empresa e webhook, runbook de deploy).
   - P7.2 deploy: arquivos prontos (D39). A stack do Portainer tem web, api e postgres; o cloudflared é o do host. Segredos só nas variáveis da stack; `WEBHOOK_URL_PUBLICA` é a origem pública da API (sem ela a tag GTM só funciona na máquina local). **Deploy só com confirmação explícita do usuário.**
   - P7.3 entrega final e **Gate G4**: o usuário aprova a fidelidade na tela real.
8. ~~Pendência visual da Fase 5: a tabela de fontes cortava a coluna de ações em larguras estreitas.~~ Resolvida em 2026-10-16: abaixo de 48em, as tabelas das Configurações viram cartões (D23).

## Como subir local
Detalhes em [[operacao/runbooks]] (seção Ambiente local). Resumo do que foi usado nesta fase:
- Postgres pelo `docker compose up -d`, exposto em `127.0.0.1:5460` (banco `trafego`; `app_user` para a API com RLS, `postgres` para migrações).
- API: em `apps/api`, `API_PORT=3011` (a 3001 costuma estar ocupada na máquina), `WEB_URL=http://localhost:3000`, `DATABASE_URL` do `.env.example` e um `AUTH_SECRET` local qualquer com 32+ caracteres; `npx tsx src/server.ts`. O SMTP é lido de `apps/api/.env.local`.
- Web: em `apps/web`, `API_URL=http://localhost:3011` e o mesmo `AUTH_SECRET`; `npx next dev -p 3000`.
- Abas: `/configuracoes/instalacao`, `/configuracoes/perfil`, `/configuracoes/usuarios`, `/configuracoes/tag`, `/configuracoes/webhooks`, `/configuracoes/apresentacao`; login em `/login`.

## Armadilhas desta fase
- Parar o shell da API não mata o `tsx`: o processo node órfão continua segurando a porta 3011. Encerre o processo dono da porta antes de subir de novo.
- Não rode `next build` com o `next dev` aberto: os dois usam `apps/web/.next`.
- O `pnpm check` inclui `pnpm build`; com o dev rodando, use `pnpm lint && pnpm format && pnpm typecheck && pnpm test`.
- Os arquivos gerados pelo drizzle (`apps/api/drizzle/meta/*.json`) saem fora do padrão do prettier: rode `prettier --write` neles depois de `db:generate`.
- O `npx tsc --noEmit -p apps/web` regrava o `tsconfig.tsbuildinfo`; guarde uma cópia antes e restaure depois, se não quiser o arquivo no diff.
- Movimento no dashboard: qualquer animação nova tem de ficar dentro de `@media (prefers-reduced-motion: no-preference)` e terminar no estado do SSR, senão o diff do CI muda (D29).
- Antes de cada push: varredura de segredos (o repositório é público) e conferir que `.env.local` e `registro/` seguem ignorados.

Relacionado: [[log]], [[operacao/ambiente-e-seguranca]], [[orquestracao-agentes/agentes-e-fases]].
