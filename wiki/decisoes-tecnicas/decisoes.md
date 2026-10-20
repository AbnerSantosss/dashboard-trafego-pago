---
tipo: decisao
atualizado: 2026-10-20
tags: [adr, decisoes]
---

# Registro de decisões

Formato: contexto, decisão, motivo, consequências. Correção vale mais que acréscimo: se uma decisão mudar, edite aqui e registre no [[log]].

## D1 — Planejar antes de implementar, e rodar /gera-wiki antes de executar (2026-10-15)
- Pedido explícito do usuário. Gate G0: nenhuma tarefa começa sem `wiki/index.md` e `wiki/log.md`.
- Consequência: toda entrega relevante gera página ou entrada de log.

## D2 — Stack Next.js + Fastify + PostgreSQL (2026-10-15)
- Aprovada pelo usuário. Alternativa Python descartada. Ver [[arquitetura/stack]].

## D3 — Hyperframes só como doutrina (2026-10-15)
- Hyperframes é framework de vídeo. Usamos o contrato de animação (GSAP, seek-safe, sem layout shift, reduced-motion) e o catálogo de blocos de gráfico como referência. Nunca rodar `hyperframes init/publish/cloud/lambda` neste projeto.
- Wiki de referência: `C:\Users\binho\Documents\Projetos de IA\Obsidian\Especialistas\18 - Hyperframes\wiki\`.

## D4 — Fidelidade visual com gate e diff automatizado (2026-10-15)
- Protótipo estático antes do React; diff ≤ 2% dos pixels a 1315 px; regressão visual no CI; aprovação final do usuário. Ver [[qa-visual/fidelidade-visual]].

## D5 — Ícones da biblioteca Tabler (SVG); raster só com confirmação (2026-10-15)
- **Revisão 2026-10-15 (vale sobre o resto desta decisão):** o usuário pediu primeiro que toda geração de ícones e imagens passasse pela muapi; diante do custo e da perda de nitidez de ícones raster, mudou para "pode ser em SVG, veja alguma biblioteca". Escolhida a **@tabler/icons 3.49.0 (MIT)**: tem variante filled para os ícones que a imagem mostra cheios e o traço outline é o mesmo estilo do Lucide. Os 23 ícones são gerados por `packages/design/scripts/gerar-icones.mjs` (`pnpm --filter @trafego/design icones`), que normaliza viewBox 24, `currentColor` e traço 1,75; o mapa nome-da-tela → ícone do Tabler fica no script e no `icons/README.md`. Os SVGs desenhados à mão foram substituídos. Nenhuma geração por IA para ícones.
- Texto original: SVG à mão (base Lucide/Tabler) é o padrão. Raster só com stable-diffusion local (grátis) ou Nano Banana 2 Lite (US$ 0,034) após confirmação do usuário.
- Atualização 2026-10-15: o usuário informou que, das APIs de imagem, **só a muapi está funcionando**, com saldo de **US$ 3**. kie.ai e OpenRouter estão fora até aviso. Qualquer raster pago passa pela muapi, com o modelo mais barato, após confirmação explícita, e o saldo gasto deve ser anotado no [[log]]. A Fase 1 não gastou nada: todos os ícones saíram em SVG.

## D6 — PASIO é a primeira empresa; ícone e nome trocáveis (2026-10-15)
- O usuário enviou o ícone oficial da PASIO (`https://pasion.poker/imagens/20260919_6aaf26189bd87.png`, PNG 428×135 px, 44 KB, formato horizontal). Ele é o logo padrão da empresa PASIO (`packages/design/brand/pasio-logo.png`) e substitui o quadrado roxo "Logo" da imagem de referência na sidebar.
- A configuração de apresentação por empresa (P5.4) mantém a troca de ícone e de nome exibido. Ver [[administracao-multiempresa/configuracao-por-empresa]].

## D7 — Um escritor por conjunto de arquivos (2026-10-15)
- Cada subagente escreve só na sua área; integração por PR revisado pelo orquestrador. Ver [[orquestracao-agentes/agentes-e-fases]].

## D8 — Segredos nunca no repositório (2026-10-15)
- Nenhuma chave de API (OpenRouter, kie.ai, muapi, banco) em código, wiki, log ou artifact. `.env.example` sem valores.

## D9 — Repositório público no GitHub desde o início; deploy via Portainer e túnel Cloudflare ao final (2026-10-15)
- Pedido do usuário: "apenas quando finalizar tudo", publicar o repositório no GitHub de forma segura; disse que pode ser privado e depois corrigiu: **"nesse início deixe público"**, para o Portainer e a Cloudflare puxarem o repositório sem deploy key (2026-10-15); puxar a stack no Portainer (`https://portainer.proxserverabner.site`) e criar um túnel na Cloudflare (conta `fb20af5d…`) para deixar o painel online.
- Repositório criado em 2026-10-15: `https://github.com/AbnerSantosss/dashboard-trafego-pago` (público), após varredura de segredos no histórico (limpa). Pode virar privado depois; aí o Portainer passa a precisar de token só de leitura. Deploy e túnel ficam para a fase 7 (P7.2), depois do gate G4, e cada passo externo (criar repositório, deploy, túnel) pede confirmação no momento de executar.
- Segurança em repositório público: `.env` e `registro/` já fora do git; varrer o histórico por segredos antes do `push`; segredos de produção só em variáveis do Portainer; o segredo de cada webhook e o token do túnel nunca entram no repositório. O usuário aceitou que o logo da PASIO e a imagem de referência fiquem públicos.
- Ferramentas já presentes na máquina em 2026-10-15: `gh` 2.100 autenticado (conta AbnerSantosss), `docker` 29.7, `cloudflared` 2026.8.2. Falta: Dockerfile de produção para `apps/web` e `apps/api`, `docker-compose.prod.yml` para o Portainer (web, api, postgres, cloudflared), e o túnel (`cloudflared tunnel create` + rota do hostname, ou túnel gerenciado pelo painel com token em variável do Portainer).
- Atualização (2026-10-16): a produção seguiu outro caminho em parte, registrado em D39. Os segredos são gerados no próprio servidor em vez de ficarem nas variáveis do Portainer, e a stack não tem cloudflared, porque o túnel `servidor-abner` já roda no host.

## D10 — Gate G1 aceito com diff de 4,18% (2026-10-15)
- Contexto: o protótipo estático fechou em 4,178% contra os 2% do gate. O `diff.png` mostra só contorno de glifos, bordas de 1 px e ícones; layout, cores e posições batem. A fonte da imagem é ~15% mais estreita que Inter/Segoe UI e nenhuma fonte disponível reduziu o diff (ver [[qa-visual/fidelidade-visual]]).
- Decisão do usuário: "Aceite 4,18% como gate G1 (o resto é texto)". G1 cumprido; Fase 2 liberada.
- Consequências: o limiar de 2% continua valendo para a regressão visual do React contra o **protótipo** (P6.3), que usa a mesma fonte; contra a imagem original o critério passa a ser "diff ≤ 4,5% e diferença só em texto". Se aparecer uma fonte que case com a imagem, recalibrar e voltar a 2%.

## D11 — Funil em canal reservado `__funil__`, coluna `base_contatada`, logo em `/brand/pasio-logo.png` (2026-10-15)
- Contexto: os números do funil da imagem (600 FTDs) não fecham com a tabela por canal (995 FTDs); qualquer linha real com eles mudaria as somas por canal. A imagem também imprime totais e variações que não saem da aritmética das próprias linhas (ver [[design-system/dados-de-referencia]]).
- Decisão: `metrics_daily` ganha `base_contatada`; os valores do funil da demo ficam no canal reservado `__funil__`. Toda consulta exclui canais que começam com `__` da tabela, dos KPIs e da lista de canais; só o funil os lê. O banco devolve sempre a soma real; onde a imagem imprime outro número (Total de cliques, FTDs valor, CPA; variações de CPA e ROAS) a tela do React decide em P4 se mostra o valor calculado ou o da fixture.
- Logo: `tenants.logo_url` da PASIO é `/brand/pasio-logo.png`; o web serve `packages/design/brand/pasio-logo.png` nesse caminho. Cores por canal (não definidas no design, escolhidas dos acentos da paleta) ficam em `presentation.channels`: Meta #0070F8, Email #04ADDF, SMS #24CCB6, Afiliados #00C98B, Outros #748BA5.
- Consequência: em produção `base_contatada` vem de envios de email/SMS ou cliques marcados como base; um canal real nunca começa com `__`.

