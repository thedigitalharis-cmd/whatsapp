#!/usr/bin/env bash
# =============================================================================
#  WhatsApp CRM — Zero-downtime redeploy script for betteraisender.com
#  Usage:  sudo bash deploy/deploy.sh
#  Run this on the server after any code change, or triggered by GitHub Actions.
# =============================================================================
set -euo pipefail

APP_DIR="/opt/whatsapp-crm"
ENV_FILE="$APP_DIR/deploy/.env.production"
COMPOSE="docker compose -f $APP_DIR/docker-compose.server.yml --env-file $ENV_FILE"

cd "$APP_DIR"

echo "[deploy] Pulling latest code..."
git fetch origin main
git reset --hard origin/main

echo "[deploy] Writing frontend env..."
cat > "$APP_DIR/frontend/.env" << 'EOF'
REACT_APP_API_URL=https://betteraisender.com/api
REACT_APP_WS_URL=https://betteraisender.com
SKIP_PREFLIGHT_CHECK=true
GENERATE_SOURCEMAP=false
EOF

echo "[deploy] Building Docker images locally..."
$COMPOSE build --no-cache backend frontend

echo "[deploy] Running database migrations..."
$COMPOSE run --rm backend npx prisma migrate deploy

echo "[deploy] Rolling update: backend..."
$COMPOSE up -d --no-deps backend
sleep 10

# Wait for backend health
for i in $(seq 1 20); do
  if docker inspect --format='{{.State.Health.Status}}' crm_backend 2>/dev/null | grep -q healthy; then
    echo "[deploy] Backend healthy"; break
  fi
  echo "[deploy] Waiting for backend ($i/20)..."; sleep 5
done

echo "[deploy] Rolling update: frontend..."
$COMPOSE up -d --no-deps frontend

echo "[deploy] Reloading nginx..."
docker exec crm_nginx nginx -s reload

echo "[deploy] Cleaning up old images..."
docker image prune -f --filter "until=24h" 2>/dev/null || true

echo "[deploy] ✅ Deploy complete"
$COMPOSE ps
