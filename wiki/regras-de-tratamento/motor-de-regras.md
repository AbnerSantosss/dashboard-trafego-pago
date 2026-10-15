---
tipo: especificacao
atualizado: 2026-10-15
tags: [regras, jsonpath, canal, utm, versionamento]
---

# Motor de regras

Pacote `packages/rules`, puro (sem banco), testado com Vitest. Entrada: payload bruto + regras da fonte. Saída: lista de eventos canônicos ou erro com motivo.

## Mapeamento (por fonte, versionado)
JSON com um bloco por tipo de evento canônico (`gasto`, `clique`, `visita`, `cadastro`, `ftd`, `deposito`):
```json
{
  "version": 3,
  "match": { "path": "$.event", "equals": "first_deposit" },
  "type": "ftd",
  "fields": {
    "occurred_at": { "path": "$.created_at", "format": "iso" },
    "value":       { "path": "$.amount", "divide": 100 },
    "currency":    { "const": "BRL" },
    "lead_key":    { "path": "$.user.id" },
    "utm_source":  { "path": "$.utm.source", "lower": true },
    "page":        { "path": "$.landing_page" }
  }
}
```
Operadores suportados: `path` (JSONPath), `const`, `format` (iso, epoch_s, epoch_ms, dd/mm/yyyy), `divide`, `multiply`, `lower`, `trim`, `default`, `regex`.

## Classificador de canal
Lista ordenada de regras da empresa; a primeira que casa vence; sem casamento → `Outros`.
| Ordem | Condição | Canal |
|---|---|---|
| 1 | `affiliate_id` presente ou `utm_medium = affiliate` | Afiliados |
| 2 | `utm_source in (facebook, instagram, meta)` ou referrer `facebook.com` | Meta |
| 3 | `utm_medium = email` | Email |
| 4 | `utm_medium = sms` | SMS |
| 5 | fallback | Outros |

Canais são configuráveis por empresa (nome, cor, ordem na tabela). Ver [[administracao-multiempresa/configuracao-por-empresa]].

## Versionamento e simulação
- Toda alteração cria uma nova versão; só uma ativa por fonte. Histórico com autor e data.
- Tela de simulação: cola um payload, vê o evento canônico resultante e o canal atribuído antes de publicar.
- Reprocessamento em lote aplica a versão ativa aos brutos escolhidos ([[ingestao-webhooks/contrato-webhook]]).

## Armadilhas
- Moeda em centavos vs. reais: sempre declarar `divide` explicitamente; o default não converte.
- `lead_key` ausente impede deduplicação de cadastro/FTD do mesmo lead; o motor avisa, mas não bloqueia.
- Regras que casam mais de um tipo para o mesmo payload geram vários eventos; isso é intencional (ex.: visita + cadastro).

Relacionado: [[regras-de-tratamento/metricas-e-kpis]], [[arquitetura/modelo-de-dados]].
