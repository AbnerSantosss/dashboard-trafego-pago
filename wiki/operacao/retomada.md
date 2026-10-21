---
tipo: retomada
atualizado: 2026-10-21
tags: [retomada, redeposito, funil, tunel, estado-atual, proximos-passos, ci, operacao, deploy, ghcr, smtp, gtech, webhooks, basic, preset]
---

# Retomada: comece por aqui

Página para quem abre o projeto depois de uma pausa. Diz onde o trabalho parou, o que está pendente e em que ordem. Atualize ao fim de cada sessão de trabalho relevante.

## Onde paramos (2026-10-21, por volta das 12:10)
Sessão `b14f19c8`, continuação.
- **Commit `d5569d9` na `main`, push feito**: etapa Redepósito no funil (D43), pacote de segurança (D44) e verificação em duas etapas opcional no Perfil (D45). CI run 39619390201 verde (check e visual) e Deploy run 39619390107 verde (imagens `api` e `web` no GHCR; o job de redeploy só avisou, sem `PORTAINER_WEBHOOK_URL`).
- **Redeploy em produção NÃO aconteceu.** O "Pull and redeploy" com re-pull falhou três vezes (11:50, 11:57 e 12:00) com `no space left on device` ao extrair as camadas da imagem: **o disco do servidor está cheio**. Os contêineres seguem os de 2026-10-20 14:40 e a produção está na versão antiga (`/auth/duas-etapas` 404, `/docs` 200, sem HSTS). A mensagem só aparece no console do navegador; a lista de Notifications do Portainer não mostrou nada.
- **Espaço a liberar** (Portainer → Images, todas marcadas Unused e todas deste projeto): `sha256:15aaf5a4…` (1,4 GB, web antiga do GHCR de 19/10), `sha256:10eaa1f6…` (1,2 GB, api antiga do GHCR de 19/10), `trafego-pasio-api:latest` (1,2 GB) e `trafego-pasio-web:latest` (1,4 GB), dos builds locais antes do D41. Cerca de 5,2 GB. Não apagar a `ghcr.io/.../web:latest` de 2026-10-21 11:45 (é a nova, já baixada). A remoção pelo agente foi barrada pelo classificador de permissões; fica com o usuário.
- Depois de liberar: Pull and redeploy com re-pull e validar (ver passo 2 abaixo).

### Próximos passos, em ordem
1. (usuário) Portainer → Images → marcar as 4 imagens acima → Remove.
2. (agente ou usuário) Stack `trafego-pasio` → Pull and redeploy → ligar "Re-pull image and redeploy" → Update. Validar: `https://api.kapanda.lat/health` com `strict-transport-security`, `/docs` 404, `POST /auth/duas-etapas` com desafio inválido → 401 `token_invalido`, `https://kapanda.lat/login/codigo` 200, CSP no web e horário novo dos contêineres. As migrações 0007 e 0008 aplicam sozinhas na subida.
3. (usuário, opcional) Ver o espaço livre do disco da VPS; outras imagens grandes no servidor não são deste projeto (n8n 2,5 GB, hermes-agent 4,5 GB, evolution-api 1,8 GB).
4. Teste de SMTP no console do `trafego-pasio-api-1` e convite real ([[operacao/producao]], "E-mail (SMTP)").
5. Seguem os passos da GTech da lista abaixo (segredo nos dois webhooks, jogador de teste, senha do backoffice).

