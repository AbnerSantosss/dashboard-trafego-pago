---
tipo: referencia
atualizado: 2026-10-21
tags: [gtech, webhook, basic, preset, cassino, integracao, lgpd, producao]
---

# GTech (plataforma de cassino)

Tudo sobre a ligação entre a plataforma GTech e o painel: o que a GTech envia, como o backoffice é configurado, como os dados viram números e o que ainda falta. O contrato genérico do receptor está em [[ingestao-webhooks/contrato-webhook]], o preset de regras em [[regras-de-tratamento/motor-de-regras]] e a decisão em [[decisoes-tecnicas/decisoes]] (D42). Trabalho feito na sessão de 2026-10-20 ([[log]]).

## Estado (2026-10-21, madrugada)
| Peça | Situação |
|---|---|
| Receptor com autenticação Basic | **em produção**: commit `5ef4829`, CI e Deploy verdes, "Pull and redeploy" às 14:40 com re-pull; `api` e `db` saudáveis, `/health` 200 |
| Fonte `gtech` (nome GTech) | **criada** às 14:47 em Configurações → Webhooks: ativa, com segredo, em `https://api.kapanda.lat/webhooks/pasio/gtech` |
| Regras da fonte | **preset `gtech` na versão 1 ativa**, aplicado pelo usuário no console do `trafego-pasio-api-1` (reprocessou 0 brutos, porque nada tinha chegado) |
| Webhook "Criação de usuário" no backoffice | **pendente**: em 2026-10-21 o formulário foi aberto e preenchido de novo (Nome `kapanda`, URL, BASIC, Usuário `gtech`, Senha vazia) e ainda não foi salvo; falta rotacionar o segredo, colar na Senha e salvar |
| Webhook "Pagamento de Depósito" no backoffice | **pendente**: ainda não criado (seção vazia em 2026-10-21) |
| Teste ponta a ponta no cassino demo | **pendente** |
| `user_id` igual na Tag e na GTech | **não confirmado** |
| Redepósito no Funil de Aquisição | **implementado** em 2026-10-21 (commit `d5569d9`, D43): os depósitos pagos depois do FTD chegam como `deposito` e viram a sexta etapa do funil assim que o primeiro chegar ([[regras-de-tratamento/metricas-e-kpis]]) |

Próximos passos, em ordem, em [[operacao/retomada]].

## A plataforma
- Cassino demo: `latam.gtech.uy/cassino`. Backoffice: `latam.gtech.uy/admin` → Personalizar → Webhook. O login no backoffice é sempre do usuário (o agente não entra com senha).
- Documentação de webhooks: https://globaltechinternacional.tawk.help/article/webhook
- Cada seção do backoffice (Criação de Usuário, Criação de Depósito, Pagamento de Depósito, login etc.) tem a sua lista de webhooks. Cada webhook tem Nome, Status, URL, Tipo de credencial, Usuário e Senha.
- **Tipo de credencial: só BASIC.** Não há HMAC, campo de cabeçalho nem `X-Event-Id`. Por isso o receptor ganhou o modo Basic (D42); antes disso, todo envio da GTech seria recusado com 400.
- Envio: um JSON por requisição, `Content-Type: application/json; charset=utf-8`, com `Authorization: Basic base64(usuário:senha)`.

## Configuração no backoffice
São **dois webhooks**, com os mesmos valores:

| Seção na GTech | Vira no painel |
|---|---|
| Criação de usuário | `cadastro` |
| Pagamento de Depósito | `ftd` (primeiro depósito) ou `deposito` |

| Campo | Valor |
|---|---|
| Nome | livre (o formulário aberto usa `kapanda`) |
| Status | Ativo |
| URL | `https://api.kapanda.lat/webhooks/pasio/gtech` |
| Tipo de credencial | BASIC |
| Usuário | `gtech` (o receptor não confere o usuário; a convenção é o slug da fonte) |
| Senha | o segredo da fonte `gtech` |

- **Onde pegar o segredo**: kapanda.lat → Configurações → Webhooks → linha GTech → Rotacionar segredo → Copiar. O segredo aparece uma vez só. Rotacionar invalida o anterior na hora, sem carência ([[operacao/runbooks]]); se um webhook já estiver salvo com o antigo, ele tem de ser atualizado.
- **O segredo não é a senha do login da GTech nem a do painel.** É uma terceira senha, que só serve para a GTech entregar os dados.
- **Cuidado com o autofill do Chrome**: ele preenche Usuário e Senha do formulário com o login de admin da GTech. Antes de salvar, conferir que o Usuário é `gtech` e que a Senha é o segredo (conferir só o tamanho do campo, nunca ler o valor).
- **Não mexer** nos webhooks que já existem: "Criação de depósito", "login" (aponta para webhook.site) e "Delta latam".
- "Criação de depósito" não precisa ser configurado: é o depósito ainda não pago, e o preset o ignora.

## Eventos e mapeamento
Detalhes e tabela completa em [[regras-de-tratamento/motor-de-regras]], seção Presets.

| Payload da GTech | Evento canônico |
|---|---|
| `USER_CREATED` | `cadastro` |
| `DEPOSIT_PAYMENT` / `PAGAMENTO_DEPÓSITO`, status `PAID`/`PAGO`, `approved_deposits == 1` | `ftd` |
| o mesmo com `approved_deposits > 1` | `deposito` |
| `DEPOSIT_CREATED` (status `PENDENT`) | ignorado, sem erro |
| status não pago ou evento desconhecido | erro / dead-letter, de propósito |

