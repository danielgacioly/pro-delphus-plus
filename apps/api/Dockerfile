# Imagem da API. Precisa do Chromium do sistema: a geração de orçamento, invoice
# e packing list é feita pelo Puppeteer, e o Chromium que ele baixa sozinho não
# roda em imagem slim (faltam as libs de sistema).
FROM node:22-bookworm-slim AS base
ENV PUPPETEER_SKIP_DOWNLOAD=true

# ─── Dependências ─────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci

# ─── Build ────────────────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace=packages/shared \
 && npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build --workspace=apps/api

# Reinstala só o que roda em produção, para a imagem final não levar o TypeScript
# e o resto do ferramental de build.
RUN npm ci --omit=dev

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM base AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      ca-certificates \
      postgresql-client \
      tini \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    UPLOADS_DIR=/app/uploads

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/generated ./apps/api/generated
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
# O CLI do Prisma lê a URL do banco daqui, e só encontra o arquivo se ele
# estiver no diretório de trabalho — por isso o entrypoint entra em apps/api.
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY apps/api/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# O volume de uploads pertence ao usuário node, que é quem serve a aplicação.
# O container inicia como root apenas para rodar as migrações; o entrypoint
# derruba o privilégio com setpriv antes de subir o servidor.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini vira PID 1: sem ele os processos do Chromium viram zumbis a cada PDF
# gerado e o container acaba estourando o limite de processos.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