## D12 — API confia em JWT HS256 com `AUTH_SECRET`; `x-tenant` prevalece sobre a claim `tenant` (2026-10-15)
- Contexto (P2.2): a autenticação de pessoa no navegador será Auth.js no Next.js (Fase 4/5). A API precisa de um contrato simples que o web consiga emitir.
- Decisão: a API aceita só JWT HS256 assinado com `AUTH_SECRET` (segredo compartilhado com o web), claims `sub` (uuid do usuário), `email` e `tenant` opcional (empresa ativa). Validade 12 h, sem refresh nem revogação por enquanto. A empresa ativa vem do cabeçalho `x-tenant` (slug ou id), que tem prioridade sobre a claim, para o web trocar de empresa sem reemitir token; `POST /me/empresa` devolve um token novo com a claim trocada. O papel é relido em `memberships` a cada requisição (remover a membership corta o acesso na hora; só `/me` continua válido até o token expirar).
- Rate limit 300/min por IP em memória (`@fastify/rate-limit`): com mais de uma instância precisa de store compartilhado. CORS libera só `WEB_URL`.
- Pendente para a Fase 4/5: decidir se o web emite o JWT da API diretamente ou troca a sessão do Auth.js por um token da API.

## D13 — Segredo do webhook fora do banco até P5.2; fila pg-boss com `DATABASE_ADMIN_URL` (2026-10-15)
- Contexto (P3.1/P3.2): o contrato HMAC exige o segredo recuperável, mas `sources` guarda só o hash scrypt (D8: nada em claro). `app_user` não pode criar schema, e o pg-boss precisa criar o schema `pgboss`.
- Decisão: provisoriamente o segredo vem da variável `WEBHOOK_SEGREDOS` (JSON `{"empresa/fonte": "segredo"}`, nunca commitada) e só é aceito se bater com `sources.secret_hash`. Em P5.2 entra a coluna `sources.secret_enc` (AES-256-GCM com chave em `WEBHOOK_CHAVE_CIFRA`), proposta em `apps/api/docs/webhooks.md`; a variável deixa de existir. A fila usa `DATABASE_ADMIN_URL`; sem ela a API cai em fila em memória e avisa no log (só desenvolvimento). Retentativa 5x com backoff exponencial de 5 s a 300 s; erro de regra não é retentado (fica `erro` com motivo no bruto); erro de infraestrutura retenta e, esgotado, grava `retentativas_esgotadas`.
- Códigos de erro novos: 400 `cabecalho_ausente` e `json_invalido` (separado de `validacao_invalida`, que é erro de schema). Empresa ou fonte desconhecida respondem 404 com a mesma mensagem, para não vazar qual das duas existe.

## D14 — Agregação em SQL só nos dias afetados; cliques com `base` contam em `base_contatada` (2026-10-15)
- Contexto (P3.5): `metrics_daily` precisa ser recalculável e rápida o bastante para reprocessar 10 mil brutos em menos de 2 min.
- Decisão: `reagregarDias` apaga e reinsere, em SQL (`delete` + `insert … select group by`), só as linhas dos dias afetados, nunca tocando canais `__` (D11). Semântica igual à função pura `agregarEventos` do `@trafego/rules`, conferida por teste. Reprocessar em lotes de 500 com operações em massa: 10.001 brutos (20.002 eventos) em 15,8 s no local (a versão um a um levava 133 s). Depósitos incluem FTDs por padrão (opção por empresa ainda não existe no banco). Datas sem fuso explícito são lidas no fuso da empresa; iso com offset é respeitado; o dia fecha no fuso da empresa. Um clique com `base=true` vai para `base_contatada` e não para `cliques` (coluna `events.base`, migração 0003). Status de `webhook_events` continuam `recebido | processado | erro` (sem `processando`).

## D15 — Escopo das fases 5–7 reduzido ao essencial (2026-10-15)
- Contexto: o usuário considerou o plano de 8 fases excessivo para um projeto relativamente simples e pediu para manter só o essencial depois da Fase 4.
- Decisão: Fase 5 fica com apresentação (nome/logo) e webhooks por empresa (segredo); saem editor de regras, KPIs/paleta configuráveis e gestão de usuários/convites (papéis só via seed/SQL). Fase 6 fica com `pnpm check` + diff visual no CI e um e2e mínimo de isolamento (G3); saem carga e a11y. Fase 7 mantém wiki essencial, Portainer + túnel Cloudflare e G4. Os itens removidos ficam listados riscados em `PLANO-DE-ACAO.md` e podem voltar depois da entrega.
- Consequência: nada do que já foi entregue (Fases 0–3, RLS, regras, fila) é removido; só não ganha interface de administração agora.

## D16 — Contrato de métricas em pacote próprio e login de desenvolvimento sem senha (2026-10-15)
- Contexto (P4.8): API e web foram construídos em paralelo por agentes distintos; o web precisava de um token antes de existir Auth.js (Fase 5, agora fora do escopo enxuto).
- Decisão: `@trafego/contratos` (dono: orquestrador) fixa `VisaoGeralQuery`/`VisaoGeralResposta`; números saem crus (sem arredondar, null nunca vira 0) e o web formata com `@trafego/fixtures`. `POST /auth/sessao-dev` (`{ email }` → JWT de 12 h) só é registrada quando `NODE_ENV !== 'production'`; o servidor do Next a chama com `WEB_USUARIO_EMAIL` e guarda o token em memória, com fallback de assinatura local via `jose` se a rota não existir. Cache da visão geral em memória por instância (15 s, 500 entradas), `Cache-Control: private, max-age=15`. Se houver linhas de canal `__*` no período, o funil usa só elas e ignora filtros (D11).
- Consequência: nenhum login real até haver Auth.js; em produção o web precisa de outro caminho de token (pendência da Fase 7). A apresentação no banco (`{id, visivel, ordem}`) é convertida para o contrato (`KpiId[]`) na API.

## D17 — Gate visual da Fase 4: 5,39% contra a imagem, 1,45% contra o protótipo (2026-10-15)
- Contexto: D10 pedia ≤ 4,5% contra a imagem e ≤ 2% contra o protótipo. A tela React ligada à API real mediu 5,39% contra a imagem (funil 5,83, kpis 8,77, tabela 4,40, cabeçalho 6,99, sidebar 3,52, filtros 3,11) e 1,45% contra o protótipo (nenhuma região acima de 2,51%).
- Decisão: aceitar. O excedente contra a imagem vem de diferenças intencionais ou de dados: logo da PASIO no lugar do logo genérico, sparklines desenhadas com os 24 pontos reais do banco (a imagem tem curvas ilustrativas), CPA R$ 34,01 e variações de CPA/ROAS calculados do seed (a imagem é aritmeticamente inconsistente, ver [[design-system/dados-de-referencia]]), hora omitida quando `atualizadoEm` é null. O critério que mede geometria (contra o protótipo) ficou dentro do limite. A aprovação final continua sendo G4, na tela real.
- Armadilha corrigida: o `<Funil>` tem `viewBox` absoluto a partir de y=322; montá-lo em outro `top` desloca tudo (custou 3 px e 4,5 pontos de diff no funil).

## D18 — Logo no banco e segredo de webhook cifrado (2026-10-15)
- Contexto (P5.1, P5.2): o deploy é um único stack no Portainer, sem armazenamento de objetos; e o HMAC precisa do segredo em claro, enquanto o banco só guardava o hash (D13 dependia de `WEBHOOK_SEGREDOS` no env).
- Decisão: o logo enviado vira `data:<tipo>;base64,...` em `presentation.logo_url` (PNG ou SVG até 512 KB; SVG com script, `on*=`, `javascript:` ou `foreignObject` é recusado). O segredo da fonte é gerado pela API, mostrado uma vez e gravado como hash scrypt (`secret_hash`) e cifrado AES-256-GCM (`secret_enc`, formato `v1$iv$tag$ct`) com a chave `WEBHOOK_CHAVE_CIFRA`, obrigatória em produção; fora dela, deriva de `AUTH_SECRET` com aviso. O recebimento tenta o banco e cai para `WEBHOOK_SEGREDOS` (compatibilidade).
- Consequência: trocar `WEBHOOK_CHAVE_CIFRA` invalida todos os segredos (é preciso rotacionar as fontes). Configurações fica em `/configuracoes`, com link na Ajuda e sem item novo na sidebar da Visão Geral, para não mexer no diff visual. Contrato em `packages/contratos/src/admin.ts`; o Next resolve os imports `.js` dos pacotes via `webpack.resolve.extensionAlias`.

