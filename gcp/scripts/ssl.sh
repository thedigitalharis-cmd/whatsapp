#!/usr/bin/env bash
# Run this after DNS is pointed to the server
source "$(dirname "$0")/../gcp-deployment.env" 2>/dev/null || true

PROJECT_ID="${GCP_PROJECT:-}"
ZONE="${GCP_ZONE:-us-central1-a}"
VM_NAME="${GCP_VM_NAME:-whatsapp-crm}"
SSL_EMAIL="${1:-}"

[ -z "$SSL_EMAIL" ] && read -rp "SSL email: " SSL_EMAIL
[ -z "$PROJECT_ID" ] && read -rp "GCP Project ID: " PROJECT_ID

gcloud config set project "$PROJECT_ID"

gcloud compute ssh "$VM_NAME" --zone="$ZONE" --command="
  docker compose -f /opt/whatsapp-crm/docker-compose.prod.yml \
    --env-file /opt/whatsapp-crm/deploy/.env.production \
    run --rm certbot certbot certonly \
    --webroot -w /var/www/certbot \
    -d betteraisender.com -d www.betteraisender.com \
    --email $SSL_EMAIL --agree-tos --non-interactive --no-eff-email

  cp /opt/whatsapp-crm/deploy/nginx.betteraisender.conf /opt/whatsapp-crm/deploy/nginx.active.conf
  docker exec crm_nginx nginx -s reload
  echo '✅ SSL enabled at https://betteraisender.com'
" -- -o StrictHostKeyChecking=no
