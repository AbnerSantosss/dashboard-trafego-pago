# Contrato de erros da API

Toda resposta de erro, de qualquer rota, tem o mesmo formato:

```json
{
  "erro": {
    "codigo": "validacao_invalida",
    "mensagem": "Dados da requisição inválidos.",
    "detalhes": [{ "origem": "body", "campo": "nome", "mensagem": "Too small: expected string to have >=2 characters" }],
    "requestId": "3f0c2a8e-5b1d-4c47-9a6e-0d2f7c9b1e44"
  }
}
```

- `codigo`: snake_case em pt-BR, estável (o front e os emissores de webhook podem depender dele).
- `mensagem`: texto para humanos; pode mudar.
- `detalhes`: opcional. Em erros de validação é uma lista `{ origem, campo, mensagem }` (`origem` é `body`, `querystring`, `params` ou `headers`).
- `requestId`: o mesmo valor do cabeçalho `x-request-id` da resposta e do campo `requestId` dos logs. Se o cliente mandar `x-request-id` (até 128 caracteres `[A-Za-z0-9._:-]`), ele é reaproveitado; senão é um UUID novo.

## Códigos

| Status | Código | Quando |
|---|---|---|
| 400 | `requisicao_invalida` | Erro 400 genérico |
| 400 | `validacao_invalida` | Falha no schema zod da rota (body, query, params, headers) |
| 400 | `json_invalido` | Corpo não é JSON válido |
| 400 | `cabecalho_ausente` | Cabeçalho obrigatório faltando (ex.: `X-Signature` no webhook) |
| 400 | `empresa_nao_informada` | Rota exige empresa ativa e não veio claim `tenant` nem cabeçalho `x-tenant` |
| 401 | `nao_autenticado` | Sem cabeçalho `Authorization: Bearer` |
| 401 | `token_invalido` | JWT expirado, com assinatura errada, malformado ou com claims inválidas |
| 401 | `assinatura_invalida` | HMAC do webhook não confere |
| 401 | `timestamp_fora_da_janela` | `X-Timestamp` fora da janela de 5 min |
| 403 | `acesso_negado` | Sem membership na empresa pedida, ou papel abaixo do exigido (admin > analista > leitor) |
| 404 | `nao_encontrado` | Rota, empresa, fonte ou recurso inexistente |
| 405 | `metodo_nao_permitido` | Método não suportado |
| 409 | `conflito` | Violação de unicidade ou estado incompatível |
| 413 | `corpo_grande` | Corpo acima de 1 MB (`bodyLimit`) |
| 415 | `tipo_conteudo_invalido` | `Content-Type` não suportado |
| 429 | `limite_excedido` | Limite de taxa (`@fastify/rate-limit`, 300 req/min por IP) |
| 500 | `erro_interno` | Qualquer erro não previsto. Mensagem genérica; stack só no log |
| 503 | `servico_indisponivel` | Dependência fora (banco no `GET /ready`, fila) |

## Como lançar erros nas rotas

```ts
import { ErroApi } from '../erros.js';

throw ErroApi.de('conflito', 'Já existe uma empresa com esse slug.', { campo: 'slug' });
throw new ErroApi(401, 'assinatura_invalida', 'Assinatura HMAC inválida.');
```

Os atalhos do `@fastify/sensible` (`reply.forbidden()`, `reply.notFound()`, `httpErrors.conflict()`…) também caem no contrato, com o código padrão do status.

Para documentar no OpenAPI, use `schemaRespostaErro` (de `src/erros.ts`) em `schema.response` da rota.
