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

