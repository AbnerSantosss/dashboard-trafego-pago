---
tipo: referencia
atualizado: 2026-10-19
tags: [producao, deploy, portainer, cloudflare, tunel, docker, segredos, backup, kapanda, gtm, ghcr, github-actions, smtp]
---

# Produção

Tudo o que existe no ar e como mexer nele. Decisões em [[decisoes-tecnicas/decisoes]] D39 (stack e túnel), D40 (domínio `kapanda.lat`) e D41 (imagens construídas no GitHub Actions e publicadas no GHCR). O passo a passo de uma instalação do zero está em [[operacao/runbooks]], seção Produção. No ar desde 2026-10-16. Desde 2026-10-19 o domínio é `kapanda.lat`; a migração está em [[operacao/deploy-kapanda]].

## Endereços
| O quê | Endereço |
|---|---|
| Painel | `https://kapanda.lat` (`www` redireciona para a raiz) |
| API | `https://api.kapanda.lat` (saúde em `/health`) |
| Webhooks | `https://api.kapanda.lat/webhooks/pasio/{fonte}` ([[ingestao-webhooks/contrato-webhook]]) |
| Coleta da Tag do GTM | `https://api.kapanda.lat/t/pasio/clk` |
| Endereços antigos (apelido) | `https://pasio.proxserverabner.site` e `https://pasio-api.proxserverabner.site`, mesmos contêineres |
| DNS | zona `kapanda.lat` na Cloudflare (Free), nameservers `eva` e `joel.ns.cloudflare.com`; o registro do domínio continua na Hostinger |
| Portainer | `https://portainer.proxserverabner.site` (CE 2.39.1, ambiente `local`) |
| Túnel | Cloudflare → Networking → Tunnels → `servidor-abner` (cloudflared roda no host) |

As abas Instalação, Tag e Webhooks de Configurações montam as URLs a partir de `WEBHOOK_URL_PUBLICA`, por isso mostram o endereço público da API.

## Stack `trafego-pasio`
Criada no Portainer pelo Git (Stacks → Add stack → Repository):
- repositório `github.com/AbnerSantosss/dashboard-trafego-pago`, referência `refs/heads/main`, compose `docker-compose.prod.yml`;
- variáveis da stack, só três: `WEB_URL` (`https://kapanda.lat`), `WEBHOOK_URL_PUBLICA` (`https://api.kapanda.lat`) e `ADMIN_EMAIL`. O valor do e-mail fica **só** no Portainer: o repositório é público, então ele não entra no código, na wiki nem no log;
- SMTP, salvas em 2026-10-19 (seção "E-mail (SMTP)"): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USUARIO` e `EMAIL_REMETENTE`; `SMTP_SENHA` ainda em branco;
- opcionais, ainda vazias: `ADMIN_NOME`, `LOG_LEVEL`, `META_GRAPH_VERSAO`, `WEB_PORTA`, `API_PORTA` e `IMAGEM_TAG` (versão das imagens, padrão `latest`, D41). A lista comentada está em `deploy/producao.env.example`.

| Contêiner | Imagem | Papel | Porta |
|---|---|---|---|
| `trafego-pasio-segredos-1` | `alpine:3.20` | gera os segredos e sai com código 0 (fica "exited", é o normal) | — |
| `trafego-pasio-db-1` | `postgres:16-alpine` | banco `trafego` | nenhuma publicada |
| `trafego-pasio-api-1` | `ghcr.io/abnersantosss/dashboard-trafego-pago/api:${IMAGEM_TAG:-latest}` (alvo `api` do `Dockerfile`, D41; até o próximo redeploy ainda roda `trafego-pasio-api:latest`, construída na VPS) | preparo do banco e Fastify | `127.0.0.1:3481` → 3001 |
| `trafego-pasio-web-1` | `ghcr.io/abnersantosss/dashboard-trafego-pago/web:${IMAGEM_TAG:-latest}` (alvo `web`, D41; até o próximo redeploy ainda roda `trafego-pasio-web:latest`) | Next.js | `127.0.0.1:3480` → 3000 |

Ordem de subida: `segredos` termina → `db` saudável (`pg_isready`) → `api` saudável (`/health`) → `web`. Volumes: `trafego-pasio_pgdata` (dados) e `trafego-pasio_segredos` (segredos).

## Rotas do túnel
Túnel `servidor-abner` → Routes → Add route → Published application:
- `kapanda.lat` e `www.kapanda.lat` → `http://localhost:3480`
- `api.kapanda.lat` → `http://localhost:3481`
- apelidos de 2026-10-16: `pasio.proxserverabner.site` → `http://localhost:3480` e `pasio-api.proxserverabner.site` → `http://localhost:3481`

