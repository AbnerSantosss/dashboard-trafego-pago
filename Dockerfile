# Imagens de produção (P7.2), usadas por docker-compose.prod.yml: alvo `api` e alvo `web`.
# Node 24 porque a senha usa crypto.argon2 (existe desde o Node 24.7).
FROM node:24-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1 CI=1
RUN npm install -g pnpm@12.11.2
WORKDIR /app

# Só o lockfile: a camada do store fica em cache enquanto as dependências não mudarem.
FROM base AS store
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch

# API: roda com tsx, porque os pacotes internos são consumidos como fonte TypeScript.
FROM store AS api-deps
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "@trafego/api..."

FROM base AS api
ENV NODE_ENV=production
COPY --from=api-deps --chown=node:node /app /app
WORKDIR /app/apps/api
USER node
EXPOSE 3001
# Lê os segredos gerados no servidor, prepara o banco (migrações, app_user, empresa e admin) e só
# então sobe o servidor.
ENV IMPORTS="--import tsx --import ./src/segredos-do-servidor.ts"
CMD ["sh", "-c", "node $IMPORTS src/db/producao.ts && exec node $IMPORTS src/server.ts"]

FROM store AS web-build
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "@trafego/web..." \
  && pnpm --filter "@trafego/web..." build

FROM base AS web
ENV NODE_ENV=production
COPY --from=web-build --chown=node:node /app /app
WORKDIR /app/apps/web
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
