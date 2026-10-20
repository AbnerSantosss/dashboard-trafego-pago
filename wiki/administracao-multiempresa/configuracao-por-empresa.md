---
tipo: especificacao
atualizado: 2026-10-20
tags: [multiempresa, tenant, configuracao, apresentacao, logo, pasio, instalacao, responsividade, basic, gtech]
---

# Configuração por empresa

Cada empresa (tenant) tem quatro áreas de configuração, acessíveis a quem tem papel `admin` nela. Telas em `apps/web/app/(admin)/` (Fase 5).

## 1. Webhooks (fontes) — P5.1
Criar fonte → gera URL `POST /webhooks/{empresa}/{fonte}` e segredo (mostrado uma vez). Ações: rotacionar segredo, ativar/desativar, ver últimos eventos e erros, reenviar. Ver [[ingestao-webhooks/contrato-webhook]]. Plataformas que só aceitam Basic (como a GTech, [[ingestao-webhooks/gtech]]): seção "Plataformas só com autenticação Basic" no fim desta página.

## 2. Regras de tratamento — P5.2
Editor de mapeamento por fonte com simulação e versionamento; lista ordenada de regras de canal; painel de dead-letter com reprocessamento. Ver [[regras-de-tratamento/motor-de-regras]].

## 3. Apresentação — P5.4
| Campo | Padrão | Observação |
|---|---|---|
| Nome exibido | nome da empresa | Aparece na sidebar ao lado do ícone e no título do navegador; **trocável** |
| Ícone / logo | PASIO: `packages/design/brand/pasio-logo.png` (fonte: https://pasion.poker/imagens/20260919_6aaf26189bd87.png); outras empresas: iniciais em tile `--logo` | Upload PNG/SVG até 512 KB. O ícone da PASIO é horizontal (428×135 px); a sidebar exibe o logo com altura fixa de 36 px e largura proporcional, limitada a 148 px; **trocável** |
| KPIs visíveis e ordem | os 5 da imagem | Pode ocultar ou reordenar |
| Colunas da tabela | as 10 da imagem | Pode ocultar e reordenar |
| Canais | Meta, Email, SMS, Afiliados, Outros | Nome, cor e ordem editáveis |
| Paleta | tokens da imagem | Só acentos (tiles e funil) são editáveis; fundo e tipografia são fixos para manter a fidelidade |
| Moeda e fuso | BRL, America/Sao_Paulo | Afetam formatação e fechamento do dia |
| Subtítulo | "Acompanhe os resultados do marketing de forma simples e objetiva." | Texto livre |

Decisão de origem: [[decisoes-tecnicas/decisoes]] D6 (pedido do usuário em 2026-10-15: ícone da PASIO como padrão, mantendo em configurações a troca de ícone e de nome).

## 4. Usuários e papéis — P5.3
Convite por e-mail; papéis `admin` (tudo), `analista` (dashboard + exportar + simular regras), `leitor` (dashboard). Um usuário pode pertencer a várias empresas e troca a empresa ativa no topo da sidebar.

## Onboarding de uma empresa nova
Ver [[operacao/runbooks]]. Resumo: criar tenant → apresentação (nome, logo) → fonte + segredo → regras → simular → enviar evento de teste → conferir no painel.

## Armadilhas
- Logo trocado deve manter o layout da sidebar: altura fixa de 36 px, largura proporcional até 148 px; logos quadrados ficam 36×36 com o nome ao lado, logos horizontais (como o da PASIO) dispensam o nome em texto.
- Alterar o nome exibido não altera o `slug` da URL do webhook.

## Valores da PASIO gravados pelo seed (P2.4, 2026-10-15)
Nome exibido, subtítulo, 5 KPIs na ordem da imagem, 10 colunas e canais com cor em `presentation.channels`: Meta #0070F8, Email #04ADDF, SMS #24CCB6, Afiliados #00C98B, Outros #748BA5 (escolha a partir dos acentos da paleta; o design não define cor por canal, D11). Logo em `/brand/pasio-logo.png`. Usuário inicial `admin@pasio.local` (admin); a senha/login vem do Auth.js na Fase 4/5.

## Papéis na API (P2.2, 2026-10-15)
Implementado em `apps/api/src/auth/plugin.ts` e `src/rotas/auth.ts` (ver `apps/api/README.md`, seção "Autenticação e empresa ativa"). Hierarquia admin > analista > leitor, aplicada por `app.exigirPapel`. Toda consulta por empresa roda em `request.comTenant(fn)`, sob RLS. Rotas: `GET /me` (usuário, empresas com papel, empresa ativa), `POST /me/empresa` (troca de empresa ativa, devolve token novo), `GET /empresas/atual`. Erros: 401 `nao_autenticado`/`token_invalido`, 403 `acesso_negado`, 400 `empresa_nao_informada`. Decisão D12. Testes de isolamento em `src/auth/plugin.test.ts` (embrião do gate G2).

## Implementado na Fase 5 enxuta (2026-10-15)
Telas em `apps/web/app/(admin)/configuracoes/` (abas Apresentação e Webhooks, acesso por `/configuracoes` ou pelo link na Ajuda). Rotas em `apps/api/src/admin/`, todas com papel `admin` (detalhes em `apps/api/docs/admin.md`):
- `GET`/`PATCH /empresas/atual/apresentacao`: nome exibido (até 60) e logo PNG/SVG até 512 KB, guardado no banco como data URL; `logo: null` volta ao padrão (PASIO: `/brand/pasio-logo.png`; outras: nome em texto). O PATCH limpa o cache de métricas; o painel reflete ao recarregar.
- `GET`/`POST /empresas/atual/fontes`, `PATCH /empresas/atual/fontes/:id` (nome, ativo), `POST /empresas/atual/fontes/:id/segredo` (rotação). O segredo aparece uma vez na resposta e na tela, com botão copiar.
- Ficaram fora (D15): regras, KPIs/colunas/canais/paleta, usuários e convites. Papéis continuam via seed/SQL.
- Armadilha: trocar `WEBHOOK_CHAVE_CIFRA` exige rotacionar todas as fontes (D18).

## Perfil, usuários e tag GTM (2026-10-16)
Abas atuais em `/configuracoes`: Perfil, Usuários, Tag GTM, Webhooks, Apresentação.
- **Perfil**: nome, sobrenome, troca de senha (exige a atual) e lista de empresas e papéis; botão Sair.
- **Usuários** (só admin): convidar por e-mail com papel (leitor só acompanha, analista, admin); mudar papel, remover membro, cancelar convite. Ninguém muda o próprio acesso. O convite mostra o link para copiar além do e-mail.
- **Tag GTM**: código para HTML personalizado com acionador All Pages; envia para `POST /t/{empresa}/clk`. Ver D21.
- **Webhooks**: a plataforma manda cadastro, FTD e depósito (redepósito também é `deposito`) com o mesmo `user_id` do dataLayer.
- Contas: telas `/login`, `/redefinir` e `/convite` em `apps/web/app/(conta)/`; cookie de sessão e middleware em D20.
- Armadilha: o admin do seed (`admin@pasio.local`) não recebe e-mail; para testar o login real, convide um e-mail de verdade.

## Instalação, layout fluido e confirmação (2026-10-16)
Abas atuais, nesta ordem: **Instalação**, Perfil, Usuários, Tag GTM, Webhooks, Apresentação. O endereço `/configuracoes` ainda redireciona para Perfil.

### Aba Instalação: passo a passo para colocar o painel no ar
Tela em `apps/web/app/(admin)/configuracoes/instalacao/`, com título "Coloque o painel para funcionar" e contagem de passos feitos. Cada passo mostra o estado, uma frase com dados reais e, quando cabe, um valor com botão de copiar (`Copiavel.tsx`) e um link para a aba onde se resolve. Os sete passos, na ordem:
1. **Endereço público da API**: o servidor e o endereço que a plataforma e a tag usam (`WEBHOOK_URL_PUBLICA`). Sem ele, o passo fica em atenção.
2. **Nome e logo da empresa**: a Apresentação.
3. **Fonte de webhook**: uma fonte ativa com segredo utilizável. Fica em atenção se a fonte existe sem segredo.
4. **Tag no Google Tag Manager**: o código da aba Tag GTM. Fica sempre como **manual**, porque não dá para conferir daqui.
5. **Plataforma enviando eventos**: as últimas entregas das fontes ativas, com data e hora no fuso da empresa.
6. **Tradução dos eventos**: as regras. Entregas processadas contam como feito; entregas com erro, como atenção.
7. **Equipe com acesso**: membros e convites.

O estado sai de `montarPassos()` em `apps/web/lib/instalacao.ts`, uma função pura testada em `apps/web/testes/instalacao.test.ts`, e vale um destes quatro:
- `feito`: dado lido e certo.
- `atencao`: falta uma ação do admin.
- `pendente`: ainda não começou ou não deu para ler.
- `manual`: só a pessoa pode conferir.

Quando a página não consegue ler um dado (API fora do ar, sem permissão), a situação vira "Não foi possível conferir agora." e o passo **nunca** aparece como concluído. O passo manual não entra na contagem de feitos. Ver D28 em [[decisoes-tecnicas/decisoes]].

### Layout fluido e tipografia
- Casca em grid: coluna de 181 px com a sidebar fixa ao rolar, mais o conteúdo fluido. Abaixo de 48em a navegação vira barra superior e as abas rolam na horizontal.
- No celular as tabelas viram cartões: o cabeçalho fica só para leitor de tela e cada célula mostra seu rótulo (`data-rotulo`). A tabela da Instalação não muda.
- Quatro tamanhos de texto (`--cfg-fs-titulo`, `-sub`, `-corpo`, `-micro`), alvos de toque de 48 px no celular e 40 px no desktop, campos com 16 px ou mais. Cada aba abre com um h2 próprio, que aparece também na tela de erro.
- Erros e avisos usam os tokens `--p-erro-*` e `--p-aviso`. Ver D22, D23 e D26.

### Ações destrutivas
Remover membro, cancelar convite, rotacionar ou gerar segredo e remover logo passam por `BotaoConfirmar` (`Confirmar.tsx`): um `<dialog>` modal com a consequência escrita, Cancelar e um botão de perigo que envia o formulário. Esc e clique no fundo fecham sem enviar. Ver D25.

### Armadilhas
- Salvar a Apresentação chama `revalidatePath('/', 'layout')`, então a marca muda também nas telas em construção (D27).
- Conferir no navegador o diálogo de confirmação e as abas Perfil e Tag; até agora só foram conferidos por HTML e testes.

## Gastos e Meta Ads (2026-10-16)
- **Configurações → Gastos** (`/configuracoes/gastos`, papel analista ou admin): lançamento manual de gasto (data, canal, campanha, valor em reais, observação), lista dos últimos 30 dias, 90 dias ou 12 meses, com total e soma por canal. Remover só vale para gasto manual. O item "Gestão de Custos" da sidebar leva para cá.
- **Configurações → Meta Ads** (`/configuracoes/meta-ads`, só admin): conectar conta de anúncios com ID e token de usuário do sistema (`ads_read`). Ao conectar, lê 30 dias; depois a API relê os últimos 3 dias de hora em hora. Botões: Sincronizar, Pausar/Retomar, Trocar token e Desconectar (apaga o gasto lido da conta). Passo a passo do token em [[operacao/runbooks]].
- Todo gasto entra no **Investimento** do painel, no dia e canal informados (D31).

### Armadilhas
- Na empresa demo, lançar ou sincronizar gasto num dia reagrega esse dia a partir de eventos e custos e apaga os números de demonstração dele (o seed grava direto em `metrics_daily`).
- Se um webhook também mandar evento `gasto` no canal Meta, o gasto conta duas vezes. Use uma das duas fontes por canal.
- Não há conversão de moeda: uma conta em USD soma como se fosse BRL. A tela avisa.
- Trocar o canal de uma conta não move o gasto já gravado: sincronize de novo.

## Instalação com submenu (2026-10-16)
- Tag GTM, Webhooks e Meta Ads ficam dentro de Instalação, num submenu de botões: Visão geral, Tag do GTM, Webhooks e Meta Ads. As rotas não mudaram (`/configuracoes/tag`, `/webhooks` e `/meta-ads`), e a aba Instalação fica marcada nas quatro.
- Cada uma começa com um passo a passo numerado (`Guia.tsx`, textos em `guias.tsx`) e depois mostra o painel de configuração.
- Para mudar um texto do guia, edite `guias.tsx`. O exemplo de envio assinado continua na Visão geral, no passo da plataforma.
- Desktop: as Configurações usam a mesma moldura e escala do painel (D33).

## Plataformas só com autenticação Basic (2026-10-20, D42)
O receptor aceita `Authorization: Basic` com a senha = segredo da fonte ([[ingestao-webhooks/contrato-webhook]]). A interface explica isso em três lugares:
- **Webhooks** (`webhooks/PainelWebhooks.tsx`): a caixa do segredo, que aparece uma vez, ganhou a linha "Plataforma só com autenticação Basic (ex.: GTech): usuário `<slug>`, senha = este segredo". Abaixo da tabela de fontes há o bloco recolhível `<details className="cfg-ajuda">` "Plataforma que só aceita autenticação Basic (ex.: GTech)", com a tabela Fonte | URL | Tipo de credencial | Usuário | Senha de cada fonte (a coluna Senha só diz "Segredo da fonte", nunca mostra o valor, e pede um segredo novo quando a fonte não tem um utilizável). Teste em `apps/web/testes/webhooks-basic.test.tsx`.
- **Guia da aba Webhooks** (`guias.tsx`): um passo cita o Basic.
- **Instalação** (`instalacao/page.tsx`): no passo da plataforma, depois do exemplo HMAC, o exemplo `curl -u "slug-da-fonte:$SEGREDO_DA_FONTE"`, e a explicação do 401 inclui "senha Basic".

Primeiro uso real: a fonte `gtech` em produção ([[ingestao-webhooks/gtech]]).

### Armadilhas
- O guia e a Instalação dizem "usuário = slug da fonte", mas é só convenção: o receptor não confere o usuário. O bloco recolhível já diz isso ("O usuário pode ser qualquer um; sugerimos o slug").
- O `summary` do bloco `.cfg-ajuda` não tem setinha de abrir e fechar; ajuste visual pendente.
- Rotacionar o segredo derruba na hora o emissor que usa o antigo, também no modo Basic.
