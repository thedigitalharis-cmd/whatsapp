#!/usr/bin/env bash
# =============================================================================
#  WhatsApp CRM — Zero-downtime redeploy script
#  Usage:  sudo bash deploy/deploy.sh [IMAGE_TAG]
#  Example: sudo bash deploy/deploy.sh v1.2.3
# =============================================================================
set -euo pipefail

APP_DIR="/opt/whatsapp-crm"
ENV_FILE="$APP_DIR/deploy/.env.production"
IMAGE_TAG="${1:-latest}"

cd "$APP_DIR"

echo "[deploy] Pulling latest code..."
git pull origin main

echo "[deploy] Updating IMAGE_TAG to $IMAGE_TAG in env..."
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$IMAGE_TAG/" "$ENV_FILE"

echo "[deploy] Pulling new Docker images..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" pull backend frontend

echo "[deploy] Running database migrations..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" \
  run --rm backend npx prisma migrate deploy

echo "[deploy] Rolling update: backend..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" \
  up -d --no-deps --no-recreate backend
sleep 5
# Wait for health
for i in $(seq 1 20); do
  if docker inspect --format='{{.State.Health.Status}}' crm_backend 2>/dev/null | grep -q healthy; then
    echo "[deploy] Backend healthy"; break
  fi
  echo "[deploy] Waiting for backend ($i/20)..."; sleep 5
done

echo "[deploy] Rolling update: frontend..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" \
  up -d --no-deps --no-recreate frontend

echo "[deploy] Reloading nginx..."
docker exec crm_nginx nginx -s reload

echo "[deploy] ✅ Deploy complete — tag: $IMAGE_TAG"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" ps
