---
tipo: operacao
atualizado: 2026-10-21
tags: [runbook, onboarding, segredo, reprocessamento, dead-letter, basic, preset, gtech, duas-etapas, totp, bloqueio]
---

# Runbooks

Esboço; cada runbook ganha passos exatos quando a funcionalidade existir (Fase 5 e 6).

## Onboarding de empresa
1. Admin global cria o tenant (slug, nome, moeda, fuso).
2. Apresentação: nome exibido e logo (PASIO já vem com o ícone oficial). Ver [[administracao-multiempresa/configuracao-por-empresa]].
3. Cria a primeira fonte; copia URL e segredo para o sistema emissor.
4. Configura regras de mapeamento e canal; valida com a simulação.
5. Envia evento de teste com `webhook-sim`; confere no painel.
6. Convida usuários com papéis.

## Rotação de segredo
Configurações → Webhooks → "Rotacionar segredo" (ou "Gerar segredo", quando a fonte não tem segredo utilizável) → confirmar no diálogo (D25) → copiar o segredo novo, exibido uma única vez → atualizar a plataforma emissora.

**Não há período de graça:** o segredo antigo deixa de valer no clique. Até a plataforma receber o novo, os eventos dela são recusados com 401 e aparecem nas entregas da fonte (aba Instalação, passo "regras"). Faça a troca quando a plataforma puder ser atualizada logo em seguida. Ter dois segredos válidos ao mesmo tempo é uma melhoria pendente ([[operacao/retomada]]).

## Conectar uma plataforma que só aceita Basic (ex.: GTech)
1. Configurações → Webhooks → criar a fonte (ex.: slug `gtech`) e copiar o segredo, que aparece uma vez só. Se ele se perdeu, "Rotacionar segredo" gera outro.
2. No sistema emissor, para cada evento que interessa: URL `https://api.kapanda.lat/webhooks/pasio/<fonte>`, credencial **BASIC**, Usuário livre (convenção: o slug), Senha = o segredo.
3. Ativar as regras da fonte (próximo runbook, se houver preset; senão, mapeamento próprio em [[regras-de-tratamento/motor-de-regras]]).
4. Teste manual: `curl -u <fonte>:<segredo> -H 'content-type: application/json' -d @evento-ficticio.json https://api.kapanda.lat/webhooks/pasio/<fonte>` → 202; o mesmo corpo de novo → 200 `duplicado`; senha errada → 401.
5. Conferir em Configurações → Instalação os passos "Plataforma enviando eventos" e "Tradução dos eventos".

- Navegador com autofill: confira que o Usuário e a Senha do formulário do emissor não foram trocados pelo login salvo do próprio emissor.
- Caso real e pendências: [[ingestao-webhooks/gtech]]. Contrato: [[ingestao-webhooks/contrato-webhook]].

## Ativar um preset de regras numa fonte
Presets ficam em `packages/rules/src/presets/` (hoje só `gtech`). Em produção, o agente não tem acesso ao console; quem roda é o usuário.
1. Portainer → Containers → `trafego-pasio-api-1` → Console → `/bin/sh` → Connect.
2. Rodar:
   ```sh
   cd /app/apps/api && node --import tsx --import ./src/segredos-do-servidor.ts src/rules/aplicar-preset.ts --empresa pasio --fonte gtech --preset gtech --reprocessar
   ```
3. Saída esperada: `preset "gtech" publicado como versão N ativa de pasio/gtech` e quantos brutos foram reprocessados. Rodar de novo sem mudança no preset não cria versão nova.
4. `--reprocessar` aplica a versão ativa aos brutos já recebidos, então a ordem entre salvar o webhook no emissor e ativar o preset não importa.

Em 2026-10-20 este comando publicou a versão 1 de `pasio/gtech` e reprocessou 0 brutos.

## Token do Meta Ads
1. No Gerenciador de Negócios: Configurações do negócio → Usuários do sistema → criar ou escolher um usuário do sistema.
2. Dar a ele acesso à conta de anúncios (ao menos visualização).
3. "Gerar novo token", com a permissão `ads_read` e validade "nunca expira".
4. No painel: Configurações → Meta Ads → colar o ID da conta (`act_…` ou só os números) e o token → Conectar.
- O token fica só cifrado no banco; nunca vai para log, wiki ou commit. Se o Meta recusar (erro 190, token expirado), a conta mostra o erro na coluna Situação: use "Trocar token".
- Versão da Graph API: `v23.0`, trocável por `META_GRAPH_VERSAO`.

## Reprocessamento
Publicar nova versão de regras → escolher intervalo ou fonte → confirmar → job em lote recalcula `events` e `metrics_daily` do intervalo. Monitorar progresso na tela de dead-letter.