## D19 — CI com mock da API e limite de 5,5% no diff visual (2026-10-15)
- Contexto (Fase 6 enxuta): o CI não tem Postgres com o seed para a tela e a medição local contra a imagem ficou em 5,39% (D17).
- Decisão: o workflow `.github/workflows/ci.yml` roda `pnpm check` e o diff visual com `WEB_MOCK_API=1`, reprovando acima de 5,5% contra a imagem. O isolamento entre empresas é coberto pelo e2e `apps/api/src/e2e/g3.test.ts`.

## D20 — Conta de usuário: senha scrypt, convite por link e sessão em cookie (2026-10-16)
- Contexto: Configurações precisava de perfil (nome e sobrenome), um admin que convida outras pessoas e login real; até aqui o web só tinha a sessão provisória `sessao-dev`.
- Decisão: senha com scrypt (mínimo 8). Convite guarda só o hash sha256 do token (`<tenantId>.<aleatório>`), vale 7 dias e o link é `${WEB_URL}/convite?token=`. Redefinição por token HMAC de uso único, validade de 1 h; o primeiro acesso de quem já existe é pelo "Esqueci minha senha". E-mail por SMTP (`SMTP_*`, `EMAIL_REMETENTE`); sem SMTP, fora de produção, o link vai para o log da API e a tela mostra o link para copiar. No web, a sessão fica em cookies httpOnly `sessao` (JWT) e `empresa` (slug), 12 h; o `middleware.ts` só exige login em produção (fora do mock) ou com `WEB_EXIGIR_LOGIN=1`, e em dev sem cookie continua valendo `sessao-dev`.
- Consequência: o navegador nunca vê o JWT nem fala com a API (server actions). Credenciais SMTP ficam em `apps/api/.env.local` (fora do git) ou nas variáveis do Portainer.

## D21 — Tag GTM própria e cruzamento com o webhook pelo user_id (2026-10-16)
- Contexto: o webhook da plataforma traz cadastro, FTD e depósito, mas quase nunca traz UTM; a atribuição de campanha vem do site.
- Decisão: a aba Tag GTM gera um HTML personalizado (ES5) que guarda click ids e UTMs no navegador (prefixo `gbk_`), lê o `user_id` do dataLayer e envia `page_view` por `sendBeacon` em text/plain para o endpoint público `POST /t/:empresa/clk`. A primeira página da sessão (`cv:1`) vira visita. No processamento, evento do webhook sem UTM herda o último toque do mesmo `user_id`; o canal sai do click id. Não existe tipo "redepósito": todo depósito entra como `deposito`. A origem pública usada na tag é `WEBHOOK_URL_PUBLICA`.
- Consequência: sem `WEBHOOK_URL_PUBLICA` a tag só funciona na máquina local (a tela avisa). O `user_id` do dataLayer precisa ser o mesmo identificador que a plataforma manda no webhook.

## D22: largura mínima de 1315 px só no dashboard (2026-10-16)
- Contexto: a largura fixa de 1315 px existe para a tela comparada pixel a pixel. Aplicada a `html`/`body` em todas as telas, ela quebrava Configurações e conta no celular.
- Decisão: em `apps/web/app/tela.css`, o `min-width: 1315px` passa a valer só quando a página tem o dashboard, com `html:has(.tela), body:has(.tela)`.
- Consequência: o dashboard e o diff visual (D19) seguem iguais. As demais telas ficam livres para um layout fluido (D23).

## D23: Configurações com layout fluido e escala tipográfica própria (2026-10-16)
- Contexto: revisão de UX (impeccable e especialista de responsividade). As Configurações estão fora da área comparada no diff, então podem seguir regras de UX em vez da imagem.
- Decisão: `configuracoes.css` usa `rem`, funciona a partir de 320 px e tem breakpoints em `em`. A casca é um grid com coluna de 181 px mais o conteúdo `minmax(0, 1fr)`, com a sidebar fixa ao rolar. Abaixo de 48em a navegação vira barra superior e as tabelas (menos a da Instalação) viram cartões, com o rótulo de cada célula em `data-rotulo`. A escala de texto tem quatro tamanhos (`--cfg-fs-titulo`, `-sub`, `-corpo`, `-micro`). Os alvos de toque (`--cfg-alvo`) têm 48 px no celular e 40 px no desktop. Os campos usam 16 px ou mais, para o iOS não dar zoom. Os títulos de seção são h2 nos `page.tsx` (Server Components), para aparecerem também nas telas de erro.
- Consequência: as telas de conta (`.conta-fundo`) usam os mesmos tokens. O primeiro h2 de cada aba leva `cfg-sem-margem`, para não abrir espaço abaixo das abas.

## D24: ícones novos do Tabler (2026-10-16)
- Decisão: entram no sprite os ícones `feito`, `atencao`, `pendente`, `copiar` e `abrir-aba`, gerados do `@tabler/icons` por `packages/design/scripts/gerar-icones.mjs` (nada desenhado à mão nem por IA).
- Consequência: `packages/design/icons/index.ts` é gerado. Se o script rodar de novo sem formatar a saída, o arquivo volta a falhar no `prettier --check`.

## D25: ação destrutiva sempre com diálogo de confirmação (2026-10-16)
- Decisão: remover membro, cancelar convite, rotacionar segredo e voltar ao logo padrão passam por `BotaoConfirmar` (`apps/web/app/(admin)/configuracoes/Confirmar.tsx`). O componente fica dentro do `<form>` da ação e abre um `<dialog>` modal com a consequência escrita. Só o botão de confirmar (classe `cfg-botao-perigo`) envia o formulário. Esc, Cancelar e clique no fundo fecham sem enviar.
- Consequência: o projeto não usa `jsx-a11y`, então o `onClick` no `<dialog>` não gera aviso de lint. O clique no fundo é só um atalho de mouse; o Esc nativo cobre o teclado.

## D26: tokens de erro e aviso (2026-10-16)
- Decisão: as cores de erro e aviso viraram tokens em `tela.css` (`--p-erro-bg`, `--p-erro-borda`, `--p-erro-txt`, `--p-aviso`) e saíram dos valores soltos. Elas valem para mensagens de formulário, faixas de erro e o estado "atenção" da Instalação.

## D27: salvar a Apresentação revalida o layout inteiro (2026-10-16)
- Contexto: depois de trocar nome ou logo, a sidebar das outras telas continuava com a marca antiga até recarregar.
- Decisão: a action de Apresentação chama `revalidatePath('/', 'layout')`. As telas em construção (Relatórios, Gestão de Custos, Ajuda) leem a marca de `api().apresentacao()`, nesta ordem: `logoUrl`, depois `logoPadraoUrl`, depois o nome em texto. Se a leitura falhar, a Sidebar fica com o padrão PASIO. Essas telas usam `dynamic = 'force-dynamic'`.

## D28: aba Instalação com estado calculado de dados reais (2026-10-16)
- Decisão: `montarPassos()` em `apps/web/lib/instalacao.ts` é uma função pura que recebe o que a página conseguiu ler da API (`null` = não leu) e devolve 7 passos com estado `feito`, `atencao`, `pendente` ou `manual`. Uma leitura que falha vira "Não foi possível conferir agora." e **nunca** conta como concluída. O passo da tag GTM é `manual`, porque não dá para conferir daqui, e não entra na contagem de feitos. Testes em `apps/web/testes/instalacao.test.ts`.

