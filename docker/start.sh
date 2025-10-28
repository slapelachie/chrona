#!/bin/sh
set -euo pipefail

mask_dsn() {
  printf '%s' "$1" | sed -E 's#(postgresql://[^:]+:)[^@]*#\1********#'
}

url_host() {
  printf '%s' "$1" | sed -nE 's#^postgresql://[^@]+@([^:/]+).*#\1#p'
}

url_port() {
  printf '%s' "$1" | sed -nE 's#^postgresql://[^@]+@[^:/]+:(\\d+).*#\1#p'
}

DB_SCHEMA="${DB_SCHEMA:-public}"

if [ -z "${DATABASE_URL:-}" ]; then
  DB_HOST="${DB_HOST:-postgres}"
  DB_PORT="${DB_PORT:-5432}"
  DB_USER="${DB_USER:-appuser}"
  DB_PASSWORD="${DB_PASSWORD:-change_me_in_prod}"
  DB_NAME="${DB_NAME:-appdb}"
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=${DB_SCHEMA}"
  export DATABASE_URL
  echo "Constructed DATABASE_URL=$(mask_dsn "$DATABASE_URL")"
else
  echo "Using provided DATABASE_URL=$(mask_dsn "$DATABASE_URL")"
  DB_HOST="${DB_HOST:-$(url_host "$DATABASE_URL")}" 
  DB_PORT="${DB_PORT:-$(url_port "$DATABASE_URL")}" 
fi

[ -n "${DB_HOST:-}" ] || DB_HOST='postgres'
[ -n "${DB_PORT:-}" ] || DB_PORT='5432'

DB_WAIT_HOST="${DB_WAIT_HOST:-$DB_HOST}"
DB_WAIT_PORT="${DB_WAIT_PORT:-$DB_PORT}"
DB_WAIT_RETRIES="${DB_WAIT_RETRIES:-40}"
DB_WAIT_DELAY="${DB_WAIT_DELAY:-1}"

if [ "${SKIP_DB_WAIT:-false}" != "true" ]; then
  echo "Waiting for database at ${DB_WAIT_HOST}:${DB_WAIT_PORT}..."
  RETRY=0
  until npx prisma migrate status >/dev/null 2>&1; do
    RETRY=$((RETRY + 1))
    if [ "$RETRY" -ge "$DB_WAIT_RETRIES" ]; then
      echo "Database not reachable after $DB_WAIT_RETRIES attempts"
      exit 1
    fi
    sleep "$DB_WAIT_DELAY"
  done
else
  echo "SKIP_DB_WAIT=true; skipping database readiness checks"
fi

if [ "${SKIP_PRISMA_MIGRATE:-false}" != "true" ]; then
  echo "Applying Prisma migrations (schema=${DB_SCHEMA})..."
  npx prisma migrate deploy
else
  echo "SKIP_PRISMA_MIGRATE=true; skipping prisma migrate deploy"
fi

APP_PORT="${PORT:-3000}"
SERVER_ENTRYPOINT="${SERVER_ENTRYPOINT:-server.js}"

echo "Starting Next.js (NODE_ENV=${NODE_ENV:-production}) on port ${APP_PORT}..."
exec node "$SERVER_ENTRYPOINT" -p "$APP_PORT"