Na zona `kapanda.lat`: "Always Use HTTPS" ligado, TLS mínimo 1.2, SSL Full e uma Redirect Rule do `www` para a raiz (301, com a query string). A CORS da API aceita só `WEB_URL`, mas o web fala com a API pelo servidor, então as páginas também abrem pelo apelido. Conferido depois do redeploy: `/redefinir` dá 200 e `pasio-api` `/health` responde ok.

A Cloudflare cria sozinha o CNAME para o túnel. As portas ficam só em `127.0.0.1` porque o cloudflared roda no próprio host; ninguém alcança web ou API sem passar pelo túnel.

## Segredos
Ninguém digita nem vê senha ou chave. Na primeira subida, o serviço `segredos` grava em `trafego-pasio_segredos` quatro arquivos de 32 bytes aleatórios em hex (`chmod 444`): `postgres_senha`, `app_user_senha`, `auth_secret` e `webhook_chave_cifra`. Nas subidas seguintes ele vê que os arquivos existem e não os troca.
- o postgres lê a senha por `POSTGRES_PASSWORD_FILE`;
- a API monta o volume em `/run/segredos` (só leitura) e carrega `apps/api/src/segredos-do-servidor.ts` com `--import`, que preenche `POSTGRES_SENHA`, `APP_USER_SENHA`, `AUTH_SECRET`, `WEBHOOK_CHAVE_CIFRA`, `DATABASE_URL` e `DATABASE_ADMIN_URL`. Uma variável já definida na stack vale mais que o arquivo;
- o web não recebe segredo nenhum: fala com a API pela rede interna (`API_URL=http://api:3001`).

## Primeiro acesso e senha do admin
A cada subida, a API roda o preparo `apps/api/src/db/producao.ts` antes do servidor: migrações, `app_user` com LOGIN e senha, empresa PASIO (slug `pasio`, sem dados de exemplo) se ainda não existir, e o admin de `ADMIN_EMAIL`.
- Enquanto o admin não tem senha, o log de `trafego-pasio-api-1` traz um link `https://kapanda.lat/redefinir?token=…` válido por **1 hora**. O token não depende do domínio, então o mesmo caminho funciona pelo apelido `pasio.proxserverabner.site`. Portainer → Containers → `trafego-pasio-api-1` → Logs.
- Passou de 1 hora: reiniciar o contêiner da API gera outro link.
- Depois que a senha é definida, o preparo para de imprimir o link. Sem SMTP, em produção a API também não escreve no log os links pedidos pela tela, então uma senha esquecida se recupera assim: Portainer → Containers → `trafego-pasio-db-1` → Console → `psql -U postgres -d trafego` → `UPDATE users SET senha_hash = NULL WHERE lower(email) = lower('<e-mail do admin>');` e reiniciar `trafego-pasio-api-1`, que volta a imprimir o link.
- Com SMTP nas variáveis da stack, convites e links de redefinição passam a sair por e-mail.

## E-mail (SMTP)
Convites e "esqueci a senha" saem por e-mail só quando a API acha `SMTP_HOST`, `SMTP_USUARIO` e `SMTP_SENHA` preenchidos (`apps/api/src/conta/email.ts`); faltando qualquer um, o SMTP conta como não configurado e nada é enviado, sem erro.
- Variáveis da stack: `SMTP_HOST` (Gmail: `smtp.gmail.com`), `SMTP_PORT` (`465`, TLS direto), `SMTP_USUARIO` (o e-mail do admin, variável ADMIN_EMAIL / SMTP_USUARIO da stack), `SMTP_SENHA` e `EMAIL_REMETENTE` (nome exibido "Painel PASIO" e o mesmo e-mail). Os valores ficam **só** no Portainer.
- `SMTP_SENHA` é uma **senha de app do Gmail** (16 letras, gerada na conta Google com a verificação em duas etapas ligada), não a senha da conta. O usuário cola ele mesmo, no Portainer: Stacks → `trafego-pasio` → Environment variables → Save settings.
- Mudar variável não troca nada sozinho: depois do Save settings, é preciso o "Pull and redeploy" para a API subir com os valores novos.
- Estado em 2026-10-19: tudo salvo, menos `SMTP_SENHA` (em branco); redeploy ainda não feito.
- Teste: na tela de login, "esqueci a senha" com o e-mail do admin; o link tem de chegar na caixa de entrada.

