# --- Builder stage
FROM node:23-alpine as builder
WORKDIR /app

# PUBLIC_PATH at build time: passed as VITE_BASE_PATH so assets are built for that subpath.
# Use "/" for root or "/feishin/" for a subpath (trailing slash required for subpaths).
ARG PUBLIC_PATH=/
ENV PUBLIC_PATH=${PUBLIC_PATH}

# Copy package.json first to cache node_modules
COPY package.json pnpm-lock.yaml .

RUN npm install -g pnpm

RUN pnpm install

# Copy code and build with cached modules
# Normalize PUBLIC_PATH to trailing slash for subpaths (Vite base expects "/" or "/foo/")
COPY . .
RUN VITE_BASE_PATH=$(echo "$PUBLIC_PATH" | sed 's|/*$|/|') && \
    export VITE_BASE_PATH && \
    pnpm run build:web

# --- Production stage
FROM nginx:alpine-slim

ARG PUBLIC_PATH=/
ENV PUBLIC_PATH=${PUBLIC_PATH}

COPY --chown=nginx:nginx --from=builder /app/out/web /usr/share/nginx/html
COPY ./settings.js.template /etc/nginx/templates/settings.js.template
COPY ng.conf.template /etc/nginx/templates/default.conf.template

ENV SERVER_LOCK=false SERVER_NAME="" SERVER_TYPE="" SERVER_URL=""
ENV LEGACY_AUTHENTICATION="" ANALYTICS_DISABLED=""

EXPOSE 9180
CMD ["nginx", "-g", "daemon off;"]
