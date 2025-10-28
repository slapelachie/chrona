#!/bin/sh
set -e

# Defaults that match the Postgres service
DB_HOST="${DB_HOST:?DB_HOST is required}"
DB_USER="${DB_USER:-appuser}"
DB_PASSWORD="${DB_PASSWORD:-change_me_in_prod}"
DB_NAME="${DB_NAME:-appdb}"
DB_PORT="${DB_PORT:-5432}"

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

echo "Using DATABASE_URL=${DATABASE_URL}"
echo "Waiting for database at ${DB_HOST}:${DB_PORT}..."
MAX_RETRIES=40
RETRY=0
until npx prisma migrate status >/dev/null 2>&1; do
  RETRY=$((RETRY+1))
  if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
    echo "Database not reachable after $MAX_RETRIES attempts"
    exit 1
  fi
  sleep 1
done

echo "Applying migrations..."
npx prisma migrate deploy

echo "Starting Next.js (NODE_ENV=$NODE_ENV)..."
node server.js -p ${PORT:-3000}
