---
tipo: plano
atualizado: 2026-10-19
tags: [producao, deploy, kapanda, cloudflare, tunel, hostinger, dns, gtm, orquestracao]
---

# Deploy em kapanda.lat (P7.2, domínio próprio)

Plano e execução da passagem do painel para o domínio `kapanda.lat`. Decisão em [[decisoes-tecnicas/decisoes]] D40. O que fica no ar depois está em [[operacao/producao]].

## Situação de partida (2026-10-19)
- Painel no ar desde 2026-10-16 em `pasio.proxserverabner.site` (stack `trafego-pasio` no Portainer, túnel `servidor-abner` com o cloudflared no host). API saudável.
- `kapanda.lat` registrado na Hostinger, com o DNS autoritativo na própria Hostinger (`lunar`/`solar.dns-parking.com`). A zona só tem o estacionamento: A da raiz em `2.57.91.91` e `www` em CNAME para a raiz. Não há MX nem TXT, então nenhum e-mail depende dela.
- A Tag do GTM é gerada a partir de `WEBHOOK_URL_PUBLICA` (`apps/web/lib/tag-gtm.ts`) e não leva segredo. O endereço de coleta é `https://api.kapanda.lat/t/pasio/clk`.

## Decisões
1. **A mesma stack muda de domínio**: nada de criar uma segunda instância. `trafego-pasio` passa a ter `WEB_URL=https://kapanda.lat` e `WEBHOOK_URL_PUBLICA=https://api.kapanda.lat`, e banco, volumes e segredos ficam como estão. As rotas antigas `pasio.*` continuam no túnel como apelido; dá para removê-las depois.
2. **DNS autoritativo na Cloudflare**: a zona `kapanda.lat` entra na Cloudflare (plano Free) e os nameservers na Hostinger passam a ser os que a Cloudflare indicar. O túnel publica nomes só de zonas da própria conta, e a configuração parcial por CNAME exige plano pago. O A de estacionamento sai, porque a raiz passa a ser um CNAME do túnel.
3. **Rotas no túnel `servidor-abner`**: `kapanda.lat` e `www.kapanda.lat` → `http://localhost:3480`, e `api.kapanda.lat` → `http://localhost:3481`. Uma regra de redirecionamento leva `www` para a raiz.
4. **HTTPS**: a Cloudflare emite o certificado universal (raiz e `*.kapanda.lat`), com "Always Use HTTPS" ligado e TLS mínimo 1.2. Entre a Cloudflare e o servidor o tráfego vai pelo túnel; as portas seguem só em `127.0.0.1`.
5. **Admin novo**: `ADMIN_EMAIL` passa a ser o e-mail informado pelo usuário, que fica só na variável da stack (o repositório é público). O preparo cria o usuário e o liga à PASIO como admin, e a senha é definida pelo link de 1 hora do log. O admin anterior continua: nenhum usuário é apagado.
6. **Tag no GTM do usuário**: uma Tag HTML personalizada em todas as páginas (contêiner 265624554, workspace 12). Ela só é publicada depois que `api.kapanda.lat` responder, e só se o workspace não tiver outras mudanças pendentes de terceiros.

## Orquestração
O orquestrador (a sessão principal) despacha subagentes, cada um com uma área própria, e confere o resultado de cada etapa antes da seguinte.

| Agente | Onde atua | Faz | Depende de |
|---|---|---|---|
| `dns-cloudflare` | Cloudflare e Hostinger (navegador) | zona, nameservers, rotas do túnel, SSL, redirecionamento do `www` | — |
| `portainer` | Portainer (navegador) | variáveis da stack, Pull and redeploy, link do admin, senha | — |
| `gtm` | API do Tag Manager (MCP) | levantamento, criação ou atualização da Tag, sem publicar | — |
| `validacao` | terminal e navegador | testes públicos: saúde, login, painel, coleta da Tag, cabeçalhos HTTPS | os três acima |
| orquestrador | GTM e wiki | publicação da Tag e registro na wiki | validação |

Regras comuns: o navegador é compartilhado e cada agente usa só a sua aba. Nenhuma configuração que já existe é apagada. Nenhuma senha, token ou e-mail do admin vai para log, wiki ou commit. Qualquer passo destrutivo fora do previsto volta para o orquestrador.

## Execução
Horários em BRT, 2026-10-19.

