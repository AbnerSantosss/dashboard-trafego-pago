---
tipo: decisao
atualizado: 2026-10-15
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
