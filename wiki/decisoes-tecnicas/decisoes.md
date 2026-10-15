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

## D5 — Ícones em SVG; raster só grátis ou com confirmação (2026-10-15)
- SVG à mão (base Lucide/Tabler) é o padrão. Raster só com stable-diffusion local (grátis) ou Nano Banana 2 Lite (US$ 0,034) após confirmação do usuário.

## D6 — PASIO é a primeira empresa; ícone e nome trocáveis (2026-10-15)
- O usuário enviou o ícone oficial da PASIO (`https://pasion.poker/imagens/20260919_6aaf26189bd87.png`, PNG 428×135 px, 44 KB, formato horizontal). Ele é o logo padrão da empresa PASIO (`packages/design/brand/pasio-logo.png`) e substitui o quadrado roxo "Logo" da imagem de referência na sidebar.
- A configuração de apresentação por empresa (P5.4) mantém a troca de ícone e de nome exibido. Ver [[administracao-multiempresa/configuracao-por-empresa]].

## D7 — Um escritor por conjunto de arquivos (2026-10-15)
- Cada subagente escreve só na sua área; integração por PR revisado pelo orquestrador. Ver [[orquestracao-agentes/agentes-e-fases]].

## D8 — Segredos nunca no repositório (2026-10-15)
- Nenhuma chave de API (OpenRouter, kie.ai, muapi, banco) em código, wiki, log ou artifact. `.env.example` sem valores.