## Antes (2026-10-21, madrugada)
Sessão `b14f19c8`. Nada foi commitado nem deployado; nenhum arquivo de código foi alterado.
- **Túnel fora e de volta.** No começo da sessão `kapanda.lat` deu Erro 1033 da Cloudflare e todos os hosts do túnel `servidor-abner` responderam 530 (kapanda.lat, api.kapanda.lat, pasio.proxserverabner.site, portainer.proxserverabner.site). Era a internet do servidor; quando voltou, `kapanda.lat/login` e `api.kapanda.lat/health` responderam 200 sem nenhuma ação na stack. Registro em [[operacao/problemas-atuais]], item 12.
- **Projeto rodado local** enquanto o túnel estava fora (passo a passo em [[operacao/runbooks]], "Ambiente local"). Causa do item 11 de [[operacao/problemas-atuais]] encontrada: o Docker Desktop reinicia sozinho e o contêiner do banco tem `restart=no`. O local foi parado quando a produção voltou.
- **GTech: webhooks ainda não salvos.** O modal "Criação de usuário" do backoffice (latam.gtech.uy/admin → Personalizar → Webhook) foi aberto e preenchido de novo: Nome `kapanda`, Ativo, URL `https://api.kapanda.lat/webhooks/pasio/gtech`, BASIC, Usuário `gtech`, Senha vazia (o autofill do Chrome pôs o login de admin outra vez e foi corrigido). Na última conferência não havia card `kapanda` na seção, só o `login` que aponta para webhook.site (não mexer). "Pagamento de Depósito" está vazia. A rotação do segredo da fonte em Configurações → Webhooks não foi confirmada pelo usuário.
- **Pedido novo: etapa "Redepósito" no Funil de Aquisição** (só no funil, abaixo de FTD). Análise feita, implementação **não começou**. Proposta abaixo.

### Proposta do Redepósito (a confirmar no código, vira D43 quando implementada)
- **O dado já existe.** O preset `gtech` grava o primeiro depósito pago como `ftd` e os seguintes como `deposito` (`packages/rules/src/presets/gtech.ts`). `metrics_daily` não guarda a contagem de redepósitos, só o valor somado em `depositos`.
- **Métrica**: quantidade de eventos `deposito` no período, contada em `events` (dia no fuso da empresa, mesmos filtros de canal e campanha, sem canais `__`). É a mesma lista que a gaveta mostra ao clicar na etapa. Taxa = redepósitos / FTDs, e pode passar de 100%.
- **Quando aparece**: só se a empresa tiver ao menos um evento `deposito`, e nunca quando o funil vem do canal reservado da demo (D11). Assim a fixture e o demo seguem com 5 etapas e o diff visual do CI não muda.
- **Passos**:
  1. Contratos: `'redeposito'` em `EtapaFunilId` (`packages/contratos/src/metricas.ts`) e em `ETAPAS_LISTA` (`leads.ts`).
  2. API: contagem em `apps/api/src/metricas/consulta.ts`, etapa nova em `calculo.ts` (hoje `idsFunil` fixo com 5) e `filtroEtapa('redeposito')` → `type = 'deposito'` em `apps/api/src/leads/rotas.ts`.
  3. Gráfico: `packages/graficos/src/funil.tsx` só desenha 5 (`visiveis = etapas.slice(0, TRAPEZIOS.length)`). Criar geometria de 6 trapézios no mesmo card (y 332 a 635, bordas nas mesmas retas: esquerda ≈ 206,3 + 0,406·(y − 332), direita ≈ 532,4 − 0,403·(y − 332); altura ≈ 46,3 px e vão de 5 px), textos menores, 6ª cor (verde, ex. `#00C96A` / borda `#1ADB84`) e `TAXA_Y` próprio. A geometria de 5 fica intacta.
  4. Web: rótulo "Redepósito" (hoje vem de `referencia.funil.etapas` em `apps/web/lib/conteudo.ts`, com fallback para o id), `COLETIVO.redeposito = 'redepósitos'` em `FichaLead.tsx` e o filtro de etapas da tela de leads.
  5. Testes (api, graficos, web), `pnpm lint`, typecheck, testes e diff visual; wiki ([[regras-de-tratamento/metricas-e-kpis]], D43). Commit, push e deploy só com o aval do usuário.

