#!/usr/bin/env bash
# =============================================================================
#  WhatsApp CRM — One-command GCP Compute Engine setup for betteraisender.com
#
#  Cheapest GCP option: e2-small (~$13/mo) or e2-micro FREE TIER ($0/mo)
#  Uses Docker Compose — same as local, runs everything on one VM.
#
#  Usage (run on your LOCAL machine with gcloud installed):
#    bash gcp/scripts/setup-gcp.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[ OK ]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()  { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }

command -v gcloud &>/dev/null || die "Install gcloud CLI: https://cloud.google.com/sdk/docs/install"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   WhatsApp CRM — GCP Setup for betteraisender.com        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─── Inputs ──────────────────────────────────────────────────────────────────
read -rp "GCP Project ID (create at console.cloud.google.com): " PROJECT_ID
read -rp "GCP Region (e.g. us-central1, asia-southeast1):      " REGION
REGION="${REGION:-us-central1}"
ZONE="${REGION}-a"
read -rp "SSL email for Let's Encrypt:                          " SSL_EMAIL
read -rp "VM size — (1) e2-micro FREE / (2) e2-small \$13/mo [1]: " VM_CHOICE
VM_CHOICE="${VM_CHOICE:-1}"

if [ "$VM_CHOICE" = "1" ]; then
  MACHINE_TYPE="e2-micro"
  DISK_SIZE="30"
  info "Using e2-micro (FREE TIER — 1 shared vCPU, 1GB RAM)"
  warn "e2-micro is tight — use e2-small for better performance"
else
  MACHINE_TYPE="e2-small"
  DISK_SIZE="50"
  info "Using e2-small (~\$13/mo — 2 shared vCPU, 2GB RAM)"
fi

VM_NAME="whatsapp-crm"
FIREWALL_TAG="whatsapp-crm-server"
REPO="https://github.com/thedigitalharis-cmd/whatsapp.git"

# ─── GCP Login ───────────────────────────────────────────────────────────────
info "Logging in to GCP..."
gcloud auth login --quiet
gcloud config set project "$PROJECT_ID"
gcloud config set compute/zone "$ZONE"
gcloud config set compute/region "$REGION"

# Enable required APIs
info "Enabling GCP APIs..."
gcloud services enable compute.googleapis.com --quiet
gcloud services enable artifactregistry.googleapis.com --quiet
gcloud services enable dns.googleapis.com --quiet
ok "APIs enabled"

# ─── Static IP ───────────────────────────────────────────────────────────────
info "Reserving static IP address..."
gcloud compute addresses create whatsapp-crm-ip \
  --region="$REGION" \
  --quiet 2>/dev/null || warn "Static IP already exists"

STATIC_IP=$(gcloud compute addresses describe whatsapp-crm-ip \
  --region="$REGION" --format="value(address)")
ok "Static IP: $STATIC_IP"

# ─── Firewall rules ──────────────────────────────────────────────────────────
info "Creating firewall rules..."
gcloud compute firewall-rules create allow-http-https \
  --target-tags="$FIREWALL_TAG" \
  --allow=tcp:80,tcp:443 \
  --description="HTTP and HTTPS for WhatsApp CRM" \
  --quiet 2>/dev/null || warn "Firewall rules already exist"

gcloud compute firewall-rules create allow-ssh \
  --target-tags="$FIREWALL_TAG" \
  --allow=tcp:22 \
  --description="SSH access" \
  --quiet 2>/dev/null || warn "SSH rule already exists"
ok "Firewall configured"

# ─── Create VM ────────────────────────────────────────────────────────────────
info "Creating GCP Compute Engine VM ($MACHINE_TYPE)..."
gcloud compute instances create "$VM_NAME" \
  --machine-type="$MACHINE_TYPE" \
  --image-family=ubuntu-2404-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size="${DISK_SIZE}GB" \
  --boot-disk-type=pd-standard \
  --address="$STATIC_IP" \
  --tags="$FIREWALL_TAG" \
  --metadata="startup-script=#! /bin/bash
apt-get update -qq
apt-get install -y -qq git curl" \
  --quiet 2>/dev/null || warn "VM already exists"

ok "VM created: $VM_NAME"
info "Waiting 30s for VM to boot..."
sleep 30

# ─── Generate secrets ─────────────────────────────────────────────────────────
POSTGRES_PASSWORD=$(openssl rand -hex 24)
REDIS_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH=$(openssl rand -hex 64)
ENC_KEY=$(openssl rand -hex 16 | cut -c1-32)
WEBHOOK_TOKEN="crm_verify_$(openssl rand -hex 8)"

# ─── Write startup script and run on VM ──────────────────────────────────────
info "Running setup on VM via gcloud ssh..."

gcloud compute ssh "$VM_NAME" --zone="$ZONE" --command="
set -e

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
apt-get install -y -qq docker-compose-plugin ufw fail2ban

# Firewall
ufw --force reset
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

# Clone repo
git clone $REPO /opt/whatsapp-crm || (cd /opt/whatsapp-crm && git pull origin main)
cd /opt/whatsapp-crm

