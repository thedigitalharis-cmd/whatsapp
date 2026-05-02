#!/usr/bin/env bash
# Manually renew SSL — run if certbot auto-renewal fails
APP_DIR="/opt/whatsapp-crm"
ENV_FILE="$APP_DIR/deploy/.env.production"
source "$ENV_FILE"

docker compose -f "$APP_DIR/docker-compose.prod.yml" --env-file "$ENV_FILE" \
  run --rm certbot certbot renew --webroot -w /var/www/certbot --quiet

docker exec crm_nginx nginx -s reload
echo "SSL renewed and nginx reloaded"
