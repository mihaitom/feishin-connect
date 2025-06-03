# --- Builder stage
FROM node:18-alpine as builder
WORKDIR /app

# Copy package.json first to cache node_modules
COPY package.json pnpm-lock.yaml .

RUN pnpm install

# Copy code and build with cached modules
COPY . .
RUN pnpm run build:web

# --- Production stage
FROM nginx:alpine-slim

COPY --chown=nginx:nginx --from=builder /app/release/app/dist/web /usr/share/nginx/html
COPY ./settings.js.template /etc/nginx/templates/settings.js.template
COPY ng.conf.template /etc/nginx/templates/default.conf.template

ENV PUBLIC_PATH="/"
EXPOSE 9180
CMD ["nginx", "-g", "daemon off;"]