# Write .env
cat > /opt/whatsapp-crm/deploy/.env.production << 'ENVEOF'
DOMAIN=betteraisender.com
POSTGRES_DB=whatsapp_crm
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH
ENCRYPTION_KEY=$ENC_KEY
WHATSAPP_WEBHOOK_VERIFY_TOKEN=$WEBHOOK_TOKEN
WHATSAPP_API_VERSION=v19.0
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
SMTP_FROM=noreply@betteraisender.com
DOCKER_IMAGE_BACKEND=thedigitalharis-cmd/whatsapp-crm-backend
DOCKER_IMAGE_FRONTEND=thedigitalharis-cmd/whatsapp-crm-frontend
IMAGE_TAG=latest
ENVEOF

# Use HTTP-only nginx first (for cert issuance)
cp /opt/whatsapp-crm/deploy/nginx.staging.conf /opt/whatsapp-crm/deploy/nginx.active.conf

# Start services
docker compose -f /opt/whatsapp-crm/docker-compose.prod.yml --env-file /opt/whatsapp-crm/deploy/.env.production up -d

echo 'Waiting 40s for services...'
sleep 40

# Run migrations
docker compose -f /opt/whatsapp-crm/docker-compose.prod.yml --env-file /opt/whatsapp-crm/deploy/.env.production exec -T backend npx prisma migrate deploy || true

# Systemd service
cat > /etc/systemd/system/betteraisender.service << 'SVC'
[Unit]
Description=WhatsApp CRM betteraisender.com
After=docker.service network-online.target
Requires=docker.service
[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/whatsapp-crm
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml --env-file deploy/.env.production up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml --env-file deploy/.env.production down
TimeoutStartSec=300
[Install]
WantedBy=multi-user.target
SVC
systemctl daemon-reload && systemctl enable betteraisender.service

# crm-deploy command
cat > /usr/local/bin/crm-deploy << 'DEPLOY'
#!/bin/bash
cd /opt/whatsapp-crm
git pull origin main
docker compose -f docker-compose.prod.yml --env-file deploy/.env.production build --no-cache backend frontend
docker compose -f docker-compose.prod.yml --env-file deploy/.env.production run --rm backend npx prisma migrate deploy
docker compose -f docker-compose.prod.yml --env-file deploy/.env.production up -d --no-deps backend frontend
docker exec crm_nginx nginx -s reload
echo '✅ Deployed!'
DEPLOY
chmod +x /usr/local/bin/crm-deploy
echo 'GCP VM setup complete'
" -- -o StrictHostKeyChecking=no

ok "VM setup complete!"

# ─── Issue SSL ────────────────────────────────────────────────────────────────
info "Issuing SSL certificate..."
info "Make sure betteraisender.com DNS A record → $STATIC_IP is set first!"
read -rp "DNS is pointing to $STATIC_IP? (yes/no): " DNS_READY

if [ "$DNS_READY" = "yes" ]; then
  gcloud compute ssh "$VM_NAME" --zone="$ZONE" --command="
    docker compose -f /opt/whatsapp-crm/docker-compose.prod.yml --env-file /opt/whatsapp-crm/deploy/.env.production \
      run --rm certbot certbot certonly \
      --webroot -w /var/www/certbot \
      -d betteraisender.com -d www.betteraisender.com \
      --email $SSL_EMAIL --agree-tos --non-interactive --no-eff-email && \
    cp /opt/whatsapp-crm/deploy/nginx.betteraisender.conf /opt/whatsapp-crm/deploy/nginx.active.conf && \
    docker exec crm_nginx nginx -s reload && \
    echo 'SSL enabled!'
  " -- -o StrictHostKeyChecking=no
  ok "HTTPS enabled at https://betteraisender.com"
else
  warn "Add DNS first, then run: bash gcp/scripts/ssl.sh"
fi

# ─── Save config ─────────────────────────────────────────────────────────────
cat > "$(dirname "$0")/../gcp-deployment.env" << EOF
GCP_PROJECT=$PROJECT_ID
GCP_ZONE=$ZONE
GCP_REGION=$REGION
VM_NAME=$VM_NAME
STATIC_IP=$STATIC_IP
WEBHOOK_TOKEN=$WEBHOOK_TOKEN
FRONTEND_URL=https://betteraisender.com
BACKEND_URL=https://betteraisender.com
WEBHOOK_URL=https://betteraisender.com/webhook/whatsapp
EOF

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║         ✅  GCP Setup Complete for betteraisender.com!               ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
printf "║  🌐 CRM:     https://betteraisender.com                              ║\n"
printf "║  🔗 Webhook: https://betteraisender.com/webhook/whatsapp             ║\n"
printf "║  🔑 Token:   %-54s ║\n" "$WEBHOOK_TOKEN"
printf "║  🖥️  IP:      %-54s ║\n" "$STATIC_IP"
printf "║  📁 Project: %-54s ║\n" "$PROJECT_ID"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║  DNS — Add in your domain registrar:                                  ║"
printf "║    A  @    →  %-54s ║\n" "$STATIC_IP"
printf "║    A  www  →  %-54s ║\n" "$STATIC_IP"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║  GitHub Secrets for auto-deploy:                                      ║"
printf "║    GCP_PROJECT_ID    = %-46s ║\n" "$PROJECT_ID"
printf "║    GCP_ZONE          = %-46s ║\n" "$ZONE"
printf "║    GCP_VM_NAME       = %-46s ║\n" "$VM_NAME"
echo "║    GCP_SA_KEY        = (see step 6 in GCP_SETUP.md)                  ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Login: admin@demo.com / Admin123!"
