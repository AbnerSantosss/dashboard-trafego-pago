---
tipo: retomada
atualizado: 2026-10-16
tags: [retomada, estado-atual, proximos-passos, ci, operacao]
---

# Retomada: comece por aqui

Página para quem abre o projeto depois de uma pausa. Diz onde o trabalho parou, o que está pendente e em que ordem. Atualize ao fim de cada sessão de trabalho relevante.

## Onde paramos (2026-10-16)
- Fases 1 a 6 concluídas e enviadas para `main` em `github.com/AbnerSantosss/dashboard-trafego-pago` (repositório **público**, ver [[operacao/ambiente-e-seguranca]]).
  - `a567b2b`: Fase 6 (CI, e2e de isolamento G3, item Configurações na sidebar).
  - `5216d62`: Configurações (perfil, usuários e convites, login, tag GTM e cruzamento com o webhook). Detalhes em [[administracao-multiempresa/configuracao-por-empresa]] e nas decisões D19 a D21 de [[decisoes-tecnicas/decisoes]].
- Local: lint, formato, tipos e 248 testes passando (1 pulado).
- Fora do git, de propósito: `apps/api/.env.local` (credenciais SMTP de teste) e `registro/`. O `apps/web/tsconfig.tsbuildinfo` aparece como modificado e não deve ser commitado (é gerado).

## CI: estado e primeiro conserto a fazer
O workflow `.github/workflows/ci.yml` tem dois jobs. No run do commit `5216d62`:
- **check** (ubuntu: lint, formato, tipos, testes com banco, build): **passou**.
- **visual** (windows: diff contra `ref-1.png`, limite 5,5%): **falhou** com `net::ERR_CONNECTION_REFUSED at http://localhost:3000/`. O diff nem chegou a ser medido.
- Causa provável: o passo "Sobe o web com a fixture" inicia o `next start` com `Start-Process` e espera o 200; no runner Windows o processo não sobrevive até o passo seguinte, que roda `pnpm qa:visual`.
- Conserto sugerido: subir o servidor e rodar o comparador **no mesmo passo** (ou trocar o job para ubuntu e iniciar com `&` / `nohup`). Conferir com `gh run list` e `gh run view <id> --log-failed` depois do push.

## Próximos passos, em ordem
1. **Consertar o job visual do CI** (acima) e confirmar os dois jobs verdes.
2. **Segurança de conta**: trocar a senha de app do Gmail usada no teste de e-mail; em produção, as credenciais SMTP vão só nas variáveis do Portainer.
3. **Testar o login real**: em Configurações → Usuários, convidar um e-mail de verdade, aceitar o convite pelo link e entrar. O admin do seed (`admin@pasio.local`) não recebe e-mail; em dev, sem cookie, o painel continua como admin demo (`sessao-dev`).
4. **Fase 7 — Entrega** (ver `PLANO-DE-ACAO.md`):
   - P7.1 wiki essencial (como rodar, cadastrar empresa e webhook, runbook de deploy).
   - P7.2 deploy: `docker-compose.prod.yml` no Portainer com web, api, postgres e cloudflared; túnel Cloudflare; segredos só nas variáveis do Portainer. Definir `WEBHOOK_URL_PUBLICA` (sem ela a tag GTM só funciona na máquina local) e `WEBHOOK_CHAVE_CIFRA`. **Deploy só com confirmação explícita do usuário.**
   - P7.3 entrega final e **Gate G4**: o usuário aprova a fidelidade na tela real.
5. Pendência visual menor herdada da Fase 5: a tabela de fontes de webhook corta a coluna de ações em larguras estreitas.

## Como subir local
Detalhes em [[operacao/runbooks]] (seção Ambiente local). Resumo do que foi usado nesta fase:
- Postgres pelo `docker compose up -d`, exposto em `127.0.0.1:5460` (banco `trafego`; `app_user` para a API com RLS, `postgres` para migrações).
- API: em `apps/api`, `API_PORT=3011` (a 3001 costuma estar ocupada na máquina), `WEB_URL=http://localhost:3000`, `DATABASE_URL` do `.env.example` e um `AUTH_SECRET` local qualquer com 32+ caracteres; `npx tsx src/server.ts`. O SMTP é lido de `apps/api/.env.local`.
- Web: em `apps/web`, `API_URL=http://localhost:3011` e o mesmo `AUTH_SECRET`; `npx next dev -p 3000`.
- Abas novas: `/configuracoes/perfil`, `/configuracoes/usuarios`, `/configuracoes/tag`; login em `/login`.

## Armadilhas desta fase
- Parar o shell da API não mata o `tsx`: o processo node órfão continua segurando a porta 3011. Encerre o processo dono da porta antes de subir de novo.
- Não rode `next build` com o `next dev` aberto: os dois usam `apps/web/.next`.
- O `pnpm check` inclui `pnpm build`; com o dev rodando, use `pnpm lint && pnpm format && pnpm typecheck && pnpm test`.
- Os arquivos gerados pelo drizzle (`apps/api/drizzle/meta/*.json`) saem fora do padrão do prettier: rode `prettier --write` neles depois de `db:generate`.
- Antes de cada push: varredura de segredos (o repositório é público) e conferir que `.env.local` e `registro/` seguem ignorados.

Relacionado: [[log]], [[operacao/ambiente-e-seguranca]], [[orquestracao-agentes/agentes-e-fases]].
