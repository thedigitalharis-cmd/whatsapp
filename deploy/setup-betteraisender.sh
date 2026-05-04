#!/usr/bin/env bash
# =============================================================================
#  WhatsApp CRM — One-command setup for betteraisender.com
#  Cheapest option: Hetzner CX22 ($6/mo) or DigitalOcean $6 Droplet
#  Usage: curl -fsSL https://raw.githubusercontent.com/thedigitalharis-cmd/whatsapp/main/deploy/setup-betteraisender.sh | sudo bash
# =============================================================================
set -euo pipefail

DOMAIN="betteraisender.com"
WWW_DOMAIN="www.betteraisender.com"
APP_DIR="/opt/whatsapp-crm"
REPO="https://github.com/thedigitalharis-cmd/whatsapp.git"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[ OK ]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()  { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash setup-betteraisender.sh"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   WhatsApp CRM Setup for betteraisender.com          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

read -rp "SSL email address (for Let's Encrypt): " SSL_EMAIL
[[ -n "$SSL_EMAIL" ]] || die "Email required"

# ─── System packages ─────────────────────────────────────────────────────────
info "Updating system..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl git wget ufw fail2ban

# ─── Docker ──────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
ok "Docker: $(docker --version)"

# ─── Docker Compose plugin ───────────────────────────────────────────────────
if ! docker compose version &>/dev/null; then
  apt-get install -y -qq docker-compose-plugin
fi
ok "Docker Compose: $(docker compose version --short)"

# ─── Firewall ────────────────────────────────────────────────────────────────
info "Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
ufw --force enable
ok "Firewall active"

# ─── Clone repo ──────────────────────────────────────────────────────────────
info "Cloning repository..."
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull origin main
else
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

# ─── Generate secrets ────────────────────────────────────────────────────────
info "Generating secrets..."
POSTGRES_PASSWORD=$(openssl rand -hex 24)
REDIS_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
ENCRYPTION_KEY=$(openssl rand -hex 16 | cut -c1-32)
WEBHOOK_TOKEN="crm_verify_$(openssl rand -hex 8)"

# ─── Write .env ──────────────────────────────────────────────────────────────
ENV_FILE="$APP_DIR/deploy/.env.production"

if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" << EOF
DOMAIN=${DOMAIN}
POSTGRES_DB=whatsapp_crm
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
WHATSAPP_WEBHOOK_VERIFY_TOKEN=${WEBHOOK_TOKEN}
WHATSAPP_APP_SECRET=
WHATSAPP_API_VERSION=v19.0
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@${DOMAIN}
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DOCKER_REGISTRY=ghcr.io
DOCKER_IMAGE_BACKEND=thedigitalharis-cmd/whatsapp-crm-backend
DOCKER_IMAGE_FRONTEND=thedigitalharis-cmd/whatsapp-crm-frontend
IMAGE_TAG=latest
EOF
  ok "Generated .env.production"
else
  warn ".env.production already exists — keeping existing secrets"
fi

# ─── Use HTTP-only nginx first (for cert issuance) ───────────────────────────
cp "$APP_DIR/deploy/nginx.staging.conf" "$APP_DIR/deploy/nginx.active.conf"

# ─── Start services (HTTP only) ──────────────────────────────────────────────
info "Starting services..."
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d postgres redis backend frontend nginx certbot

info "Waiting 40s for backend to be ready..."
sleep 40

# ─── Issue SSL certificate ───────────────────────────────────────────────────
info "Requesting SSL certificate for $DOMAIN and $WWW_DOMAIN..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" \
  run --rm certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" -d "$WWW_DOMAIN" \
  --email "$SSL_EMAIL" \
  --agree-tos --non-interactive --no-eff-email \
  && SSL_OK=true || SSL_OK=false

if [ "$SSL_OK" = true ]; then
  info "SSL issued! Switching to HTTPS nginx config..."
  cp "$APP_DIR/deploy/nginx.betteraisender.conf" "$APP_DIR/deploy/nginx.active.conf"
  docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" restart nginx
  ok "HTTPS enabled at https://$DOMAIN"
else
  warn "SSL failed — check DNS is pointing to this server. Run: bash $APP_DIR/deploy/renew-ssl.sh"
fi

# ─── Run DB migrations ───────────────────────────────────────────────────────
info "Running database migrations..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" \
  exec -T backend npx prisma migrate deploy || warn "Migrations may have already run"

# ─── Systemd service ─────────────────────────────────────────────────────────
info "Creating systemd auto-start service..."
cat > /etc/systemd/system/betteraisender.service << EOF
[Unit]
Description=WhatsApp CRM - betteraisender.com
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml --env-file ${ENV_FILE} up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml --env-file ${ENV_FILE} down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable betteraisender.service

# ─── Deploy script ───────────────────────────────────────────────────────────
cat > /usr/local/bin/crm-deploy << 'DEPLOY'
#!/bin/bash
# Quick deploy — run this after any code change
cd /opt/whatsapp-crm
git pull origin main
bash deploy/deploy.sh
echo "✅ Deployed!"
DEPLOY
chmod +x /usr/local/bin/crm-deploy

# ─── Done ────────────────────────────────────────────────────────────────────
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║           ✅  betteraisender.com Setup Complete!                     ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
printf "║  🌐 CRM:      https://%-48s ║\n" "${DOMAIN}"
printf "║  🔗 Webhook:  https://%s/webhook/whatsapp        ║\n" "${DOMAIN}"
printf "║  🔑 Token:    %-54s ║\n" "${WEBHOOK_TOKEN}"
printf "║  🖥️  Server:   %-54s ║\n" "${SERVER_IP}"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║  To deploy updates:  crm-deploy                                      ║"
echo "║  To view logs:       docker compose -f /opt/whatsapp-crm/            ║"
echo "║                      docker-compose.prod.yml logs -f backend          ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║  DNS — Add these records in your domain registrar:                   ║"
printf "║    A    @   →  %-54s ║\n" "${SERVER_IP}"
printf "║    A    www →  %-54s ║\n" "${SERVER_IP}"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║  Meta Webhook — Update in developers.facebook.com:                   ║"
printf "║    URL:   https://%s/webhook/whatsapp  ║\n" "${DOMAIN}"
printf "║    Token: %-59s ║\n" "${WEBHOOK_TOKEN}"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Login: admin@demo.com / Admin123!"
echo "Env file: $ENV_FILE"