**Cloudflare (agente `dns-cloudflare`)**
- Zona `kapanda.lat` criada no plano Free. A Cloudflare atribuiu os nameservers `eva.ns.cloudflare.com` e `joel.ns.cloudflare.com`. Os dois registros de estacionamento que ela importou da Hostinger (A da raiz e CNAME do `www`) saíram da zona, que fica só com as rotas do túnel.
- "Always Use HTTPS" ligado, TLS mínimo de 1.0 para 1.2, modo SSL Full mantido.
- Redirect Rule: `www.kapanda.lat` → `https://kapanda.lat`, mesmo caminho, 301, preservando a query string.
- DNSSEC confirmado como desligado na Hostinger (sem DS), por isso a troca de nameservers não derruba a resolução. Os registros da Hostinger ficaram intactos.
- **Barrado pelo Claude Code**: o classificador do modo automático (categoria "DNS / Domain / Cert Changes") recusou salvar os nameservers na Hostinger e criar as rotas no túnel. Recusou também com o usuário autorizando no chat. O usuário trocou os nameservers na Hostinger.
- Rotas criadas às 19:35, com o usuário autorizando no chat e o navegador já fora do modo automático: `www.kapanda.lat` e `kapanda.lat` → `http://localhost:3480`, `api.kapanda.lat` → `http://localhost:3481`. A Cloudflare criou os CNAMEs para o túnel. Nenhuma das rotas que já existiam foi tocada.

**Portainer (agente `portainer`)**
- Antes: stack de 2026-10-16 (commit `e71438c`), db e api saudáveis, web no ar. O contêiner `segredos` não existia mais; os volumes `pgdata` e `segredos` estavam lá.
- Variáveis alteradas, só estas: `WEB_URL=https://kapanda.lat`, `WEBHOOK_URL_PUBLICA=https://api.kapanda.lat` e `ADMIN_EMAIL` (o e-mail informado, que fica só no Portainer). O "Pull and redeploy" só libera depois de "Save settings".
- Redeploy com "Re-pull image": das 17:48 às 17:57, cerca de 9 minutos (imagem da API às 17:50, do web às 17:54). Por volta dos 4 minutos, o botão sai de "In progress" sem aviso nenhum, mas o servidor termina o trabalho. Commit da stack: `f33ddc9`.
- Depois: db e api saudáveis, web no ar, `segredos` com saída 0 e nenhum reinício. Nos logs não há erro.
- Preparo: migrações, `app_user`, PASIO "já existia; admin ok" e o link de 1 hora da senha do novo admin (gerado às 17:57). O admin anterior continua.
- Nos eventos do Docker apareceram falhas em outras stacks, que ninguém tocou: `telahub-novo-backend-1` reiniciando e `aven-tunnel` caindo e subindo.

**GTM (agente `gtm`)**
- Contêiner `GTM-KWXQWW6V` ("[WEB] - PASION BT"), workspace 12. A versão publicada era a v11.
- Tag 42 criada, sem publicar: "Painel PASIO - Atribuição (kapanda.lat)", HTML personalizado, gatilho All Pages (`2147479553`), uma vez por evento, endpoint `https://api.kapanda.lat/t/pasio/clk`. No workspace, a única mudança pendente é ela.
- A API do GTM recusou a primeira versão com 400 `INVALID_ARGUMENT`. O motivo era o `'{{'` literal no código, que o GTM lê como variável sem fechamento. A Tag subiu com `'{' + '{'`, e o gerador (`apps/web/lib/tag-gtm.ts`) foi corrigido, com um teste que garante que não sobram duas chaves seguidas.
- Publicada às 19:40, depois que `api.kapanda.lat` respondeu: versão 12 "Painel PASIO - Atribuição (kapanda.lat)". Antes de criar a versão, o workspace tinha só a Tag 42 como mudança; a v11 tinha 18 tags e a v12 tem 19. O usuário confirmou que a Tag fica publicada.

**Admin**: o link de 17:57 venceu sem uso. Às 19:41 o contêiner `trafego-pasio-api-1` foi reiniciado pelo Portainer e o preparo imprimiu um link novo de 1 hora, que o usuário abre pelos logs para definir a senha.

**Validação**: `validar-kapanda.sh` confere pelo DoH da Cloudflare:
- NS da zona;
- `http` → `https`, raiz → `/login`, `/login` e `/redefinir` 200, `www` → raiz;
- certificados válidos e TLS 1.1 recusado;
- `/health` ok, `sessao-dev` 404, CORS com `https://kapanda.lat`, webhook sem assinatura e login vazio recusados;
- OPTIONS e POST de `/t/pasio/clk` com 204;
- o endereço antigo `pasio.*` no ar.

Resultado às 19:39, com os IPs da Cloudflare fixos no curl (`--resolve`): 17 de 18 ok. O que falhou foi o NS lido pelo DoH da Cloudflare, que ainda tinha em cache os da Hostinger. Consultados direto no registro (`a.nic.lat`) e na zona (`eva.ns.cloudflare.com`), os nameservers já são `eva` e `joel.ns.cloudflare.com`.

Propagação: o DNS do Google ainda respondia com os nameservers da Hostinger, então parte dos pedidos caía no estacionamento (`http` com 200 em vez de 301, `/health` sem resposta). Por isso a validação final fixou os IPs da Cloudflare. Esse resto de cache some sozinho com o TTL.

Relacionado: [[operacao/producao]], [[operacao/runbooks]], [[operacao/retomada]], [[orquestracao-agentes/agentes-e-fases]].
