---
tipo: operacao
atualizado: 2026-10-21
tags: [producao, problemas, disco, tunel, diagnostico, portainer, deploy, webhooks, meta-ads, kapanda, ghcr, smtp, gtech, lgpd]
---

# Problemas atuais

Tudo o que não funciona ou funciona pela metade em produção, com a causa e o que resolve. A arquitetura que esses itens citam está em [[arquitetura/mapa-do-sistema]]. Atualize esta página quando um item for resolvido: marque como resolvido com a data e o que foi feito, sem apagar.

## Situação geral (2026-10-21, por volta das 13:25)
- SMTP configurado e validado em produção (item 5 resolvido, falta só o usuário ver um e-mail chegar). Seguem abertos GTech e Meta Ads.

## Situação geral anterior (2026-10-21, por volta das 12:55)
- Commit `d5569d9` (Redepósito, segurança, duas etapas) **no ar** desde 12:50, depois que o usuário liberou espaço no disco (item 13 resolvido). Seguem abertos SMTP (item 5), GTech e Meta Ads.

## Situação geral anterior (2026-10-21, por volta das 12:10)
- Commit `d5569d9` (Redepósito, segurança, duas etapas) com CI e Deploy verdes, mas **fora do ar**: o redeploy falha por disco cheio no servidor (item 13). Produção segue no `5ef4829`.

## Situação geral anterior (2026-10-21, madrugada)
- Mesmo commit no ar (`5ef4829`). O túnel caiu e voltou sozinho (item 12).
- Item 1 continua parcial: os webhooks da GTech ainda não foram salvos ([[ingestao-webhooks/gtech]]).
- Item 11 com a causa achada (Docker Desktop reinicia e o banco tem `restart=no`).

## Situação geral anterior (2026-10-20, por volta das 19:30)
- **No ar com o commit `5ef4829`** (autenticação Basic e preset da GTech, D42): CI e Deploy verdes, "Pull and redeploy" às 14:40 com re-pull, `api` e `db` saudáveis, `/health` 200.
- **Item 1 parcialmente resolvido**: a fonte `gtech` existe em produção com o preset na versão 1. Falta o usuário colar o segredo nos dois webhooks do backoffice da GTech e validar com um jogador de teste ([[ingestao-webhooks/gtech]]).
- Itens novos: 9 (dados pessoais no bruto da GTech), 10 (`is_demo` não filtrado e outras lacunas do preset) e 11 (banco local que para sozinho).
- Continuam: teste do SMTP (item 5), limpeza das imagens antigas (item 3) e Meta Ads (item 1).

## Situação geral anterior (2026-10-19, por volta das 21:30)
- **No ar e saudável, agora com as imagens do GHCR (`e00a616`).** Redeploy feito às 20:38 com autorização do usuário: os quatro contêineres recriados com `ghcr.io/abnersantosss/dashboard-trafego-pago/{api,web}:latest`, `db` e `api` saudáveis, `web` no ar. Validação pública depois do redeploy ok (`/health`, `/login`, apelidos, webhook sem assinatura 400, TLS 1.1 recusado, Tag com 204). O item 2 está resolvido de ponta a ponta; o item 3 só pede uma limpeza única das imagens antigas; o item 5 está ativo (senha de app colada), falta o teste de envio.
- **Histórico desta noite (antes do redeploy).** Deploy pelo GHCR pronto (D41). O commit `e00a616` está na `main`: o workflow Deploy (run 39342060273, verde) publicou `ghcr.io/abnersantosss/dashboard-trafego-pago/api` e `.../web` (`latest` e `sha-e00a616`), e o compose da stack passou a baixar essas imagens. O primeiro clique em "Pull and redeploy" foi barrado pelo classificador do Claude Code; o usuário autorizou e o redeploy foi feito às 20:38.
- **SMTP em andamento.** As variáveis SMTP foram salvas na stack (Save settings, sem redeploy), com `SMTP_SENHA` em branco. O usuário colou a senha de app do Gmail e o redeploy a levou para a API (item 5); falta só o teste de envio.