## D29: doutrina de movimento do dashboard (2026-10-16)
- Contexto: pedido de visual mais profissional com o especialista Hyperframes (D3). O CI compara o estado final com `prefers-reduced-motion: reduce` (D19).
- Decisão:
  - Curva de saída forte, `cubic-bezier(0.165, 0.84, 0.44, 1)`. Só anima `transform`, `opacity` e `clip-path`, nunca largura, altura ou posição de layout.
  - Todo o CSS de movimento fica dentro de `@media (prefers-reduced-motion: no-preference)` e usa `animation-fill-mode: backwards`. Com movimento reduzido nada anima, nada passa por opacity 0, e o estado final é idêntico ao SSR e à captura do CI.
  - A entrada é em CSS: começa no primeiro paint e funciona sem JS. KPIs com 300 ms e stagger de 40 ms (terminam em 460 ms), funil em +60 ms, tabela em +100 ms.
  - A entrada fica num invólucro `<div class="entrada">`, porque `.t` e `.ic` já usam a animação `desloca` (subpixel de fidelidade).
  - Os números contam por `requestAnimationFrame` com `saidaQuad` (equivale ao power2.out), em 800 ms. O último quadro escreve a mesma string formatada do render. A contagem se sincroniza com a entrada CSS por `getAnimations()` e não reconta se o elemento já passou de 10% do fade.
  - O funil é o único momento autoral: barras em `scaleX` a partir do eixo (420 ms, passo de 70 ms), terminando em cerca de 900 ms.
  - A sparkline é revelada por `clip-path` em 600 ms, sem depender de `dasharray`.
  - O CSS dos gráficos entra uma vez via `<style href precedence>` do React 19.
  - O GSAP sai do painel: `criarTimelineCascata` segue exportada, sem uso.
- Consequência: diff visual inalterado (5,419% antes e depois, 0 px de diferença em reduce). As Configurações seguem a mesma doutrina em 200 a 400 ms. Remover o `gsap` do pacote `@trafego/graficos` fica para outra tarefa.

## D30: acessibilidade do dashboard sem mudar pixel (2026-10-16)
- Decisões:
  - `aria-sort` só vale em `columnheader` dentro de `table`/`grid`. Por isso há uma tabela semântica sobreposta (cabeçalhos com os botões "Ordenar por <rótulo>" e linhas `.so-leitor`), e os textos da tabela desenhada levam `aria-hidden` via `slotSoVisual`, para o leitor não ler duas vezes.
  - O esmaecimento dos KPIs durante o carregamento usa `filter: opacity(0.45)` em vez de `opacity`, para preservar a opacidade calibrada inline (`calibracao.ts`).
  - `ID_CONTEUDO` fica em `lib/tela.ts`, e não no `Painel.tsx`, que é cliente.
  - Os alvos ⓘ têm 24×24 px, acima dos botões de ordenação (z-index 4).
  - No clique fora de um menu, o foco só volta ao botão se fosse se perder.
  - Para o botão "Tentar de novo" caber nos 710 px, a faixa de erro subiu de `top` 684 para 680 px.

## D31: gasto em anúncios por lançamento manual e leitura do Meta Ads (2026-10-16)
- Contexto: pedido "esse app tb deve receber dados do meta ads das contas de anúncio, para entrar nos dados de valor gasto em anúncios, também deve ter uma aba de adição manual".
- Decisão:
  - Tabela própria `custos` (origem `manual` ou `meta`), somada no `investimento` por `agregarIncremental`, em vez de gravar eventos falsos em `events`.
  - A leitura do Meta usa a Graph API (insights, `level=campaign`, `time_increment=1`) com token de usuário do sistema, enviado só no cabeçalho `Authorization`. O token fica cifrado com a chave das fontes.
  - Sincronização idempotente: apaga e regrava o gasto do Meta no intervalo lido. Ao conectar, 30 dias; de hora em hora, 3 dias (o Meta ajusta o gasto dos últimos dias); manual, até 90.
  - Gasto manual exige analista; conta do Meta exige admin.
  - As telas ficam em Configurações (Gastos e Meta Ads); "Gestão de Custos" redireciona para Gastos.
- Consequências: sem conversão de moeda; risco de duplicar se um webhook também mandar `gasto` no canal Meta; na demo, mexer num dia apaga os números de seed desse dia.
- Verificação: 26 testes novos na API (12 do cliente do Meta, 14 com banco) e 5 no web; `pnpm lint`, `typecheck` e `test` verdes (API 178 + 1 pulado, web 51). Telas conferidas no navegador. Sem commit.

## D32: o painel ocupa a tela no desktop (2026-10-16)
- Contexto: em monitores maiores o painel ficava em 1315×710 no canto, com o resto da tela vazio ("o app está minimizado ou cortado").
- Decisão: a partir de 900 px de largura, `.tela` recebe `zoom` igual a `min(largura/1315, altura/710)`, calculado só em CSS com `tan(atan2(100vw, 1315px))`, e fica centrada. As sobras laterais pintam a sidebar e o divisor no fundo do `body`, para não aparecer moldura. As faixas de artefato da captura (`.faixa-topo`, `.faixa-direita`) só aparecem com a janela exatamente em 1315×710. `zoom` em vez de `transform`: refaz o layout, o texto fica nítido e não cria camada de composição.
- Verificação: diff visual contra o `next dev` igual ao de antes (**5,419%**), porque a escala na captura é exatamente 1. Em 1920×962 a escala é 1,355 e o painel ocupa a altura toda. Abaixo de 900 px nada mudou (rolagem horizontal, como antes).

## D33: Configurações na moldura do painel, transição por aba, hover do funil e Instalação com submenu (2026-10-16)
- Contexto: depois da D32, as Configurações continuavam em escala 1 e com o conteúdo limitado a 60rem ("as outras opções estão curtas"). Além disso, faltava transição ao trocar de aba, o funil não tinha hover, e as abas Tag GTM, Webhooks e Meta Ads ficavam soltas em vez de dentro de Instalação.
- Decisão:
  - Moldura das Configurações: a partir de 900 px, `.cfg-tela` usa a mesma moldura de 1315 px e a mesma escala do painel, `max(1, min(largura/1315, altura/710))`, com o fundo do `body` continuando a sidebar. A sidebar fica no mesmo lugar e no mesmo tamanho ao ir do painel para as Configurações. A escala nunca fica abaixo de 1, para o texto não descer de 15 px (wiki de UX). A altura rola, e por isso `100vh` é dividido pela escala dentro do zoom. O conteúdo vai até 90rem e as margens laterais ficam em 3rem (tabela de medidas da wiki de UX: contêiner de dashboard até 1440 px, margem a partir de 48 px).
  - Transição: `configuracoes/template.tsx` remonta a cada aba, e a cena nova entra com `cfg-surge` (subida e opacidade, 400 ms, power3.out). Não há saída, como pede a doutrina Hyperframes de transições entre cenas. Sidebar, título e abas ficam parados.
  - Funil: já era SVG puro (72 elementos SVG, nenhum HTML). Ganhou hover em CSS dentro de `CSS_MOVIMENTO`: a etapa sob o ponteiro cresce 3%, as outras vão a 45% de opacidade, só com `transform` e `opacity`, transição de 200 ms em `no-preference`. Cada etapa ganhou um `<title>` (dica nativa com rótulo, valor e taxa). O visual parado é o mesmo.
  - Instalação: Tag GTM, Webhooks e Meta Ads saem das abas e viram o submenu de botões de Instalação (Visão geral, Tag do GTM, Webhooks, Meta Ads). As rotas continuam as mesmas, e a aba Instalação fica marcada nas quatro. Cada uma abre com um passo a passo numerado (`Guia.tsx`, textos em `guias.tsx`) acima do painel de configuração.
- Verificação: diff visual contra o dev em **5,419%** (inalterado). Web 51 testes e gráficos 19 passando; tsc, eslint e prettier ok. Conferido no navegador em 1920×962: a sidebar das Configurações fica em x=69 e com 245 px de largura, igual ao painel.