### Próximos passos, em ordem
1. (usuário) Configurações → Webhooks → GTech → **Rotacionar segredo** → Copiar.
2. (usuário) Colar na Senha do modal "Criação de usuário" da GTech, conferir Usuário `gtech` e Salvar.
3. (agente preenche, usuário cola a Senha) Webhook "Pagamento de Depósito" igual.
4. Validar com jogador de teste (`?utm_source=teste&utm_campaign=teste`), como no passo 4 da lista de 2026-10-20 abaixo.
5. (agente) Implementar o Redepósito no funil conforme a proposta.
6. Seguem valendo os passos 5 a 10 da lista de 2026-10-20 (Tag `user_id`, LGPD e `is_demo`, senha de admin da GTech, SMTP, imagens antigas, Meta Ads).

## Antes (2026-10-20, por volta das 19:30)
Integração com a GTech, a plataforma de cassino da PASIO. Tudo sobre ela em [[ingestao-webhooks/gtech]].
- **Commit `5ef4829` na `main`** (autenticação Basic no receptor, operadores novos e preset `gtech` no motor de regras, ajuda Basic em Configurações → Webhooks, D42). CI e Deploy verdes.
- **Redeploy às 14:40** (Pull and redeploy com re-pull), com a autorização do usuário. `api` e `db` saudáveis, `/health` 200.
- **Fonte `gtech` criada em produção às 14:47** (Configurações → Webhooks).
- **Preset aplicado pelo usuário** no console do `trafego-pasio-api-1`: versão 1 ativa de `pasio/gtech`, 0 brutos reprocessados. O comando está em [[operacao/runbooks]], "Ativar um preset de regras numa fonte".
- **Webhooks no backoffice da GTech: pendentes.** Ficou aberto o modal "Criação de usuário" (latam.gtech.uy/admin → Personalizar → Webhook) com Nome `kapanda`, URL `https://api.kapanda.lat/webhooks/pasio/gtech`, credencial BASIC, Usuário `gtech` e Senha vazia. A senha é o segredo da fonte, que só o usuário pode copiar. Cuidado com o autofill do Chrome, que põe o login de admin da GTech nesses campos.
- **Páginas explicativas** do caminho do clique até o painel: artifact https://claude.ai/artifact/GppYvHyDpeVeTifHPm5n9T e o arquivo `do-clique-ao-painel.html` na pasta Downloads do usuário.
- Os MCPs `gtm` (timeout) e `voicestudio` (conexão recusada) não conectaram nesta sessão. A Tag do GTM não foi mexida.
- Uma sessão paralela (282dd0cd) começou a ver o Meta Ads da PASIO, sem nada feito.

### Próximos passos, em ordem (usuário, salvo indicação)
1. Configurações → Webhooks → GTech → **Rotacionar segredo** → Copiar.
2. Colar na Senha do modal "Criação de usuário" da GTech, conferir que o Usuário é `gtech` (não o e-mail do admin) e salvar.
3. Criar o webhook "Pagamento de Depósito" igual (mesma URL, Usuário e Senha).
4. Validar: abrir o cassino demo com `?utm_source=teste&utm_campaign=teste`, criar um jogador de teste e fazer um depósito. Conferir em Configurações → Instalação os passos "Plataforma enviando eventos" e "Tradução dos eventos", e no painel o cadastro e o FTD.
5. Conferir se o `user_id` da Tag do site é o mesmo da GTech.
6. Decidir a LGPD (dados pessoais no bruto) e o filtro de `is_demo` ([[operacao/problemas-atuais]], itens 9 e 10).
7. Trocar a senha de admin do backoffice da GTech.
8. Testar o SMTP ("esqueci a senha" em `https://kapanda.lat/login`).
9. Remover as imagens antigas no Portainer (Images).
10. Conectar o Meta Ads (token de usuário do sistema, [[operacao/runbooks]]).