- O nome do campo do tipo muda entre versões da documentação (`event` ou `evento`, com ou sem acento); o preset aceita os dois com `coalesce` e acentos em NFC ou NFD.
- `value` = `amount`, já em reais (sem dividir). `currency` `"R$"` vira `BRL`.
- `lead_key` = `user_id`. UTMs vêm de `tracker.utm_*` (em minúsculas); `affiliate_id` = `tracker.afp`, o que aciona o canal Afiliados.
- **O primeiro depósito gera só `ftd`**: a agregação já soma o valor do FTD em Depósitos; gerar `ftd` e `deposito` contaria em dobro.
- Nenhum dado pessoal é lido pelo preset.

Código: `packages/rules/src/presets/gtech.ts` (`mapeamentoGtech()`), fixtures fictícias em `gtech.fixtures.ts`, testes em `gtech.test.ts` e o ponta a ponta em `apps/api/src/e2e/gtech.test.ts`.

## Como os dados chegam ao painel (ponta a ponta)
1. **Tag do GTM no site** (pasion.bet): lê UTMs e click ids da URL, cria um `visitor_id` e manda por `sendBeacon` para `/t/pasio/clk`. Cada envio vira um toque em `attribution_touches`; a primeira página da sessão vira uma visita.
2. **`user_id` no dataLayer**: quando o site põe o `user_id` do jogador no dataLayer, a Tag reenvia o toque com ele. É isso que liga o navegador ao jogador.
3. **Webhook da GTech**: no cadastro e no depósito pago, a GTech faz POST com Basic. Respostas: 202 (aceito), 200 `duplicado` (reenvio idêntico), 401 `assinatura_invalida` (senha errada), 404 (fonte desconhecida ou inativa), 400 `cabecalho_ausente` (sem Basic e sem HMAC).
4. **Regras**: o worker aplica o preset ativo e grava o evento canônico em `events`.
5. **Cruzamento e canal**: se o `tracker` da GTech traz origem, ela vale; senão, vale o último toque da Tag com o mesmo `user_id`. Prioridade do canal: click id > UTMs > afiliado > "Outros".
6. **Painel**: soma por dia × canal × campanha em `metrics_daily`; com gasto lançado ou vindo do Meta Ads, saem CPA e ROAS.

Arquitetura geral em [[arquitetura/mapa-do-sistema]].

## Como validar quando os webhooks estiverem salvos
1. O usuário abre o cassino demo com `?utm_source=teste&utm_campaign=teste` (a Tag não está instalada no demo, então a origem só vem do `tracker` da GTech) e cria um jogador de teste. Criar conta de jogador é do usuário, não do agente.
2. Em kapanda.lat → Configurações → Instalação, o passo "Plataforma enviando eventos" deve mostrar a entrega com 202, e o passo "Tradução dos eventos", processada.
3. Fazer um depósito de teste e conferir o FTD na Visão Geral e em Leads.
4. Conferir se o `user_id` da GTech é o mesmo que o site põe no dataLayer.
5. Se a entrega aparecer com 401: a Senha do webhook não é o segredo atual (talvez rotacionado depois). Com erro de regra: olhar o motivo no dead-letter e reprocessar depois de corrigir.

Esse teste também cumpre o critério de aceite da P7.2 ([[operacao/producao]]).

## Dados pessoais e cuidados
- **LGPD (decisão em aberto)**: o payload traz e-mail, nome, documento, data de nascimento, `user_token` e `qrcode`. O preset não lê nada disso, mas o bruto inteiro fica em `webhook_events.payload`. Mascarar ou descartar esses campos antes de gravar é decisão do usuário.
- Na wiki, em testes e em commits entram só nomes de campos e fixtures fictícias. Payloads reais ficam fora do repositório (o repositório é público).
- A senha de admin do backoffice foi escrita no chat da sessão de 2026-10-20: **trocar** depois do teste.
- O cabeçalho `authorization` nunca é gravado (redact do log e fora de `webhook_events`).

## Questões abertas
- `is_demo` não é filtrado: jogadores de demonstração contariam. Dá para acrescentar ao `ignorar` do preset, se a PASIO quiser.
- `utm_term`, `utm_content`, `fbp` e `fbc` não têm campo canônico e não são mapeados.
- Se `amount` vier como texto `"1.000"`, o motor lê mil (formato brasileiro). Conferir no primeiro depósito real.
- Sem `X-Event-Id`, a idempotência é pelo hash do corpo: um reenvio idêntico vira `duplicado`, mas um reenvio com corpo diferente contaria duas vezes. Melhoria possível: chave por `event` + `deposit_id`.
- As regras de canal padrão não reconhecem Google nem TikTok por UTM; um toque só com `fbp` não conta como Meta.
- O guia das Configurações sugere "usuário = slug da fonte"; é só convenção, o receptor aceita qualquer usuário.

## Páginas explicativas
- Artifact "Do Clique ao Painel": https://claude.ai/artifact/GppYvHyDpeVeTifHPm5n9T (mapa das duas trilhas, jornada em 8 passos, simulador de crédito, envio, dados, cuidados, estado e glossário; só dados fictícios).
- Versão animada e offline em `C:\Users\binho\Downloads\do-clique-ao-painel.html` (cerca de 250 KB, estilo do hf-kit do Hyperframes, temas claro e escuro). Fica fora do repositório.

Relacionado: [[ingestao-webhooks/contrato-webhook]], [[regras-de-tratamento/motor-de-regras]], [[administracao-multiempresa/configuracao-por-empresa]], [[operacao/runbooks]], [[operacao/problemas-atuais]], [[operacao/retomada]], [[arquitetura/mapa-do-sistema]].
