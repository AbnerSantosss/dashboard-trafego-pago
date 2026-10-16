---
tipo: referencia
atualizado: 2026-10-16
tags: [seguranca, ambiente, segredos, repositorio-publico, auto-mode, claude-code, producao]
---

# Ambiente e segurança

Retrato do ambiente e das fronteiras de confiança do projeto, levantado em 2026-10-16 pela configuração do modo automático do Claude Code (`/auto-mode-setup`, escopo "só este projeto"). Serve para qualquer agente ou pessoa saber o que é rotina e o que exige cuidado.

## Repositório
- Repositório confiável: esta pasta, com remoto `origin` em `github.com/AbnerSantosss/dashboard-trafego-pago`.
- **É público.** Só o trabalho deste projeto vai para lá, e nada confidencial entra, seja qual for a visibilidade.
- Branch padrão `main`, **sem proteção nem regras** no GitHub: push direto é possível, então cada push pede cuidado (varredura de segredos antes).
- Nenhuma organização, provedor de nuvem, registro de pacotes interno, domínio interno ou bucket confiável configurado.

## Segredos
- Configuração local por `.env`: `DATABASE_URL`, `AUTH_SECRET`, `WEBHOOK_CHAVE_CIFRA`, `SMTP_*`, `EMAIL_REMETENTE`.
- Ignorados pelo git: `.env`, `.env.*`, `apps/api/.env.local`. Só o `.env.example` (sem valores) é versionado. `registro/` também fica fora.
- Chaves de API (OpenRouter, kie.ai, muapi, banco) e credenciais nunca entram em código, wiki, log, commit ou artifact (regra do `CLAUDE.md`). Em produção, as senhas do banco, o `AUTH_SECRET` e a chave de cifra são gerados no próprio servidor e ficam no volume `trafego-pasio_segredos` (D39); as variáveis da stack no Portainer têm só endereços e o e-mail do admin, e esse e-mail não entra no repositório nem na wiki. Detalhes em [[operacao/producao]].
- A análise marcou `apps/api/drizzle/0004_sources_secret_enc.sql` como local sensível. Conferido: é só a migração que cria a coluna `secret_enc` (sem valores); o que é sensível é o **conteúdo** dessa coluna no banco, cifrado com `WEBHOOK_CHAVE_CIFRA` (D18).
- Serviços públicos de colar texto (gist, pastebin) ficam fora da fronteira de confiança.

## Produção
- No ar desde 2026-10-16: painel em `pasio.proxserverabner.site` e API em `pasio-api.proxserverabner.site`, pelo túnel Cloudflare `servidor-abner`; stack `trafego-pasio` em `portainer.proxserverabner.site`.
- Web e API publicam só em `127.0.0.1` do servidor (3480 e 3481) e o banco não publica porta: tudo de fora passa pelo túnel.
- Mexer na stack, nas rotas do túnel ou nos volumes é ação de produção e pede confirmação do usuário. Ver [[operacao/producao]].

## Alvos que exigem confirmação
- Qualquer host, namespace ou contêiner com `prod` ou `production` como palavra ou segmento do nome.
- Infraestrutura como código que mexa em IAM, RBAC, rede, cota ou pools de nós, ou que tenha `prod`/`production` no nome.
- Deploy (Portainer, túnel Cloudflare) e chamadas pagas (geração de imagem): só com confirmação explícita do usuário.
- Não há destino de CI/CD configurado; o CI do GitHub só verifica, não publica.

## Rotina (pode seguir sem pedir)
- Desenvolvimento dentro desta pasta: editar código, `wiki/`, `registro/sessoes/` (só acréscimo) e `PLANO-DE-ACAO.md`.
- Scripts do pnpm: `dev`, `build`, `typecheck`, `lint`, `format`, `test`, `check`, `db:migrate`, `db:seed`.
- Shell do Windows (PowerShell e Git Bash) para uso normal.
- A máquina é um computador comum de desenvolvimento, com internet aberta e sem contenção especial.

## O que não foi levantado
Ficaram de fora porque o escopo escolhido foi "só este projeto": outros repositórios da conta, documentação de repositórios irmãos, uso recente em outros projetos. As regras de permissão existentes do modo automático não puderam ser lidas; a proposta não sugeriu regras novas de permitir ou bloquear, só o texto de ambiente acima.

Relacionado: [[operacao/producao]], [[operacao/retomada]], [[operacao/runbooks]], [[decisoes-tecnicas/decisoes]].
