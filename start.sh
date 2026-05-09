#!/bin/sh

# Defaults
export CONNECT_URL="${CONNECT_URL:-/api}"
export PUBLIC_PATH="${PUBLIC_PATH:-/}"

# Alpine nginx reads from /etc/nginx/http.d/, not conf.d/.
# Limit substitution to ${PUBLIC_PATH} only so nginx variables like $uri survive.
mkdir -p /etc/nginx/http.d
envsubst '${PUBLIC_PATH}' \
    < /etc/nginx/templates/default.conf.template \
    > /etc/nginx/http.d/default.conf

# settings.js is served via alias /etc/nginx/conf.d/settings.js (see ng.conf.template).
mkdir -p /etc/nginx/conf.d
envsubst \
    < /etc/nginx/templates/settings.js.template \
    > /etc/nginx/conf.d/settings.js

# Python backend
uv run python main.py &

# nginx in foreground
nginx -g "daemon off;"
