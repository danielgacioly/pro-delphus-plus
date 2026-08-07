# O front é estático: o Vite gera os arquivos e o nginx serve. O mesmo nginx faz
# proxy de /api e /uploads para a API, então navegador e API ficam na mesma
# origem e o cookie de refresh não depende de configuração de terceiros.
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace=packages/shared \
 && npm run build --workspace=apps/web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