## D34: funil com neon no hover e clique que abre a lista da etapa e a ficha do usuário (2026-10-16)
- Contexto: o hover da D33 escurecia as outras etapas (opacidade 45%). O pedido foi acender só a etapa sob o ponteiro, sem apagar o resto, com efeito neon, e o clique em cada etapa passou a abrir a lista de quem chegou nela (com o ícone do canal). Clicando numa pessoa, abre a ficha dela, no jeito de um CRM, com as UTMs e o que o webhook informou.
- Decisão:
  - **Hover**: as outras etapas ficam como estão. A etapa sob o ponteiro, em foco ou aberta (`data-ativa`) ganha brilho branco a 16%, contorno neon (filtro SVG com dois desfoques e o traço na cor da etapa mais um núcleo `#E8F6FF`) e escala de 2%. Só `opacity` e `transform`, 220 ms, sob `no-preference`. Parado, o desenho não muda.
  - **Clique**: `Funil` aceita `onEtapa` e `etapaAtiva`. Com `onEtapa`, cada etapa vira botão (Enter e Espaço, `aria-haspopup=dialog`). Sem ela, o SVG continua `img`.
  - **API**: `GET /empresas/atual/eventos?etapa=` (lista mais recente primeiro, total, valor e total por canal) e `GET /empresas/atual/leads/:leadKey` (eventos, toques da tag com UTMs e click ids, e corpo dos webhooks). Exigem analista ou acima e passam por RLS. Campos de senha, token e cartão do payload saem mascarados. Contrato em `packages/contratos/src/leads.ts`.
  - **Web**: server actions em `app/acoes-funil.ts` (o navegador não fala com a API) e gaveta `componentes/GavetaFunil.tsx` à direita, sobre a tabela, sem cobrir o funil. Ela tem lista com filtro por canal, ficha (veio de, resumo, origem, linha do tempo e dados do webhook) e botão de voltar. Esc volta da ficha e fecha a lista; clique fora também fecha. Base contatada e Cliques chegam somados das plataformas e mostram um aviso no lugar da lista.
  - **Amostra**: o seed grava 36 pessoas fictícias (`demo-1001` a `demo-1036`, e-mail em `exemplo.com`) para a demo ter o que listar, sem tocar em `metrics_daily`. O último webhook fecha às 08:30 de 24/05/2024, o mesmo "atualizado em" da imagem.
- Consequências: a lista mostra só quem tem registro por pessoa, por isso os números da gaveta (18 FTDs na amostra) não batem com o funil, que vem das fixtures. "Depósitos (com o FTD)" na ficha conta o primeiro depósito.
- Verificação: API 183 testes + 1 pulado (5 novos em `leads/leads.test.ts`); web 56 (5 novos em `gaveta-funil.test.tsx`); gráficos 21; tsc, eslint e prettier ok. Diff visual contra o dev em **5,357%** (antes 5,419%; a hora do "atualizado em" agora é igual à da imagem). Conferido no navegador: hover, lista do FTD, ficha do `demo-1036`, payload, voltar, Esc, clique fora e Base. O conserto de uma corrida ficou coberto: clicar numa etapa durante os 180 ms da saída zerava a etapa recém-aberta, e agora o fechamento pendente é cancelado.

## D35: tutoriais animados em balão, conta na sidebar, gaveta com 10 itens e fundos de imagem (2026-10-16)
- Contexto: pedidos da mesma sessão. Gestão de custos e Instalação precisavam de explicação explícita, com animação no estilo Hyperframes, em formato de balão. A sidebar não tinha a foto do usuário nem o botão de sair. A gaveta do funil listava todos os eventos. E o usuário enviou três fundos: duas ondas para as telas de conta e engrenagens para Configurações.
- Decisão:
  - **Tutorial em balão** (`Tutorial.tsx`, `tutoriais.tsx`, `linha-do-tempo.ts`, `tutorial.css`):
    - um botão com play abre um popover nativo (`popover="auto"`) com seta para o play; Esc e clique fora fecham;
    - o balão fica abaixo do botão ou acima, se faltar espaço; compensa o `zoom` das Configurações (`currentCSSZoom`) e rola até o botão quando nem assim cabe;
    - cada cena é uma timeline GSAP pausada no contrato do Hyperframes: `fromTo` com estado inicial explícito, tempos absolutos e só transform e opacidade; não tem nada aleatório nem em loop;
    - as peças declaram o movimento com `data-hf` (receita) e `data-t` (instante em ms);
    - a barra da cena atual é o relógio da mesma timeline, então pausar congela tudo junto;
    - com movimento reduzido, `progress(1)` mostra o estado final e a navegação é manual;
    - há tutoriais em Gastos, Meta Ads, Tag, Webhooks e Instalação.
  - **Conta na sidebar** (`Sidebar.tsx`, `lerContaSidebar()`):
    - avatar com iniciais (não existe campo de foto), nome e e-mail;
    - o botão Sair chama a server action `sair()` (apaga a sessão e redireciona para `/login`);
    - sem sessão aparece "Entrar";
    - fica acima de Configurações, e não na última linha, porque na imagem de referência a Ajuda ocupa a base da sidebar.
  - **Gaveta do funil**: mostra os 10 eventos mais recentes (`LIMITE_LISTA`) e um rodapé "Ver todos os N" que leva à página de leads.
  - **Fundos**:
    - originais otimizados para WebP com o sharp (3,2 MB passaram a 123 KB) em `apps/web/public/fundos/`;
    - login com `conta-ondas-1`; nova senha e convite com `conta-ondas-2` (`FundoConta.tsx` escolhe pela rota);
    - Configurações com `configuracoes.webp`, no `body` atrás da moldura no desktop (acima de 900 px), e `configuracoes-960.webp` no topo da tela abaixo disso;
    - os dois usam um véu de 40–55% em `--p-bg-main` para manter o contraste;
    - o painel `/` não usa imagem de fundo.
- Consequências: no modo mock (CI) a sidebar mostra "Entrar", o que soma cerca de 0,07 ponto ao diff.
- Verificação:
  - diff como no CI (`WEB_MOCK_API=1`): **5,198%** (antes 5,129%; limite 5,5%);
  - web com 67 testes; tsc, eslint e prettier ok;
  - conferido no navegador:
    - os cinco tutoriais abrem e animam, sem erro no console;
    - balão posicionado sob o zoom;
    - gaveta com 10 itens e "Ver todos";
    - fundos no login, em nova senha e em Configurações.
  - Não conferido: o clique em Sair com sessão real e o fundo na largura do celular.

## D36: login em vidro, título pela primeira visita, Argon2id, "lembrar de mim" e avatar clicável (2026-10-16)
- Contexto: o usuário pediu:
  - o login igual à imagem enviada (cartão de vidro, campos com ícone, "Lembrar de mim", "Esqueceu a senha?", botão em gradiente);
  - "Faça seu login" no primeiro acesso e "Bem-vindo de volta" para quem já entrou e saiu;
  - toda validação no backend com hash e JWT atuais;
  - o avatar do usuário clicável.
- Decisão:
  - **Hash de senha: Argon2id** nativo do Node (`crypto.argon2`, Node ≥ 24.7) com os parâmetros mínimos da OWASP (m=19456 KiB, t=2, p=1, 32 bytes), guardado no formato PHC `$argon2id$v=19$...`. O bcrypt foi descartado: é mais fraco contra GPU e corta a senha em 72 bytes. Também não entra dependência nativa.
    - O hash scrypt antigo (`s1$`) continua aceito e é refeito em Argon2id no primeiro login certo (`precisaRefazerHash`).
    - A comparação usa `timingSafeEqual`; e-mail inexistente roda uma derivação falsa de mesmo custo, para não vazar pelo tempo de resposta.
    - Parâmetros lidos do hash têm limites (m até 1 GiB, t até 10, p até 16): hash forjado no banco não derruba o servidor.
  - **JWT HS256**: 12 h por padrão e 30 dias com "lembrar de mim" (`VALIDADE_TOKEN_LEMBRAR`).
    - A claim `sv` carrega a versão da senha (16 hex); o `autenticar` confere no banco, e trocar a senha derruba todas as outras sessões ("Sessão encerrada: a senha foi trocada.").
    - `PATCH /me` com troca de senha devolve um token novo, gravado no cookie pela server action, para a sessão atual continuar.
    - `POST /me/empresa` preserva `sv` e o prazo restante.
    - O rate limit de 10 por minuto nas rotas públicas continua.
  - **Cookies no web**: `sessao` e `empresa` são httpOnly, SameSite=Lax e Secure em produção; viram persistentes só com "lembrar de mim". O cookie `ja_entrou=1` (400 dias, não sensível) decide o título do login. Ele não guarda quem é o usuário.
  - **Tela**: cartão de vidro (`backdrop-filter`, borda violeta), logo PASIO no topo, ícones `email`, `cadeado`, `olho`, `olho-fechado` e `seguir` do @tabler, olho com `aria-pressed`, botão Entrar em gradiente violeta→azul. O globo da imagem de referência não entrou (o cartão está desenhado dentro dela); o fundo continua com as ondas.
  - **Avatar clicável**: na sidebar, avatar, nome e e-mail formam um link para `/configuracoes/perfil`; o Sair continua separado. Os avatares da ficha do funil e da lista de leads são de outras pessoas e não viram link.