## Antes (2026-10-19, à noite, por volta das 21:30)
- **Deploy pelo GHCR (D41), commit `e00a616` na `main`, push feito.** O workflow `.github/workflows/deploy.yml` constrói `api` e `web` no GitHub Actions e publica em `ghcr.io/abnersantosss/dashboard-trafego-pago/{api,web}` (`latest` e `sha-xxxxxxx`). O `docker-compose.prod.yml` usa essas imagens com `pull_policy: always`, sem `build`. Primeiro run (39342060273) verde; pacotes públicos, sem registry no Portainer. O job `redeploy` só avisou, porque não há secret `PORTAINER_WEBHOOK_URL` (o webhook de stack do Portainer é da Business Edition). Detalhes em [[operacao/producao]], seção "Atualizar".
- **Redeploy feito às 20:38 (UTC do servidor), com autorização do usuário.** Os quatro contêineres foram recriados com `ghcr.io/abnersantosss/dashboard-trafego-pago/api:latest` e `.../web:latest`; `db` e `api` saudáveis, `web` no ar, `segredos` com saída 0. O redeploy levou cerca de 3 minutos (primeiro download das imagens, 2,6 GB); os próximos levam segundos. Validação pública depois: `/health` 200, `/login` 200, apelidos `pasio.*` 200, webhook sem assinatura 400, TLS 1.1 recusado, Tag coletando com 204.
- **SMTP ativo**: o usuário colou a senha de app em `SMTP_SENHA` antes do redeploy. Ainda não houve envio de teste. Seção "E-mail (SMTP)" de [[operacao/producao]].
- GitOps updates continua desligado.

### Próximos passos, em ordem (usuário)
1. ~~Colar `SMTP_SENHA` e Save settings.~~ Feito.
2. ~~Pull and redeploy.~~ Feito às 20:38.
3. ~~Conferir contêineres e imagens `ghcr.io/...`.~~ Feito.
4. ~~Conferir `/health`, login e validação pública.~~ Feito (tudo 200; login só conferido pela página, não pelo formulário).
5. Testar "esqueci a senha" em `https://kapanda.lat/login` e ver se o e-mail chega. Se não chegar, olhar o log do `trafego-pasio-api-1` (erro de autenticação do Gmail = senha de app errada ou verificação em duas etapas desligada).
6. Remover em Images as antigas `trafego-pasio-api`, `trafego-pasio-web` e as `<none>` (sem `docker system prune --volumes`).
7. Opcional: redeploy automático pela API do Portainer (`PUT /api/stacks/135/git/redeploy?endpointId=3`, token de acesso como secret do GitHub e o job `redeploy` adaptado).

Continuam valendo os passos de dados abaixo: fontes de webhook, regras e Meta Ads ([[operacao/problemas-atuais]], item 1).

## Antes, no mesmo dia (2026-10-19)
- **Domínio `kapanda.lat` (D40)**: o plano e a execução estão em [[operacao/deploy-kapanda]].
  - Feito: a stack `trafego-pasio` foi redeployada com `WEB_URL=https://kapanda.lat`, `WEBHOOK_URL_PUBLICA=https://api.kapanda.lat` e o novo `ADMIN_EMAIL`. O link de senha do novo admin saiu no log às 17:57, válido por 1 hora.
  - Feito: zona `kapanda.lat` criada na Cloudflare, com HTTPS sempre, TLS 1.2 e `www` → raiz.
  - Feito: nameservers trocados na Hostinger (pelo usuário) e rotas `kapanda.lat`, `www` e `api` criadas no túnel. **Site no ar em `https://kapanda.lat`**; validação pública com 17 de 18 itens ok (o que falhou foi só o cache de NS do DoH).
  - Feito: Tag 42 publicada no GTM (versão 12), com o ok do usuário.
  - Feito: a correção do `{{` está no `main` (`ede758e`), com CI verde.
  - Feito: o usuário definiu a senha do admin e entrou.
  - Feito: "Pull and redeploy" do `d0dec89` às 20:07, na terceira tentativa. A primeira falhou no `next build`, provavelmente por falta de memória na VPS; na segunda, a requisição do Portainer caiu no túnel. Validação pública com 18 de 18 ok.
  - **Problemas em aberto, com causa e solução: [[operacao/problemas-atuais]].** O sistema inteiro está em [[arquitetura/mapa-do-sistema]].
  - Próximo passo do usuário: o painel só mostra visitas (vindas da Tag) porque não há fonte de webhook nem conta do Meta Ads em produção. Criar as fontes em Configurações → Webhooks, com as regras de cada uma, e conectar o Meta Ads.
  - ~~Proposta técnica em aberto: construir as imagens no GitHub Actions (GHCR), para a VPS não compilar mais no redeploy.~~ Feita à noite (D41), com redeploy às 20:38.

