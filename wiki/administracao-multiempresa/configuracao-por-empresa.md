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
