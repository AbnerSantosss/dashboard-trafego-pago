---
tipo: especificacao
atualizado: 2026-10-15
tags: [multiempresa, tenant, configuracao, apresentacao, logo, pasio]
---

# Configuração por empresa

Cada empresa (tenant) tem quatro áreas de configuração, acessíveis a quem tem papel `admin` nela. Telas em `apps/web/app/(admin)/` (Fase 5).

## 1. Webhooks (fontes) — P5.1
Criar fonte → gera URL `POST /webhooks/{empresa}/{fonte}` e segredo (mostrado uma vez). Ações: rotacionar segredo, ativar/desativar, ver últimos eventos e erros, reenviar. Ver [[ingestao-webhooks/contrato-webhook]].

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