## Até 2026-10-16
- **Deploy (P7.2) no ar** em `https://pasio.proxserverabner.site` (API em `https://pasio-api.proxserverabner.site`). Stack `trafego-pasio` no Portainer, rotas no túnel `servidor-abner`. Falta: o usuário definir a senha do admin pelo link do log (se passar de 1 hora, reiniciar o contêiner `trafego-pasio-api-1` gera outro), entrar e configurar a Tag do GTM, os webhooks e o Meta Ads com os endereços públicos. Atualizar: Portainer → stack → Pull and redeploy. Backup: volumes `trafego-pasio_pgdata` e `trafego-pasio_segredos`, juntos. Tudo sobre o ambiente no ar (endereços, contêineres, senha do admin, atualizar, logs, backup, armadilhas e pendências) em [[operacao/producao]].
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
- **Direção sugerida, seguida em 2026-10-16 (deploy feito)**: parar de adicionar funcionalidades e ir direto para o deploy (Fase 7), para o painel ser usado de verdade; o resto entra só se fizer falta no uso. Motivo: o pedido original era "receber webhooks e transformar em dados no painel", e o plano de 41 tarefas mais os pedidos novos (usuários, convites, login, tag GTM) tornaram o projeto um produto completo. O que importa para o usuário já funciona localmente: tela igual à imagem com dados reais, webhooks virando métricas e Configurações.
- Fases 1 a 6 concluídas e enviadas para `main` em `github.com/AbnerSantosss/dashboard-trafego-pago` (repositório **público**, ver [[operacao/ambiente-e-seguranca]]).
  - `a567b2b`: Fase 6 (CI, e2e de isolamento G3, item Configurações na sidebar).
  - `5216d62`: Configurações (perfil, usuários e convites, login, tag GTM e cruzamento com o webhook). Detalhes em [[administracao-multiempresa/configuracao-por-empresa]] e nas decisões D19 a D21 de [[decisoes-tecnicas/decisoes]].
- Fora do git, de propósito: `apps/api/.env.local` (credenciais SMTP de teste) e `registro/`. O `apps/web/tsconfig.tsbuildinfo` aparece como modificado e não deve ser commitado (é gerado).

## CI: estado
Desde 2026-10-19 há também o workflow `.github/workflows/deploy.yml` (D41: imagens no GHCR), verde no primeiro run (39342060273), com os mesmos avisos de Node 20 nas actions `@v4`, `@v3` e `@v6`. Ver os runs: `gh run list --workflow deploy.yml`.

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
   - P7.2 deploy: **no ar desde 2026-10-16** (D39, [[operacao/producao]]). Stack `trafego-pasio` com segredos, db, api e web; o cloudflared é o do host; segredos gerados no servidor. Falta o critério de aceite: um webhook de produção processar um evento de teste. Mexer na stack ou no túnel continua pedindo confirmação explícita do usuário.
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

Relacionado: [[log]], [[operacao/producao]], [[operacao/ambiente-e-seguranca]], [[orquestracao-agentes/agentes-e-fases]].