## Dead-letter
Lista de `webhook_events` com status `erro`, motivo e payload. Ações: reprocessar com a versão atual, marcar como ignorado, exportar.

## Ambiente local
```
docker compose up -d      # PostgreSQL
pnpm install
pnpm db:migrate && pnpm db:seed   # empresa demo com os dados da imagem
pnpm dev                  # web em :3000, api em :3001
```
Variáveis em `.env.example` (sem valores). Nenhum segredo no repositório ([[decisoes-tecnicas/decisoes]] D8).

Variante usada em 2026-10-21 com o túnel fora: banco do compose em `127.0.0.1:5460`, `pnpm db:migrate` com `DATABASE_URL` e `DATABASE_ADMIN_URL` de `.env.example`, API com `API_PORT=3011` e `WEB_URL=http://localhost:3000`, web com `next dev -p 3000` e `API_URL=http://localhost:3011`, e um `AUTH_SECRET` local fora do repositório. Se a API cair com `ECONNREFUSED` na 5460, o Docker Desktop reiniciou e o banco ficou parado ([[operacao/problemas-atuais]], item 11).

## Desligar a verificação em duas etapas de um usuário (perdeu o celular)
Ainda não há códigos de recuperação (D45). Quem ligou a verificação em duas etapas e perdeu o app autenticador não consegue entrar, nem pelo "Esqueci minha senha": o link troca a senha, mas a sessão só abre com o código.
1. Confirmar por outro canal que o pedido vem mesmo da pessoa dona da conta.
2. Portainer → Containers → `trafego-pasio-db-1` → Console → `psql -U postgres -d trafego`.
3. `UPDATE users SET totp_segredo_enc = NULL, totp_ativo_em = NULL, totp_ultimo_passo = NULL WHERE lower(email) = lower('<e-mail da pessoa>');` (tem de responder `UPDATE 1`).
4. A pessoa entra só com e-mail e senha e, se quiser, liga de novo em Configurações → Perfil, com um app novo. O segredo antigo fica inútil: o QR novo gera outro.

Outros bloqueios do login, que passam sozinhos: 10 senhas erradas em 15 min travam a conta por 15 min; 5 códigos errados em 1 hora travam o código daquela conta por 1 hora. Os dois ficam na memória da API, então reiniciar `trafego-pasio-api-1` também libera.

## Produção (Portainer + túnel Cloudflare)
Arquivos: `Dockerfile` (alvos `api` e `web`), `docker-compose.prod.yml` (segredos, db, api, web) e `deploy/producao.env.example` (lista de variáveis). Decisão em [[decisoes-tecnicas/decisoes]] D39. O que já está no ar (endereços, contêineres, senha do admin, backup e armadilhas) fica em [[operacao/producao]]; esta seção é a instalação do zero.

1. Nenhum segredo para gerar ou colar: na primeira subida, o serviço `segredos` cria as senhas do banco, o `AUTH_SECRET` e a chave de cifra no volume `segredos`, e as subidas seguintes reaproveitam esses arquivos.
2. Portainer → ambiente `local` → Stacks → Add stack → **Repository**: URL do repositório público, referência `refs/heads/main`, compose `docker-compose.prod.yml`. Em Environment variables, preencher `WEB_URL`, `WEBHOOK_URL_PUBLICA`, `ADMIN_EMAIL` (e SMTP, se houver). Deploy (o primeiro build leva alguns minutos).
3. A API sobe pelo preparo `src/db/producao.ts`: migrações, `app_user` com LOGIN e senha, empresa PASIO (sem dados de exemplo) e o admin de `ADMIN_EMAIL`. Enquanto o admin não tem senha, o log do contêiner `api` traz um link de 1 hora para defini-la; reiniciar o contêiner gera outro.
4. Cloudflare → Networking → Tunnels → `servidor-abner` → Routes → Add route → Published application: o hostname do painel para `http://localhost:3480` e o da API para `http://localhost:3481` (hoje `pasio.proxserverabner.site` e `pasio-api.proxserverabner.site`; o DNS é criado sozinho) (portas trocáveis por `WEB_PORTA` e `API_PORTA`). O cloudflared roda no host, por isso as portas ficam só em `127.0.0.1`.
5. Conferir: `https://<api>/health` responde, `/login` abre, o link do log define a senha e o painel entra.

Atualizar: Portainer → stack → **Pull and redeploy** (rebuild das imagens a partir da `main`). Os dados ficam nos volumes `pgdata` e `segredos` da stack, e o backup leva **os dois**: sem a chave de cifra, os segredos de webhook e os tokens do Meta gravados no banco não abrem. Apagar o volume `segredos` com o banco já criado deixa a API sem acesso a ele.

Relacionado: [[ingestao-webhooks/contrato-webhook]], [[ingestao-webhooks/gtech]], [[arquitetura/stack]], [[operacao/producao]].