## Situação geral anterior (2026-10-19, 20:10)
- **No ar e saudável.** Stack `trafego-pasio` no commit `d0dec89`, recriada às 20:07: `db` e `api` saudáveis, `web` no ar e `segredos` com saída 0. No log da API, sem erro.
- **Validação pública: 18 de 18 ok.** DNS (o Google já devolve `eva`/`joel.ns.cloudflare.com`), HTTPS e redirecionamentos, certificados, TLS 1.1 recusado, `/health`, CORS, webhook sem assinatura recusado, coleta da Tag com 204 e o endereço antigo `pasio.*`.
- **Admin com senha.** O usuário entrou no painel; o preparo não imprime mais link.
- **Volumes intactos depois da limpeza do servidor feita pelo usuário.** `trafego-pasio_pgdata` e `trafego-pasio_segredos` continuam com a data de criação de 2026-10-16.

## 1. O painel mostra só visitas (Investimento, Cliques, Cadastro, FTD e Depósitos vazios)
> **Parcialmente resolvido em 2026-10-20.** A plataforma é a GTech, que só oferece credencial Basic; o receptor passou a aceitar Basic (D42, `5ef4829`, em produção às 14:40). Fonte `gtech` criada às 14:47 e preset `gtech` na versão 1 ativa. **Falta**: o usuário colar o segredo da fonte nos webhooks "Criação de usuário" e "Pagamento de Depósito" do backoffice da GTech, validar com um jogador de teste (critério de aceite da P7.2) e conectar o Meta Ads. Passo a passo em [[ingestao-webhooks/gtech]]. O texto abaixo fica como histórico; o passo 1 de "O que resolve" vale para HMAC, e a GTech usa o modo Basic.

**Sintoma**: na Visão Geral aparecem 69 visitas no canal Meta e o resto fica em 0 ou "–".

**Causa**: não é defeito. Cada número vem de uma entrada diferente, e em produção só a Tag do GTM está ligada (tabela completa em [[arquitetura/mapa-do-sistema]], seção 6):
- visitas vêm da Tag 42 do GTM, que já está publicada e enviando: **funciona**;
- cadastro, FTD, depósito e cliques vêm de **webhooks** da plataforma ou dos afiliados, e nenhuma fonte de webhook foi criada em produção. O banco de produção tem a PASIO sem dados de exemplo (o seed não roda em produção);
- investimento, e com ele CPA e ROAS, vem de **gastos**: nenhuma conta do Meta Ads foi conectada e nenhum gasto foi lançado. A sincronização do Meta traz só o gasto, nunca cliques.

**O que resolve** (pelo painel, sem deploy):
1. Configurações → Webhooks: criar uma fonte por origem (por exemplo a plataforma da casa). O painel mostra a URL `https://api.kapanda.lat/webhooks/pasio/{fonte}` e o segredo uma única vez; a plataforma é configurada para enviar com a assinatura HMAC ([[ingestao-webhooks/contrato-webhook]]).
2. Configurar a regra da fonte (mapeamento JSONPath dos campos do payload: tipo, valor, moeda, `lead_key`, UTMs) em [[regras-de-tratamento/motor-de-regras]]. Sem regra ativa, o evento chega e fica com status `erro`, que pode ser reprocessado depois.
3. Configurações → Meta Ads: conectar a conta `act_…` com um token do Meta (gerado pelo usuário no Gerenciador de Negócios). A API sincroniza de hora em hora.
4. Critério de aceite da P7.2: um evento de teste de uma fonte real aparecer no painel.

## 2. "Pull and redeploy" falhou duas vezes antes de dar certo
> **Resolvido em 2026-10-19 (D41, commit `e00a616`), falta só o redeploy manual.** As imagens `api` e `web` passaram a ser construídas no GitHub Actions (workflow `.github/workflows/deploy.yml`) e publicadas no GHCR; o `docker-compose.prod.yml` usa `image: ghcr.io/abnersantosss/dashboard-trafego-pago/<alvo>:${IMAGEM_TAG:-latest}` com `pull_policy: always`, sem `build`. A VPS não compila mais, e o redeploy leva segundos (fica bem abaixo dos 100 s do túnel). Primeiro run verde (39342060273), pacotes públicos, sem registry no Portainer. **Ainda falta**: clicar "Pull and redeploy" uma vez para a stack trocar os contêineres do `d0dec89` pelos do GHCR. O redeploy continua manual, porque o webhook de stack do Portainer é da Business Edition; a alternativa é a API do Portainer com um token ([[operacao/producao]], seção "Atualizar"). O texto abaixo fica como histórico.