## Atualizar (desde 2026-10-19, D41)
O servidor não compila mais. O caminho é: **push na `main` → GitHub Actions (workflow Deploy) → GHCR → "Pull and redeploy" no Portainer**.
1. Commit e push na `main`. O workflow `Deploy` (`.github/workflows/deploy.yml`) roda sozinho, exceto quando o commit só mexe em `wiki/**`, `registro/**` ou `*.md`; também dá para rodar à mão (`workflow_dispatch`: Actions → Deploy → Run workflow, ou `gh workflow run deploy.yml`). Um deploy por vez: um push novo espera o anterior terminar.
2. O job `imagens` constrói `api` e `web` (`linux/amd64`, cache do GitHub) e publica em `ghcr.io/abnersantosss/dashboard-trafego-pago/api` e `.../web` com duas tags: `latest` e `sha-xxxxxxx` (7 primeiros caracteres do commit). Os pacotes são públicos, como o repositório: o Portainer baixa sem login nem registry cadastrado.
3. O job `redeploy` só dispara o Portainer se existir o secret `PORTAINER_WEBHOOK_URL`. Hoje não existe, então ele termina verde com um aviso, e o passo seguinte é manual.
4. Portainer → Stacks → `trafego-pasio` → **Pull and redeploy**. Com `pull_policy: always`, a stack baixa a imagem da tag e recria `api` e `web` em segundos ("Re-pull image" ligado ou não, tanto faz).
5. O preparo aplica as migrações novas sozinho na subida da API. Conferir em Containers que `api` e `web` têm horário novo e imagem `ghcr.io/...`, depois `https://api.kapanda.lat/health` e o login.

**Onde ver os runs**: `gh run list --workflow deploy.yml` e `gh run view <id>` (ou `--log-failed`), ou a aba Actions do repositório. As imagens publicadas aparecem em Packages do repositório no GitHub.

**Rollback**: na stack, criar a variável `IMAGEM_TAG` com a tag de um commit bom (`sha-` mais os 7 primeiros caracteres, como aparece no GHCR), Save settings e "Pull and redeploy". Para voltar ao normal, apagar a variável (ou pôr `latest`) e redeployar. Migrações já aplicadas não são desfeitas pelo rollback.

**GitOps e webhook da stack são da Business Edition**: no Portainer CE 2.39.1, ligar "GitOps updates" ou o webhook da stack abre um diálogo de licença. Por isso o redeploy é manual. Para automatizar na CE, o caminho é a API do Portainer: `PUT /api/stacks/135/git/redeploy?endpointId=3` com um token de acesso criado pelo usuário (Portainer → My account → Access tokens) e guardado como secret do GitHub; o job `redeploy` teria de ser adaptado para isso.

**Antes de D41** (histórico): API e web tinham `pull_policy: build` e eram construídas na VPS a cada "Pull and redeploy" (de 4,5 a 9 minutos). Foi o que causou as falhas do item 2 de [[operacao/problemas-atuais]].

## Logs e conferência
- Portainer → Containers → contêiner → Logs. A API loga em JSON (pino), nível `info`; `/health` só loga aviso, porque o healthcheck chama a cada 10 s.
- Conferência rápida pelos endereços públicos: `/health` responde `{"status":"ok",...}`, `/login` dá 200, a raiz redireciona para `/login` e `/auth/sessao-dev` dá 404 (só existe em desenvolvimento).

## Backup e restauração
Os dois volumes andam **juntos**. Sem a chave de cifra do volume `segredos`, os segredos de webhook e os tokens do Meta gravados no banco não abrem; sem as senhas, o banco restaurado não aceita a API.

Backup, no host (stack parada ou com o banco quieto):
```
docker run --rm -v trafego-pasio_pgdata:/v -v "$PWD":/b alpine tar czf /b/pgdata.tgz -C /v .
docker run --rm -v trafego-pasio_segredos:/v -v "$PWD":/b alpine tar czf /b/segredos.tgz -C /v .
```
Restaurar: parar a stack, extrair os dois arquivos nos volumes vazios com o mesmo comando ao contrário (`tar xzf`) e subir de novo. Um `pg_dump` sozinho também serve para os dados, desde que o volume `segredos` vá junto.

