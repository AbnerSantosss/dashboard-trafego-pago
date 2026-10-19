---
tipo: referencia
atualizado: 2026-10-19
tags: [producao, deploy, portainer, cloudflare, tunel, docker, segredos, backup, kapanda, gtm]
---

# Produção

Tudo o que existe no ar e como mexer nele. Decisões em [[decisoes-tecnicas/decisoes]] D39 (stack e túnel) e D40 (domínio `kapanda.lat`). O passo a passo de uma instalação do zero está em [[operacao/runbooks]], seção Produção. No ar desde 2026-10-16. Desde 2026-10-19 o domínio é `kapanda.lat`; a migração está em [[operacao/deploy-kapanda]].

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
- opcionais, ainda vazias: `ADMIN_NOME`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USUARIO`, `SMTP_SENHA`, `EMAIL_REMETENTE`, `LOG_LEVEL`, `META_GRAPH_VERSAO`, `WEB_PORTA`, `API_PORTA`. A lista comentada está em `deploy/producao.env.example`.

| Contêiner | Imagem | Papel | Porta |
|---|---|---|---|
| `trafego-pasio-segredos-1` | `alpine:3.20` | gera os segredos e sai com código 0 (fica "exited", é o normal) | — |
| `trafego-pasio-db-1` | `postgres:16-alpine` | banco `trafego` | nenhuma publicada |
| `trafego-pasio-api-1` | `trafego-pasio-api:latest` (alvo `api` do `Dockerfile`) | preparo do banco e Fastify | `127.0.0.1:3481` → 3001 |
| `trafego-pasio-web-1` | `trafego-pasio-web:latest` (alvo `web`) | Next.js | `127.0.0.1:3480` → 3000 |

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

## Atualizar
1. Commit e push na `main` (com CI verde).
2. Portainer → Stacks → `trafego-pasio` → **Pull and redeploy**.
3. API e web têm `pull_policy: build`: a imagem é reconstruída a partir do código novo. Sem isso, o Portainer reaproveitaria a imagem antiga. O build leva alguns minutos (o primeiro levou cerca de 4,5).
4. O preparo aplica as migrações novas sozinho na subida da API. Conferir `https://api.kapanda.lat/health` e o login.

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
- **`pull_policy: build`** precisa continuar no compose: foi o próprio Portainer que avisou que, sem ele, o "Pull and redeploy" não reconstrói.
- **Hostname `painel`** já estava em uso no túnel; por isso as rotas são `pasio` e `pasio-api`.
- **Rate-limit** é por visitante (`cf-connecting-ip`, D39). Sem esse cabeçalho, todos chegariam com o IP do gateway do Docker e dividiriam o limite do login (10 por minuto) e da Tag do GTM (120 por minuto).
- **Server actions do Next pelo túnel** (salvar formulários): validadas na stack local, ainda não conferidas em produção. Se um formulário falhar com erro de origem, olhar o log do `trafego-pasio-web-1`.
- **Formulário de rota da Cloudflare** guarda os valores da rota anterior ao adicionar a seguinte: conferir os campos antes de salvar.
- **Agente e DNS**: o modo automático do Claude Code barra trocar nameservers e criar rotas no túnel ("DNS / Domain / Cert Changes"), mesmo com autorização no chat. Fora do modo automático, com o usuário autorizando, as rotas foram criadas pelo agente (D40).
- **Validar logo depois de trocar nameservers**: resolvedores públicos (o do Google, por exemplo) ainda devolvem a Hostinger por um tempo e o teste cai no estacionamento. Para validar o que a Cloudflare serve, fixe os IPs com `curl --resolve kapanda.lat:443:<ip da Cloudflare>`.
- **Tag do GTM sem `{{`**: o GTM recusa salvar HTML personalizado com duas chaves seguidas que não formam uma variável. O gerador já evita isso (D40).
- **Redeploy no Portainer**: o botão sai de "In progress" por volta dos 4 minutos sem aviso, mas o build segue no servidor (o de 2026-10-19 levou cerca de 9 minutos). Confira o horário de criação dos contêineres antes de achar que falhou.

## Pendências
- [ ] O usuário definir a senha do admin pelo link do log (gerado em 2026-10-19 às 19:41) e entrar.
- [x] Tag do GTM: Tag 42 publicada na versão 12 do contêiner `GTM-KWXQWW6V` (2026-10-19).
- [ ] Opcional: "Pull and redeploy" para levar a correção do `{{` à aba Configurações → Tag (a Tag publicada já está corrigida).
- [ ] Configurar com os endereços públicos: fontes de webhook e conta do Meta Ads.
- [ ] Opcional: tirar as rotas `pasio.*` do túnel quando ninguém mais usar o endereço antigo.
- [ ] Critério de aceite da P7.2: um webhook de produção processar um evento de teste e aparecer no painel.
- [ ] Opcional: SMTP nas variáveis da stack, para convites e recuperação de senha por e-mail.
- [ ] Opcional: rotina de backup agendada dos dois volumes.

Relacionado: [[operacao/runbooks]], [[operacao/retomada]], [[operacao/ambiente-e-seguranca]], [[arquitetura/stack]].