**Sintomas**:
- 19:52: `Failed to deploy a stack: compose build operation failed: failed to solve: process "/bin/sh -c pnpm install --offline --frozen-lockfile --filter "@trafego/web..." && pnpm --filter "@trafego/web..." build" did not complete successfully: exit code: 1`;
- 20:00: notificação `Failure` com o texto `[object Object]`. As duas imagens novas ficaram prontas depois disso (a da API às 20:00:37 e a do web às 20:04:40), mas os contêineres **não** foram trocados e a stack continuou no commit `f33ddc9`;
- 20:07: terceira tentativa, com o build já em cache, terminou em menos de 1 minuto e recriou tudo no `d0dec89`.

Em nenhuma das falhas o site caiu: o compose só troca os contêineres depois que os builds terminam.

**Causa provável** (não confirmada; o Portainer só mostra o resumo do erro):
- **Primeira falha, falta de recurso na VPS.** O mesmo commit construiu sem erro no CI e numa reprodução local do alvo `web-build` (2026-10-19, `git archive HEAD | docker build --target web-build`). O código está bom. O servidor tem 6,4 GB de RAM e cerca de 64 contêineres de outros projetos, e o compose constrói a API e o web **ao mesmo tempo**. O `next build` é a etapa mais pesada e foi ela que caiu. Depois que o usuário fez uma limpeza no servidor, o build passou.
- **Segunda falha, a conexão do Portainer caiu no meio.** O Portainer é acessado pelo túnel da Cloudflare, que corta requisições longas (o limite do proxy é de cerca de 100 s). A requisição do "Pull and redeploy" fica aberta durante todo o build. Quando ela caiu, o build terminou sozinho no servidor, mas o passo de recriar os contêineres não aconteceu. É o mesmo motivo de, no deploy das 17:48, o botão ter saído de "In progress" por volta dos 4 minutos.

**Como contornar hoje**:
- se a notificação for `[object Object]` ou o botão sair de "In progress" sem aviso, conferir em Images se `trafego-pasio-api` e `trafego-pasio-web` ganharam horário novo. Se ganharam e os contêineres não mudaram, clicar "Pull and redeploy" de novo: com o cache, termina em segundos;
- deixar "Re-pull image" desligado: ele baixa de novo `postgres` e `alpine`, sem necessidade, porque o `pull_policy: build` já reconstrói o código;
- se o `exit code: 1` voltar, conferir a memória livre do servidor antes de tentar de novo.

**O que resolve de vez** (proposta, ainda não feita; vira decisão quando o usuário escolher):
- construir as imagens no GitHub Actions e publicar no GHCR, para a stack só baixar as imagens prontas. O servidor deixa de compilar e o redeploy leva segundos. É o caminho recomendado;
- ou, mais simples: construir uma imagem por vez (por exemplo `COMPOSE_PARALLEL_LIMIT=1`, ou `depends_on` só para o build) e acessar o Portainer por um caminho sem o corte de 100 s;
- e diminuir as imagens (hoje cerca de 1,3 GB cada, porque levam devDependencies), o que alivia memória e disco.

## 3. Sobras de imagens a cada redeploy
> **Resolvido quando a stack for redeployada pelo GHCR (D41).** Sem `pull_policy: build`, o servidor não gera mais imagens novas a cada deploy; só baixa as do GHCR. Depois do primeiro redeploy, limpar uma única vez em Images as antigas `trafego-pasio-api` e `trafego-pasio-web` e as `<none>` (nunca `docker system prune --volumes`). Com o tempo, as versões antigas `ghcr.io/...` também podem ser removidas como "Unused".

**Sintoma**: depois do redeploy ficaram 6 imagens soltas (`<none>`) e cerca de 2 GB de cache de build no servidor.

**Causa**: o `pull_policy: build` gera imagens novas com a mesma tag, e as antigas ficam sem nome. São cerca de 1,3 GB por imagem a cada deploy.

**O que resolve**: de tempos em tempos, Portainer → Images → filtrar "Unused" e remover só as `<none>`, ou no host `docker image prune` (sem `-a`), que **não** apaga volumes nem imagens em uso. Não rodar `docker system prune --volumes`: ele apagaria volumes parados de outros projetos. Com as imagens vindas do GHCR (item 2), isso some.

## 4. Senha do admin: conferir qual ficou
**Sintoma**: quando o link de redefinição foi aberto, os dois campos já estavam preenchidos com uma senha aleatória, provavelmente a sugestão de senha forte do Chrome.

**Causa**: o Chrome sugere senha forte em formulários de nova senha.

**O que resolve**: se a senha salva não for a que o usuário escolheu (`Mudar@123` foi a pedida), trocar em Configurações → Perfil, ou pegar no gerenciador de senhas do Chrome a que ele guardou para `kapanda.lat`.

