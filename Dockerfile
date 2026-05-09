# --- Build frontend
FROM node:23-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN npm run build:web


# --- Final image
FROM ghcr.io/astral-sh/uv:python3.14-alpine

WORKDIR /app

RUN apk add --no-cache nginx
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

EXPOSE 9180
EXPOSE 8000

CMD ["/start.sh"]
