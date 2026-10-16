# Administração por empresa (Fase 5 enxuta)

Contrato fixo em `packages/contratos/src/admin.ts`. Todas as rotas exigem token, empresa ativa
(`x-tenant` ou claim `tenant`) e papel `admin` nela; analista/leitor recebem 403 `acesso_negado`.
Leitura e escrita rodam sob RLS (`request.comTenant`), então uma empresa nunca enxerga outra.

## Apresentação (P5.1)

| Rota | Resposta |
| --- | --- |
| `GET /empresas/atual/apresentacao` | 200 `ApresentacaoResposta` |
| `PATCH /empresas/atual/apresentacao` | 200 `ApresentacaoResposta` |

- `nomeExibicao`: trim, 1–60 caracteres (400 `validacao_invalida` se vazio).
- `logo: { tipo, base64 }` (base64 sem prefixo `data:`) é gravado em `presentation.logo_url` como
  `data:<tipo>;base64,...`; `logo: null` apaga (volta ao padrão).
- Validação do logo: base64 inválido → 422 `logo_invalido`; decodificado > 512 KB → 413
  `logo_grande`; PNG precisa da assinatura `89 50 4E 47 0D 0A 1A 0A`; SVG precisa ser UTF-8 com
  raiz `<svg` e não pode conter `<script`, atributos `on*=`, `javascript:` nem `<foreignObject`
  (422 `logo_invalido`).
- `logoPadraoUrl`: `/brand/pasio-logo.png` para a empresa `pasio`, `null` nas demais.
- Depois do PATCH o cache da Visão Geral da empresa é limpo.

## Fontes de webhook (P5.2)

| Rota | Resposta |
| --- | --- |
| `GET /empresas/atual/fontes` | 200 `{ fontes: FonteResumo[] }` |
| `POST /empresas/atual/fontes` `{ slug, nome }` | 201 `FonteComSegredo`; 409 `fonte_existente` |
| `PATCH /empresas/atual/fontes/:id` `{ nome?, ativo? }` | 200 `FonteResumo`; 404 `fonte_nao_encontrada` |
| `POST /empresas/atual/fontes/:id/segredo` | 200 `FonteComSegredo`; 404 `fonte_nao_encontrada` |

- `slug`: `^[a-z0-9][a-z0-9-]*$`, 2–40 caracteres. `caminho` = `/webhooks/<empresa>/<fonte>`.
- `segredoUtilizavel`: há `secret_enc` no banco ou entrada `empresa/fonte` em `WEBHOOK_SEGREDOS`.
- Segredo novo: 32 bytes aleatórios em base64url, mostrado **uma vez** na resposta. O banco guarda
  `secret_hash` (scrypt, mesmo formato do seed) e `secret_enc`. Nunca vai para log (o logger não
  serializa corpos de resposta; há teste em nível `trace`).
- Rotação: o segredo anterior deixa de valer na hora (o cache do fallback é chaveado pelo hash).

## Cifra e recebimento

- `secret_enc` = AES-256-GCM, formato `v1$<iv b64url>$<tag b64url>$<ct b64url>` (`src/admin/cifra.ts`).
- Chave: `WEBHOOK_CHAVE_CIFRA` (32 bytes em base64 ou hex), obrigatória em produção. Fora de produção,
  ausente, é derivada de `sha256(AUTH_SECRET)` e a API loga um aviso na subida (sem valor). Trocar a
  chave torna os `secret_enc` existentes ilegíveis: rotacione os segredos das fontes depois.
- `POST /webhooks/:empresa/:fonte` resolve o segredo assim: `secret_enc` decifrado → `WEBHOOK_SEGREDOS`
  (validado contra `secret_hash`) → sem segredo = 401 `assinatura_invalida`.
- Migração: `drizzle/0004_sources_secret_enc.sql` (`ALTER TABLE sources ADD COLUMN secret_enc text`).
