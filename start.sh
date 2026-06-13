#!/bin/sh

# Defaults
export CONNECT_URL="${CONNECT_URL:-/api}"
export PUBLIC_PATH="${PUBLIC_PATH:-/}"
export CONNECT_TOKEN="${CONNECT_TOKEN:-SzArltWiDYl44aguM2qy5qQJAD15WV3MOIzsKGnvdXeGIn4kS5JHgVBrgfiUm6y5}"

# nginx access logging is off by default and only enabled with DEBUG=true,
# matching the Python backend's DEBUG-gated verbose logging.
case "$(printf '%s' "$DEBUG" | tr '[:upper:]' '[:lower:]')" in
    1 | true | yes | on) export NGINX_ACCESS_LOG="access_log /dev/stdout connect;" ;;
    *) export NGINX_ACCESS_LOG="access_log off;" ;;
esac

# Alpine nginx reads from /etc/nginx/http.d/, not conf.d/.
# Limit substitution to named vars only so nginx variables like $uri survive.
mkdir -p /etc/nginx/http.d
envsubst '${PUBLIC_PATH} ${CONNECT_TOKEN} ${NGINX_ACCESS_LOG}' \
    < /etc/nginx/templates/default.conf.template \
    > /etc/nginx/http.d/default.conf

# settings.js is served via alias /etc/nginx/conf.d/settings.js (see ng.conf.template).
mkdir -p /etc/nginx/conf.d
envsubst \
    < /etc/nginx/templates/settings.js.template \
    > /etc/nginx/conf.d/settings.js

# Python backend
(cd /app && .venv/bin/python main.py) &
API_PID=$!

# nginx (keep in background so we can monitor backend process)
nginx -g "daemon off;" &
NGINX_PID=$!

# If backend exits, stop nginx and fail container with backend exit code.
wait "$API_PID"
API_EXIT=$?
echo "Backend process exited with code ${API_EXIT}. Stopping nginx..."
kill "$NGINX_PID" 2>/dev/null || true
wait "$NGINX_PID" 2>/dev/null || true
exit "$API_EXIT"