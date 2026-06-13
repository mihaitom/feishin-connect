# --- Build frontend
FROM node:23-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.5.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm i

COPY . .

RUN pnpm run build:web


# --- Final image
FROM ghcr.io/astral-sh/uv:python3.14-alpine

WORKDIR /app

RUN apk add --no-cache nginx gettext ffmpeg
COPY --chown=nginx:nginx --from=builder /app/out/web /usr/share/nginx/html 
COPY --chown=nginx:nginx ./settings.js.template /etc/nginx/templates/settings.js.template 
COPY --chown=nginx:nginx ng.conf.template /etc/nginx/templates/default.conf.template

RUN apk add --no-cache \
    build-base \
    zlib-dev \
    jpeg-dev \
    freetype-dev \
    libpng-dev \
    musl-dev

COPY connect/pyproject.toml ./
COPY connect/uv.lock ./
RUN uv sync --locked
COPY connect/. .

COPY start.sh /start.sh
RUN chmod +x /start.sh

ENV SERVER_LOCK=false SERVER_NAME="" SERVER_TYPE="" SERVER_URL="" REMOTE_URL=""
ENV LEGACY_AUTHENTICATION="" ANALYTICS_DISABLED="" PUBLIC_PATH="/" SERVER_INTERNAL_URL="" CONNECT_URL=/api

EXPOSE 9180
EXPOSE 8000

CMD ["/start.sh"]