## 5. Sem SMTP: convites e recuperação de senha não chegam por e-mail
> **Resolvido em 2026-10-21, 13:20.** As seis variáveis de e-mail estão na stack, o teste no console da API deu `465 ok`, `587 ok` e login ok, e o redeploy do `19caf34` subiu com remetente "[PASIO] Painel de Análise" e prefixo `[PASIO]` no assunto. No caminho, o primeiro redeploy falhou por causa das aspas no `EMAIL_REMETENTE` (detalhe em [[operacao/producao]], seção "E-mail (SMTP)"). Falta só o usuário confirmar a chegada de um e-mail real.

> **Em andamento (2026-10-19).** No Portainer, nas variáveis da stack `trafego-pasio`, foram salvas (Save settings, sem redeploy) `SMTP_HOST` (Gmail), `SMTP_PORT=465`, `SMTP_USUARIO` (o e-mail do admin, variável ADMIN_EMAIL / SMTP_USUARIO da stack) e `EMAIL_REMETENTE` ("Painel PASIO" com o mesmo e-mail). `SMTP_SENHA` ficou em branco: é uma senha de app do Gmail (16 letras), que o usuário cola ele mesmo. Enquanto ela estiver vazia, a API considera o SMTP não configurado e não envia nada (`apps/api/src/conta/email.ts` exige `SMTP_HOST`, `SMTP_USUARIO` e `SMTP_SENHA`). **Falta**: a senha, o redeploy e testar "esqueci a senha". O texto abaixo fica como histórico.

**Causa**: as variáveis `SMTP_*` e `EMAIL_REMETENTE` da stack estão vazias. Em produção a API não escreve no log os links pedidos pela tela.

**O que resolve**: preencher as variáveis SMTP no Portainer e fazer o redeploy. Enquanto isso, a senha esquecida se recupera pelo banco ([[operacao/producao]], seção "Primeiro acesso e senha do admin").

## 6. Ainda não conferido em produção
- **Server actions do Next pelo túnel** (salvar formulários das Configurações): validadas só na stack local. Se um formulário falhar com erro de origem, olhar o log do `trafego-pasio-web-1`.
- **Aba Configurações → Tag**: depois do redeploy das 20:07, deve mostrar o código sem `{{` (correção `ede758e`). A Tag publicada no GTM já está corrigida.

## 7. Problemas de outros projetos no mesmo servidor (não são desta stack)
- `aven-tunnel` reinicia sem parar (código 255) desde antes do deploy de hoje.
- `telahub-novo-backend-1` também foi visto reiniciando às 17:57.
Nenhum dos dois foi tocado. Eles disputam CPU e memória com o build (item 2).

## 8. Itens menores
- Sem backup agendado dos volumes `pgdata` e `segredos` (comandos em [[operacao/producao]]).
- As rotas antigas `pasio.*` seguem no túnel como apelido; dá para remover quando ninguém mais usar.
- O CI avisa que as actions `@v4` rodam em Node 20 (obsoleto) e que `ubuntu-latest` muda para Ubuntu 26. Desde 2026-10-19 o workflow Deploy dá os mesmos avisos para `@v4`, `@v3` e `@v6` (só avisos).
- O Portainer está na 2.39.1 LTS e a 2.45.2 já existe. Atualizar é decisão do dono do servidor, porque afeta todos os projetos.
- O bloco recolhível "Plataforma que só aceita autenticação Basic" (Configurações → Webhooks, `.cfg-ajuda summary`) não tem setinha de abrir e fechar.
- A senha de admin do backoffice da GTech foi escrita no chat da sessão de 2026-10-20: trocar depois do teste.

## 9. Dados pessoais no bruto da GTech (LGPD)
**Sintoma**: quando os webhooks da GTech começarem a chegar, `webhook_events.payload` vai guardar o JSON inteiro.

**Causa**: o payload da GTech traz e-mail, nome, documento, data de nascimento, `user_token` e `qrcode`. O preset não lê esses campos, mas o receptor grava o bruto como chegou, para poder reprocessar.

**O que resolve** (decisão do usuário, em aberto): mascarar ou descartar esses campos antes de gravar (lista por fonte), ou definir um prazo de retenção dos brutos. Até lá, nada de PII real na wiki, em commits ou em fixtures. Ver D42 em [[decisoes-tecnicas/decisoes]] e [[ingestao-webhooks/gtech]].

