#!/usr/bin/env bash
# =============================================================================
# WhatsApp CRM — Full server recovery (GCP / VPS)
# Fixes: nginx config missing, Postgres P1000 password mismatch, stale crm_nginx,
#        stack not running. Does NOT delete your database volume.
#
# Usage (on the VM):
#   cd /opt/whatsapp-crm && sudo git pull origin main && sudo bash deploy/recover-server.sh
#
# Rebuild images only if you know the VM has enough RAM (otherwise omit):
#   sudo REBUILD=1 bash deploy/recover-server.sh
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/whatsapp-crm}"
ENV_FILE="${ENV_FILE:-$APP_DIR/deploy/.env.production}"

cd "$APP_DIR"

# Minimal editor for .env on stock Ubuntu images (Cloud VMs often have no nano)
if [[ "${EUID:-0}" -eq 0 ]] && ! command -v nano >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq nano >/dev/null 2>&1 || true
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Missing $ENV_FILE — create it first (see deploy/.env.production in repo)." >&2
  exit 1
fi

if [[ "${EUID:-0}" -ne 0 ]] && ! docker info &>/dev/null; then
  echo "ERROR: Run as root so Docker works: sudo bash deploy/recover-server.sh" >&2
  exit 1
fi

DC=(docker compose -f docker-compose.server.yml --env-file "$ENV_FILE")

echo "[recover] Ensuring nginx.active.conf exists..."
if [[ ! -f deploy/nginx.active.conf ]]; then
  cp deploy/nginx.betteraisender.conf deploy/nginx.active.conf
  echo "[recover] Created deploy/nginx.active.conf from nginx.betteraisender.conf"
fi

read_env() {
  local key="$1"
  local line
  line=$(grep -E "^${key}=" "$ENV_FILE" | head -1 || true)
  [[ -z "$line" ]] && { echo ""; return; }
  local val="${line#*=}"
  val="${val%$'\r'}"
  val="${val#\"}"; val="${val%\"}"
  val="${val#\'}"; val="${val%\'}"
  printf '%s' "$val"
}

POSTGRES_USER="$(read_env POSTGRES_USER)"
POSTGRES_USER="${POSTGRES_USER:-crm_user}"
POSTGRES_DB="$(read_env POSTGRES_DB)"
POSTGRES_DB="${POSTGRES_DB:-whatsapp_crm}"
POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD)"

if [[ -z "$POSTGRES_PASSWORD" ]]; then
  echo "ERROR: POSTGRES_PASSWORD is empty in $ENV_FILE" >&2
  exit 1
fi

escape_sql_literal() {
  printf '%s' "$1" | sed "s/'/''/g"
}
PW_SQL="$(escape_sql_literal "$POSTGRES_PASSWORD")"

echo "[recover] Removing stale nginx container name if present..."
docker rm -f crm_nginx 2>/dev/null || true

echo "[recover] Starting PostgreSQL and Redis..."
"${DC[@]}" up -d postgres redis

echo "[recover] Waiting for PostgreSQL..."
for i in $(seq 1 45); do
  if docker exec crm_postgres pg_isready -U "$POSTGRES_USER" &>/dev/null; then
    break
  fi
  if [[ "$i" -eq 45 ]]; then
    echo "ERROR: Postgres did not become ready." >&2
    docker logs crm_postgres --tail 80 >&2 || true
    exit 1
  fi
  sleep 2
done

echo "[recover] Syncing DB user password to match $ENV_FILE (fixes Prisma P1000)..."
set +e
docker exec crm_postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
  -c "ALTER USER ${POSTGRES_USER} WITH PASSWORD '${PW_SQL}';"
ALTER_RC=$?
set -e
if [[ "$ALTER_RC" -ne 0 ]]; then
  echo "[recover] WARNING: ALTER USER failed. If this is a fresh DB volume, ignore once." >&2
  docker logs crm_postgres --tail 30 >&2 || true
fi

REBUILD="${REBUILD:-0}"
UP_ARGS=(up -d)
if [[ "$REBUILD" == "1" ]]; then
  echo "[recover] REBUILD=1 — docker compose will rebuild (needs enough RAM)."
  UP_ARGS+=(--build)
fi

echo "[recover] Starting full stack..."
"${DC[@]}" "${UP_ARGS[@]}"

echo "[recover] Restarting backend so it reconnects to Postgres with the synced password..."
"${DC[@]}" restart backend

echo "[recover] Waiting for backend /health inside container..."
OK=0
for i in $(seq 1 90); do
  if docker exec crm_backend node -e "require('http').get('http://127.0.0.1:5000/health',r=>process.exit(r.statusCode===200?0:1))" &>/dev/null; then
    OK=1
    break
  fi
  sleep 2
done
if [[ "$OK" -ne 1 ]]; then
  echo "[recover] ERROR: Backend not healthy. Last backend logs:" >&2
  docker logs crm_backend --tail 100 >&2 || true
  exit 1
fi

echo "[recover] Running Prisma migrations..."
if ! "${DC[@]}" exec -T backend npx prisma migrate deploy; then
  echo "[recover] ERROR: prisma migrate deploy failed." >&2
  docker logs crm_backend --tail 100 >&2 || true
  exit 1
fi

docker exec crm_nginx nginx -s reload 2>/dev/null || true

echo ""
echo "[recover] Status:"
"${DC[@]}" ps

echo ""
echo "[recover] curl http://127.0.0.1/health"
if curl -fsS http://127.0.0.1/health; then
  echo ""
  echo "[recover] OK — Nginx can reach the backend."
else
  echo "" >&2
  echo "[recover] WARNING: /health via localhost failed. Nginx logs:" >&2
  docker logs crm_nginx --tail 40 >&2 || true
  exit 1
fi

DOMAIN_VAL="$(read_env DOMAIN)"
DOMAIN_VAL="${DOMAIN_VAL:-betteraisender.com}"
echo ""
echo "[recover] Done. Open https://${DOMAIN_VAL}/ in your browser."