## Armadilhas
- **Apagar o volume `segredos` com o banco já criado** gera senhas novas que o postgres não conhece: a API fica sem acesso ao banco e os dados cifrados ficam ilegíveis. Antes de remover ou recriar a stack, faça o backup e confira em Volumes que os dois continuam lá.
- ~~**`pull_policy: build`** precisa continuar no compose~~: valeu até D41. Agora `api` e `web` usam `pull_policy: always` com as imagens do GHCR; sem ele, o Portainer reaproveitaria a imagem `latest` já baixada.
- **Hostname `painel`** já estava em uso no túnel; por isso as rotas são `pasio` e `pasio-api`.
- **Rate-limit** é por visitante (`cf-connecting-ip`, D39). Sem esse cabeçalho, todos chegariam com o IP do gateway do Docker e dividiriam o limite do login (10 por minuto) e da Tag do GTM (120 por minuto).
- **Server actions do Next pelo túnel** (salvar formulários): validadas na stack local, ainda não conferidas em produção. Se um formulário falhar com erro de origem, olhar o log do `trafego-pasio-web-1`.
- **Formulário de rota da Cloudflare** guarda os valores da rota anterior ao adicionar a seguinte: conferir os campos antes de salvar.
- **Agente e DNS**: o modo automático do Claude Code barra trocar nameservers e criar rotas no túnel ("DNS / Domain / Cert Changes"), mesmo com autorização no chat. Fora do modo automático, com o usuário autorizando, as rotas foram criadas pelo agente (D40).
- **Validar logo depois de trocar nameservers**: resolvedores públicos (o do Google, por exemplo) ainda devolvem a Hostinger por um tempo e o teste cai no estacionamento. Para validar o que a Cloudflare serve, fixe os IPs com `curl --resolve kapanda.lat:443:<ip da Cloudflare>`.
- **Tag do GTM sem `{{`**: o GTM recusa salvar HTML personalizado com duas chaves seguidas que não formam uma variável. O gerador já evita isso (D40).
- **Redeploy no Portainer** (antes de D41, com o build na VPS): o botão sai de "In progress" por volta dos 4 minutos sem aviso, mas o build segue no servidor (o de 2026-10-19 levou cerca de 9 minutos). Confira o horário de criação dos contêineres antes de achar que falhou.
- **Redeploy que constrói mas não troca os contêineres** (antes de D41): com a notificação `[object Object]`, as imagens novas ficam prontas e os contêineres continuam os antigos (a requisição do Portainer caiu no túnel). Basta clicar de novo: com o cache, termina em segundos. Um `exit code: 1` no `next build` com o mesmo código verde no CI aponta para falta de memória na VPS. Detalhes em [[operacao/problemas-atuais]], item 2.

## Pendências
Problemas em aberto, com causa e solução: [[operacao/problemas-atuais]].

- [x] Senha do admin definida pelo link do log; o usuário entrou no painel (2026-10-19). Conferir se a senha salva não foi a sugerida pelo Chrome.
- [x] Tag do GTM: Tag 42 publicada na versão 12 do contêiner `GTM-KWXQWW6V` (2026-10-19). Já envia visitas: 69 no canal Meta entre a publicação e as 20:10.
- [x] "Pull and redeploy" com a correção do `{{`: stack no `d0dec89` às 20:07 de 2026-10-19, na terceira tentativa. Validação pública com 18 de 18 ok.
- [ ] Configurar com os endereços públicos: fontes de webhook e conta do Meta Ads.
- [ ] Opcional: tirar as rotas `pasio.*` do túnel quando ninguém mais usar o endereço antigo.
- [ ] Critério de aceite da P7.2: um webhook de produção processar um evento de teste e aparecer no painel.
- [ ] Primeiro "Pull and redeploy" com as imagens do GHCR (D41): a stack ainda roda os contêineres do `d0dec89` construídos na VPS. Depois, remover em Images as antigas `trafego-pasio-api`, `trafego-pasio-web` e as `<none>`.
- [ ] SMTP: variáveis salvas em 2026-10-19; falta colar `SMTP_SENHA` (senha de app do Gmail), redeployar e testar "esqueci a senha".
- [ ] Opcional: redeploy automático pela API do Portainer (token como secret do GitHub).
- [ ] Opcional: rotina de backup agendada dos dois volumes.

Relacionado: [[operacao/runbooks]], [[operacao/retomada]], [[operacao/ambiente-e-seguranca]], [[arquitetura/stack]].