## 10. Lacunas do preset da GTech
- `is_demo` não é filtrado: cadastros de demonstração contariam no painel. Resolve acrescentando a condição ao `ignorar` do preset, se a PASIO quiser.
- `utm_term`, `utm_content`, `fbp` e `fbc` não têm campo canônico e ficam fora.
- A GTech não manda `X-Event-Id`: a idempotência é pelo hash do corpo. Um reenvio com corpo diferente contaria duas vezes; a melhoria é usar `event` + `deposit_id` como chave.
- `amount` como texto `"1.000"` seria lido como mil. Conferir no primeiro depósito real.
- As regras de canal padrão não reconhecem Google nem TikTok por UTM, e um toque só com `fbp` não conta como Meta.
- `user_id` igual na Tag do site e na GTech ainda não foi confirmado; sem isso, o cruzamento só funciona pelo `tracker` da GTech.

## 11. Ambiente local: o banco para sozinho
**Sintoma**: o contêiner local `101-eventospasio-db-1` (compose de desenvolvimento, porta 5460) para sozinho cerca de 1 minuto depois de subir.

**Causa** (achada em 2026-10-21): o Docker Desktop reinicia sozinho de tempos em tempos. Os outros contêineres voltam (todos aparecem "Up 19 seconds"), mas o do banco tem `restart=no` e fica parado. A API local cai junto, com `ECONNREFUSED` na 5460 ("falha ao iniciar a fila pg-boss"). Não afeta produção.

**Contorno**: subir de novo com `docker compose up -d` (e reiniciar a API) antes de rodar testes com banco. Uma correção seria `restart: unless-stopped` no compose de desenvolvimento; não foi feita.

## 12. Túnel fora: Erro 1033 e 530 em todos os hosts (2026-10-21)
**Sintoma**: `kapanda.lat` mostrou o Erro 1033 da Cloudflare e todos os hosts do túnel `servidor-abner` responderam 530 (kapanda.lat, api.kapanda.lat, pasio.proxserverabner.site, portainer.proxserverabner.site).

**Causa**: a internet do servidor caiu e o `cloudflared` ficou sem conexão. Não era a stack.

**O que resolveu**: nada na stack. Quando a internet voltou, `kapanda.lat/login` e `api.kapanda.lat/health` responderam 200. Enquanto durou, envios de webhook teriam falhado, porque o receptor fica atrás do mesmo túnel.

**Como diagnosticar de novo**: 530 ou 1033 em todos os hosts ao mesmo tempo = túnel ou internet do servidor, não a aplicação. Se só `api` ou só `web` falhar, olhar os contêineres no Portainer.

## 13. Redeploy falha: disco do servidor cheio (2026-10-21)
> **Resolvido em 2026-10-21, 12:50**: o usuário removeu as imagens antigas deste projeto no Portainer e o Pull and redeploy com re-pull subiu o `d5569d9` na primeira tentativa (cerca de 80 s até a API nova responder).

**Sintoma**: "Pull and redeploy" com re-pull mostra "In progress" e volta ao normal sem recriar os contêineres; a produção continua na versão antiga. Nenhuma notificação aparece em Notifications. O erro só aparece no console do navegador: `Failed to pull images of the stack: compose pull operation failed: failed to extract layer ... no space left on device`.

**Causa**: o disco da VPS encheu. Cada imagem deste projeto tem de 1,2 a 1,4 GB e as versões antigas continuavam no servidor (item 3), junto com imagens grandes de outros projetos.

**O que resolve**: Portainer → Images → remover as imagens **Unused** deste projeto: as `trafego-pasio-api:latest` e `trafego-pasio-web:latest` dos builds locais e as `ghcr` antigas sem tag (cerca de 5,2 GB em 2026-10-21). Depois, Pull and redeploy com re-pull. Nunca `docker system prune --volumes`.

**Como diagnosticar de novo**: se o redeploy "termina" e os contêineres não mudam de horário, abrir o console do navegador (F12) na página da stack e procurar `Failed to pull`.

**Para não voltar**: remover as `ghcr` antigas (Unused) depois de cada redeploy que deu certo, e pensar em imagens menores (o `web` leva `node_modules` inteiro, inclusive os mapas do runtime de desenvolvimento do Next).

Relacionado: [[operacao/producao]], [[operacao/retomada]], [[operacao/deploy-kapanda]], [[arquitetura/mapa-do-sistema]], [[ingestao-webhooks/gtech]].