- Verificação:
  - API: `senha.test.ts` (3 testes) e um caso novo em `conta.test.ts` (lembrar = cerca de 30 dias, troca de empresa mantém o prazo, troca de senha dá token novo e o antigo leva 401). Conta: 8 de 8. A suíte inteira tem 186 testes passando e 2 falhando, ambos por causa dos dados de `db:ficticio` no banco local (seed conta 862 eventos, período padrão vai a 2026); no CI o banco é limpo.
  - Web: 67 testes; tsc, eslint e prettier ok.
  - Diff como no CI: **5,198%** (limite 5,5%).
  - Login conferido no navegador; login inválido pela API devolve 401 "E-mail ou senha incorretos.".

## D37: fundo de ondas em SVG nas telas internas, leve e com fim (2026-10-16)
- Contexto: o usuário pediu "faça os fundos de dentro do app com svg utilizando o hyperframe" (as ondas das imagens #8 e #9) e, no meio do trabalho, "nada que deixe o site muito pesado".
- Decisão:
  - **Onde**: Relatórios e Ajuda (`EmConstrucao` renderiza `FundoOndas` como primeiro filho do `<main>`, atrás do texto, `aria-hidden`). O painel `/` não usa, para manter o diff. Gestão de Custos leva a Configurações → Gastos, que continua com o fundo de engrenagens (D35), confirmado pelo usuário.
  - **Desenho** (`componentes/fundo-ondas.ts`): é puro e determinístico, com o hash do índice no lugar do `Math.random`, então SSR e navegador desenham igual. Tem:
    - fita principal com 40 fios;
    - fita de trás violeta com 22 fios;
    - crista brilhante;
    - grade de pontos que rareia ao longo da fita.
  - **Movimento** no contrato Hyperframes (só referência): uma timeline GSAP pausada, `fromTo` e tempos absolutos.
    - Entrada de cerca de 2 s: halo em opacidade (receita ambient-glow-bloom), fios desenhados por `stroke-dashoffset` com `pathLength=1` (svg-path-draw) e pontos entrando pela esquerda.
    - Depois, respiração `sine.inOut` (sine-wave-loop) em três camadas, só com transform, em 11 repetições ímpares. Termina na pose do SSR em cerca de 86 s e para.
  - **Leveza** (medida no Playwright headless sem GPU, que é o pior caso):
    - pontos em 3 `<path>` (traços `h.01` com ponta redonda), não em 723 `<circle>`. O HTML de `/relatorios` caiu de 93 KB para 47 KB e o fundo tem 93 nós;
    - sem filtro de desfoque: a crista brilha com um traço largo e fraco por baixo;
    - um halo só, parado depois da entrada (o halo animado era o que mais pesava);
    - o GSAP é importado sob demanda, depois da pintura;
    - `will-change` só enquanto a timeline roda (`data-fo='anima'`). Ao fim, `data-fo='pronto'` devolve as camadas à pintura comum e o fundo não gasta mais nada;
    - aba escondida pausa a timeline.
  - **Fallback**: com movimento reduzido, mostra o estado final parado. Sem JS, as camadas aparecem paradas em 3 s, por animação CSS.
- Verificação:
  - 61 quadros por segundo na entrada e na respiração (pior quadro 17 ms), igual a uma tela sem fundo. Antes do enxugamento davam 45, com pior quadro de 50 ms;
  - aos 90 s, `pronto`, sem `will-change` e com transform na identidade;
  - `fundo-ondas.test.ts` (3 testes: determinismo, quantidades, pontos dentro da área) e um caso novo em `em-construcao.test.tsx`. Web: 71 testes; tsc, eslint e prettier ok;
  - diff como no CI: **5,198%** (sem mudança).

## D38: telas sem o pequeno scroll, sidebar sem Ajuda e formulários de Configurações menores e em folha (2026-10-16)
- Contexto: o usuário pediu "precisa de ajuste de UX na tela principal o usuario tem que dar um pequeno scroul e nas telas de confiugração tb e o botão de configurações tem que ficar abaixo de relatoios  e o perfil o usuario mais abaixo de onde estar, remova o botão de ajuda" e, depois, "o formulario de dados pessoais e de outras parte estão com texto mutio grande e precisam de um leve background".
- Causa do "pequeno scroll":
  - no painel `/` não havia rolagem de página. Os cards terminam em y 721 e a moldura tinha 710 px (o recorte da `ref-1.png`), então ficavam cortados embaixo;
  - em Configurações, o `zoom` da moldura (até cerca de 1,33 em telas grandes) ampliava também o conteúdo, e o texto e os campos passavam da altura da janela.
- Decisão:
  - **Moldura de 735 px fora da captura** (`tela.css`): `--tela-alt` vale 735 px e só volta a 710 px em `@media (width: 1315px) and (height: 710px)`, que é a janela do diff. `.tela`, `.principal`, `.sidebar`, `.divisor`, o fundo e a gaveta do funil usam a variável; a escala (`--tela-escala`) divide por ela. Os cards fecham com cerca de 14 px de margem e a captura do CI não muda. O `FundoOndas` ganhou `preserveAspectRatio="xMidYMax slice"` para cobrir 735 px com o viewBox de 710.
  - **Sidebar** (`lib/tela.ts`, `Sidebar.tsx`): sai a Ajuda; Configurações entra logo abaixo de Relatórios (`NAV_Y.configuracoes = 237.5`, passo de 44 px, slot `nav.configuracoes`, calibração extra `Configurações#1` fora do `calibracao.ts` gerado); o rodapé da conta usa `bottom: 16px` e fica colado ao fim da moldura, seja ela de 710 ou de 735 px. A página `/ajuda` (só um "em construção" com link para Configurações) foi apagada, porque o botão era o único caminho até ela. A fixture da referência continua com o item Ajuda, porque descreve a imagem.
  - **Configurações sem ampliação** (`configuracoes.css`): `.cfg-principal` desfaz o zoom (`zoom: calc(1 / var(--cfg-escala))`) e o conteúdo fica no tamanho natural; a sidebar continua na escala do painel, agora sem o `max(1, …)`, o que também acabou com a rolagem interna dela. Tokens de desktop menores: título 1,375rem, subtítulo 1rem, corpo 0,875rem, alvo 2,5rem; campos com 0,875rem com mouse em tela larga. Leads usa a mesma moldura e herda o contra-zoom (a ficha passou a `calc(100vh - 2rem)`).
  - **Folha translúcida**: `.cfg-cena` virou uma folha `rgb(5 19 33 / 0.68)` com borda azul fraca, raio de 0,75rem e sombra, na largura do conteúdo (mínimo de 26rem). No celular, ocupa a largura toda com 1rem de respiro.
  - **Perfil em duas colunas** a partir de 64em (`.cfg-form-perfil`): dados pessoais à esquerda, troca de senha à direita e Salvar embaixo, em colunas de 18rem, para o bloco Acesso caber ao lado já em 1366 px.
  - **Cascata**: `.cfg-sem-margem` foi para depois de `.cfg-subtitulo`. Antes perdia e deixava um vão de 28 px no topo da folha em Usuários, Gastos, Apresentação, Meta Ads e Tag.
- Verificação:
  - rolagem medida no Playwright em 1536×826, 1366×657, 1920×945 e 1280×720: o painel, Perfil, Usuários, Apresentação e Relatórios cabem na janela. Continuam rolando só as listas longas, por conteúdo: Gastos (271 lançamentos no banco local), Leads (862 FTDs) e o passo a passo de Instalação;
  - web: 71 testes; tsc, eslint e prettier ok (o `pnpm format` local acusa só `.claude/settings.local.json` e `.impeccable/`, fora do git);
  - diff como no CI: **5,193%** (antes 5,198%).

## D39: produção numa stack do Portainer a partir do Git, atrás do túnel Cloudflare do servidor (2026-10-16)
- Contexto: o usuário passou o Portainer (`portainer.proxserverabner.site`, CE 2.39.1, ambiente `local`) e o túnel `servidor-abner` da Cloudflare para o deploy (P7.2). O cloudflared já roda no host e o repositório no GitHub é público.
- Decisão:
  - **Um Dockerfile, dois alvos** (`api` e `web`) sobre `node:24-alpine`. O Node 24 é exigido pelo `crypto.argon2` (D36). O store do pnpm é baixado só com o lockfile (`pnpm fetch`) e os installs são filtrados por app. As imagens têm cerca de 1,3 GB, porque levam devDependencies; aceitável por enquanto.
  - **API com `tsx` em produção** (`node --import tsx`), sem compilar: os pacotes internos (`contratos`, `fixtures`, `rules`, `graficos`) exportam a fonte TypeScript.
  - **Preparo a cada subida** (`apps/api/src/db/producao.ts`), antes do servidor e idempotente:
    - migra como dono das tabelas;
    - dá LOGIN e senha (`APP_USER_SENHA`) ao `app_user`, o papel sujeito a RLS;
    - cria a empresa PASIO (slug `pasio`, apresentação padrão) só se ela não existir e sem dados de exemplo;
    - garante o admin de `ADMIN_EMAIL`. Enquanto ele não tem senha, o log do contêiner traz um link de 1 hora para defini-la. Sem SMTP não há outro caminho, e o e-mail do admin fica só na variável do Portainer, nunca no repositório.
  - **Stack pelo repositório Git** (`docker-compose.prod.yml` com `build:`), sem bind mounts. Atualizar é "Pull and redeploy". API e web têm `pull_policy: build`, para a imagem ser reconstruída a cada subida em vez de reaproveitar a anterior (**substituído em 2026-10-19 por D41**: as imagens vêm prontas do GHCR, com `pull_policy: always`). `deploy/producao.env.example` lista as variáveis da stack, sem valores.
  - **Segredos gerados no próprio servidor**: ninguém digita nem vê `POSTGRES_SENHA`, `APP_USER_SENHA`, `AUTH_SECRET` e `WEBHOOK_CHAVE_CIFRA`. O serviço `segredos` (alpine, roda e sai) cria cada um uma única vez, com 32 bytes aleatórios em hex, no volume `segredos`. O postgres lê a senha por `POSTGRES_PASSWORD_FILE`. A API carrega `src/segredos-do-servidor.ts` com `--import` antes do preparo e do servidor: o módulo lê `/run/segredos` e monta `DATABASE_URL` e `DATABASE_ADMIN_URL`; uma variável já definida vale mais que o arquivo, e sem a pasta (dev, CI) nada muda. Assim as variáveis da stack no Portainer ficam só com endereços e o e-mail do admin. Consequência: o volume `segredos` entra em todo backup junto com o `pgdata`, porque sem a chave de cifra os segredos de webhook e os tokens do Meta gravados no banco não abrem.
  - **Sem cloudflared na stack**: web e API publicam só em `127.0.0.1:3480` e `127.0.0.1:3481` (portas livres no servidor, trocáveis por `WEB_PORTA` e `API_PORTA`), e o túnel do host aponta para elas. O banco não publica porta.
  - **Rate-limit pelo IP da borda**: atrás do túnel, todo visitante chega à API com o IP do gateway do Docker. Isso faria da Tag do GTM (120 por minuto) e do login (10 por minuto) limites somados do site inteiro. O `keyGenerator` global usa `cf-connecting-ip` quando o valor é um IP válido; a Cloudflare grava e sobrescreve esse cabeçalho na borda. Sem ele, vale o IP da conexão. O web repassa o cabeçalho do visitante nas chamadas que faz à API. Os webhooks continuam com chave por empresa e fonte.
  - **`/health` sem log por requisição** (`logLevel: 'warn'`): o healthcheck do contêiner chama a cada 10 s.
  - **Aviso de tabela vazia**: com o banco vazio, "Nenhum dado para os filtros escolhidos" ficava sobre a linha Total. Agora fica 18 px abaixo dela (`linhaY(0) + 62 + 18`). A fixture tem canais, então o diff não muda.
- Verificação:
  - stack completa subida localmente, primeiro com segredos de teste nas variáveis e depois só com `WEB_URL` e `ADMIN_EMAIL` (segredos gerados no servidor: 4 arquivos de 64 caracteres, `chmod 444`, nenhum no ambiente do contêiner). Em ambos: o preparo rodou, a raiz manda para `/login`, o link do log define a senha e entra no painel, o login do zero funciona, o cookie `sessao` é `httpOnly` e `Secure`, `/auth/sessao-dev` dá 404 e o console do navegador não tem erros. Depois das correções, na mesma stack: o aviso de tabela vazia começa em y 477, abaixo do Total (397 a 459), e o login devolveu 429 na 11ª tentativa do mesmo `cf-connecting-ip`, enquanto outro IP seguiu passando. Recriar a stack (`--force-recreate`) manteve os segredos idênticos, e o preparo reconheceu a empresa existente;
  - testes novos: `producao.test.ts` (3: entradas e idempotência), `segredos-do-servidor.test.ts` (3: leitura dos arquivos, variável definida prevalece, sem pasta nada muda), limite por `cf-connecting-ip` em `auth.test.ts` e repasse do IP em `api.test.ts`. O `logs.test.ts` passou a usar uma rota que loga em info;
  - no servidor: stack `trafego-pasio` (Portainer pelo Git) e rotas `pasio.proxserverabner.site` e `pasio-api.proxserverabner.site` no túnel. Pelos endereços públicos, `/health` ok, `/login` 200 e `/auth/sessao-dev` 404, e a página de nova senha abre pelo link do log;
  - API com 193 testes e 1 pulado, web com 72; lint e typecheck ok. Localmente falham só `seed.test` e `metricas.test`, por causa dos dados fictícios do banco de desenvolvimento.

## D40: domínio próprio kapanda.lat na mesma stack, com a zona na Cloudflare (2026-10-19)
- Contexto: o usuário pediu o painel em `https://kapanda.lat`, com um novo e-mail de admin e a Tag instalada no GTM do site dele. O domínio está registrado na Hostinger, e o DNS autoritativo era o da própria Hostinger, só com o estacionamento (sem MX nem TXT). Plano e execução em [[operacao/deploy-kapanda]].
- Decisão:
  - **Mesma stack, outro domínio**: `trafego-pasio` só troca `WEB_URL` e `WEBHOOK_URL_PUBLICA`, e banco, volumes e segredos ficam como estavam. Uma segunda instância duplicaria dados e segredos sem ganho nenhum. As rotas `pasio.*` seguem no túnel como apelido e podem sair depois.
  - **Zona inteira na Cloudflare (Free)**, com os nameservers trocados na Hostinger. O túnel só publica nomes de zonas da própria conta, e a configuração parcial por CNAME exige plano pago. A raiz vira CNAME do túnel (achatado pela Cloudflare), e o A de estacionamento sai.
  - **Rotas**: `kapanda.lat` e `www` → `localhost:3480`, e `api` → `localhost:3481`. O `www` redireciona para a raiz com 301 por Redirect Rule. HTTPS sempre, TLS mínimo 1.2.
  - **Admin novo pela variável** `ADMIN_EMAIL`, com a senha definida pelo link de 1 hora do log. O admin anterior não é apagado. O e-mail não entra no repositório (público) nem na wiki.
  - **Tag no GTM** criada pela API num workspace sem outras mudanças e publicada só depois que `api.kapanda.lat` responder. O código da Tag não pode ter `{{`: o GTM lê isso como variável sem fechamento e recusa salvar (400 `INVALID_ARGUMENT`). O gerador monta a string em duas partes, e um teste garante que não sobram duas chaves seguidas.
  - **Limite do agente**: o modo automático do Claude Code barra mudanças de DNS (nameservers e rotas do túnel), mesmo com autorização no chat. Essas ações ficam com o usuário, no navegador.
- Verificação: em [[operacao/deploy-kapanda]] (seção Execução).

## D41: imagens construídas no GitHub Actions e publicadas no GHCR; a VPS só baixa (2026-10-19)
- Contexto: o "Pull and redeploy" do Portainer compilava `api` e `web` na própria VPS (`pull_policy: build`, D39). Em 2026-10-19 o `next build` caiu com `exit code: 1` (falta de memória: 6,4 GB de RAM, cerca de 64 contêineres de outros projetos e os dois builds ao mesmo tempo), e numa segunda tentativa a requisição do Portainer passou dos cerca de 100 s do túnel da Cloudflare (`[object Object]`): as imagens ficaram prontas, mas os contêineres não foram trocados. Era o item 2 de [[operacao/problemas-atuais]]. Commit `e00a616`.
- Decisão:
  - **Workflow `Deploy`** (`.github/workflows/deploy.yml`): roda em push na `main` (ignora `wiki/**`, `registro/**` e `**/*.md`) e por `workflow_dispatch`. `concurrency: deploy-producao` sem cancelar o que está em andamento (um push novo espera a vez). Permissões `contents: read` e `packages: write`.
  - **Job `imagens`** em matriz `api`/`web`: checkout, buildx, login no `ghcr.io` com o `GITHUB_TOKEN`, `build-push-action` com `target` igual ao alvo do `Dockerfile`, só `linux/amd64` (a VPS é x86_64), tags `latest` e `sha-xxxxxxx` (7 primeiros caracteres do commit), cache `type=gha` com escopo por alvo e limite de 30 minutos.
  - **Job `redeploy`** (depende de `imagens`): se o secret `PORTAINER_WEBHOOK_URL` estiver vazio, só deixa um aviso e termina com sucesso; se existir, faz POST com `curl`, até 3 tentativas com 15 s de intervalo, sem imprimir a URL.
  - **Compose** (`docker-compose.prod.yml`): `api` e `web` passam a `image: ghcr.io/abnersantosss/dashboard-trafego-pago/<alvo>:${IMAGEM_TAG:-latest}` com `pull_policy: always` e sem bloco `build`. O resto não muda (serviço `segredos`, `db`, portas só em `127.0.0.1`).
  - **`deploy/producao.env.example`** ganha a linha comentada `# IMAGEM_TAG=latest`, que explica o rollback por `sha-xxxxxxx`.
- Alternativas descartadas:
  - **continuar compilando na VPS com menos paralelismo** (`COMPOSE_PARALLEL_LIMIT=1` ou um build por vez): alivia a memória, mas o build continua lento, disputa recursos com os outros projetos do servidor e a requisição do Portainer continua sujeita ao corte de 100 s do túnel;
  - **GitOps / webhook de stack do Portainer**: no Portainer CE 2.39.1, ligar abre um diálogo de licença; é recurso da Business Edition.
- Consequências:
  - o servidor não compila mais: o "Pull and redeploy" só baixa duas imagens prontas e recria os contêineres, em segundos;
  - **rollback** pela variável `IMAGEM_TAG` da stack: fixar `sha-xxxxxxx` de um commit anterior e fazer o redeploy; voltar a `latest` (ou apagar a variável) depois;
  - **registro público**: os pacotes do GHCR herdaram a visibilidade do repositório público, o manifesto responde 200 sem login e não foi preciso cadastrar registry no Portainer. Nenhum segredo vai para a imagem (os segredos continuam sendo gerados no servidor, D39);
  - **redeploy manual** até existir um jeito automático: sem o secret `PORTAINER_WEBHOOK_URL`, o job `redeploy` só avisa. O caminho possível na CE é a API do Portainer (`PUT /api/stacks/135/git/redeploy?endpointId=3`), com um token de acesso criado pelo usuário e guardado como secret do GitHub; o job teria de ser adaptado;
  - as sobras `<none>` a cada deploy (item 3 de [[operacao/problemas-atuais]]) deixam de se acumular: as imagens antigas construídas na VPS (`trafego-pasio-api`, `trafego-pasio-web`) saem uma única vez, depois do primeiro redeploy pelo GHCR.
- Verificação:
  - local, antes do commit (agente pipeline): build dos dois alvos ok (`api` em cerca de 67 s, 1,23 GB; `web` em cerca de 103 s, 1,37 GB), `docker compose -f docker-compose.prod.yml config` ok, lint e prettier ok, sem segredos;
  - primeiro run do workflow Deploy (id 39342060273) verde: `ghcr.io/abnersantosss/dashboard-trafego-pago/api` e `.../web` publicados com `latest` e `sha-e00a616`. O job `redeploy` saiu com o aviso, porque o secret não existe;
  - o CI avisa que as actions `@v4`, `@v3` e `@v6` rodam em Node 20 forçadas para Node 24 e que `ubuntu-latest` migra para Ubuntu 26 a partir de 2026-10-19 (só avisos);
  - **pendente**: o "Pull and redeploy" da stack com as imagens do GHCR. Ele foi barrado pelo classificador do Claude Code (deploy em produção) e fica com o usuário ([[operacao/retomada]]).
- Substitui, em D39, o trecho "Stack pelo repositório Git (`docker-compose.prod.yml` com `build:`) … `pull_policy: build`": a stack continua criada pelo Git, mas o compose não tem mais `build:`.

## D42: webhook com autenticação Basic e preset de regras da GTech (2026-10-20)
- Contexto: validar o painel com a plataforma demo da GTech (`latam.gtech.uy`). O backoffice da GTech só permite credencial **BASIC** (Usuário e Senha) no webhook; não assina com HMAC nem manda `X-Timestamp`/`X-Event-Id`. O receptor só aceitava HMAC (D13), e o motor de regras não conseguia trocar `R$` por `BRL`, ignorar o depósito pendente nem ler campos que mudaram de nome entre versões da documentação. Commit `5ef4829`.
- Decisão:
  - **Dois modos na mesma rota**: com `X-Timestamp` ou `X-Signature`, HMAC como antes; sem eles, `Authorization: Basic` com a **senha = segredo da fonte** e usuário livre (convenção: slug da fonte). Comparação em tempo constante; mesma resposta 401 `assinatura_invalida` para senha errada, Basic malformado e fonte sem segredo; sem janela de tempo; idempotência por `X-Event-Id` ou hash do corpo; `authorization` nunca gravado.
  - **Motor**: operadores `coalesce`, `map`, `not_in`, `match` em lista e o bloco `ignorar` ([[regras-de-tratamento/motor-de-regras]]).
  - **Preset `gtech`** em `packages/rules/src/presets/`: `USER_CREATED` → cadastro; `DEPOSIT_PAYMENT` pago → `ftd` se `approved_deposits == 1`, senão `deposito`; `DEPOSIT_CREATED` ignorado; `R$` → BRL; `lead_key` = `user_id`; UTMs de `tracker`; `affiliate_id` = `tracker.afp`.
  - **Primeiro depósito gera só `ftd`**, porque `agregar.ts` já soma o FTD em Depósitos; gerar os dois dobraria o valor.
  - **Script `aplicar-preset.ts`** publica o preset numa fonte (versão nova só se o conteúdo mudou) e opcionalmente reprocessa os brutos.
  - Configurações → Webhooks e Instalação explicam o modo Basic (tabela Fonte | URL | Tipo de credencial | Usuário | Senha e exemplo `curl -u`).
- Alternativas descartadas:
  - **proxy que converte Basic em HMAC**: mais uma peça para manter, sem ganho de segurança (o segredo é o mesmo);
  - **segredo na URL** (`?token=`): fica em logs de proxy e do túnel;
  - **gerar `ftd` e `deposito` no primeiro depósito**: conta o valor em dobro em Depósitos.
- Consequências:
  - o Basic não tem proteção contra replay por tempo; a idempotência pelo hash do corpo cobre o reenvio idêntico. Exige HTTPS (o túnel da Cloudflare força);
  - status não pago e evento desconhecido vão para erro/dead-letter de propósito, para aparecerem;
  - **LGPD (em aberto)**: o bruto da GTech traz e-mail, nome, documento, data de nascimento, `user_token` e `qrcode`, e fica inteiro em `webhook_events.payload`. Mascarar ou remover antes de gravar é decisão do usuário;
  - não mapeados: `is_demo` (não filtrado), `utm_term`, `utm_content`, `fbp`, `fbc` (sem campo canônico).
- Verificação: testes de unidade e de rota do modo Basic, preset com fixtures fictícias, `aplicar-preset.test.ts` e o ponta a ponta `apps/api/src/e2e/gtech.test.ts` (4 POSTs Basic → worker → visão geral com 1 cadastro, 1 FTD de 20 e Depósitos 70,5; reenvio 200; senha errada 401). Lint, typecheck, build e todas as suítes verdes antes do push.
- Em produção (2026-10-20): redeploy às 14:40, fonte `gtech` criada às 14:47 e preset na versão 1 ativa. Os dois webhooks no backoffice da GTech dependem do usuário colar o segredo. Estado e passos em [[ingestao-webhooks/gtech]].
