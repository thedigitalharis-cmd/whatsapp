#!/usr/bin/env bash
# =============================================================================
#  WhatsApp CRM — One-command server setup for Ubuntu 22.04 / 24.04 LTS
#  Usage:  sudo bash setup.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[ OK ]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()   { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }

# ─── Check root ───────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Run as root: sudo bash setup.sh"

# ─── Gather config ────────────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║      WhatsApp CRM Server Setup                ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

read -rp "Domain (e.g. crm.yourdomain.com): " DOMAIN
read -rp "Email for SSL certificate:         " SSL_EMAIL
read -rp "GitHub repo (user/repo):           " GITHUB_REPO

[[ -n "$DOMAIN" ]]       || die "Domain is required"
[[ -n "$SSL_EMAIL" ]]    || die "Email is required"
[[ -n "$GITHUB_REPO" ]]  || die "GitHub repo is required"

# ─── System update ────────────────────────────────────────────────────────────
info "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git wget unzip ufw fail2ban jq htop

# ─── Docker ───────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  ok "Docker installed: $(docker --version)"
else
  ok "Docker already installed: $(docker --version)"
fi

# ─── Docker Compose ───────────────────────────────────────────────────────────
if ! docker compose version &>/dev/null; then
  info "Installing Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
fi
ok "Docker Compose: $(docker compose version --short)"

# ─── Firewall ─────────────────────────────────────────────────────────────────
info "Configuring firewall (UFW)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
ufw --force enable
ok "Firewall configured"

# ─── Fail2ban ─────────────────────────────────────────────────────────────────
info "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s

[nginx-http-auth]
enabled = true
EOF
systemctl enable fail2ban
systemctl restart fail2ban
ok "Fail2ban configured"

# ─── App directory ────────────────────────────────────────────────────────────
APP_DIR="/opt/whatsapp-crm"
info "Setting up app directory at $APP_DIR..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# ─── Clone / update repo ──────────────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  info "Pulling latest code..."
  git pull origin main
else
  info "Cloning repository..."
  git clone "https://github.com/${GITHUB_REPO}.git" .
fi

# ─── Generate secrets ─────────────────────────────────────────────────────────
info "Generating secrets..."
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
ENCRYPTION_KEY=$(openssl rand -hex 16)     # 32 hex chars = 32 bytes when decoded, use as 32-char string
POSTGRES_PASSWORD=$(openssl rand -hex 24)
REDIS_PASSWORD=$(openssl rand -hex 24)
WEBHOOK_TOKEN=$(openssl rand -hex 16)

# ─── Write .env ───────────────────────────────────────────────────────────────
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
ENCRYPTION_KEY=${ENCRYPTION_KEY:0:32}

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
DOCKER_IMAGE_BACKEND=${GITHUB_REPO}-backend
DOCKER_IMAGE_FRONTEND=${GITHUB_REPO}-frontend
IMAGE_TAG=latest
EOF
  ok "Generated .env.production (edit $ENV_FILE to add API keys)"
else
  warn ".env.production already exists — skipping generation"
fi

# ─── Copy nginx staging config (HTTP only, for cert issuance) ──────────────
cp "$APP_DIR/deploy/nginx.staging.conf" "$APP_DIR/deploy/nginx.active.conf"
# Patch prod config with actual domain
sed "s/\${DOMAIN}/$DOMAIN/g" "$APP_DIR/deploy/nginx.prod.conf" > "$APP_DIR/deploy/nginx.prod.patched.conf"

# ─── Start services with HTTP-only nginx ──────────────────────────────────────
info "Starting services (HTTP mode for SSL issuance)..."
ln -sf "$APP_DIR/deploy/nginx.staging.conf" "$APP_DIR/deploy/nginx.conf"
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml \
  --env-file "$ENV_FILE" \
  up -d postgres redis backend frontend nginx certbot

info "Waiting 30s for services to start..."
sleep 30

# ─── Issue SSL certificate ────────────────────────────────────────────────────
info "Issuing Let's Encrypt certificate for $DOMAIN..."
docker compose -f docker-compose.prod.yml \
  --env-file "$ENV_FILE" \
  run --rm certbot \
  certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$SSL_EMAIL" \
  --agree-tos \
  --non-interactive \
  --no-eff-email \
  || warn "SSL cert issuance failed — continuing with HTTP only. Check DNS and retry with: sudo bash $APP_DIR/deploy/renew-ssl.sh"

# ─── Switch to HTTPS nginx config ────────────────────────────────────────────
if [ -f "/var/lib/docker/volumes/whatsapp-crm_certbot_certs/_data/live/$DOMAIN/fullchain.pem" ] || \
   docker volume inspect whatsapp-crm_certbot_certs &>/dev/null; then
  info "Switching nginx to HTTPS config..."
  cp "$APP_DIR/deploy/nginx.prod.patched.conf" "$APP_DIR/deploy/nginx.active.conf"
  docker compose -f docker-compose.prod.yml \
    --env-file "$ENV_FILE" \
    restart nginx
  ok "HTTPS enabled at https://$DOMAIN"
fi

# ─── Run database migrations & seed ──────────────────────────────────────────
info "Running database migrations..."
docker compose -f docker-compose.prod.yml \
  --env-file "$ENV_FILE" \
  exec -T backend npx prisma migrate deploy || \
  warn "Migrations may have already run"

# ─── Systemd service for auto-start ──────────────────────────────────────────
info "Creating systemd service..."
cat > /etc/systemd/system/whatsapp-crm.service << EOF
[Unit]
Description=WhatsApp CRM
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml --env-file ${ENV_FILE} up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml --env-file ${ENV_FILE} down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable whatsapp-crm.service
ok "Systemd service enabled (auto-starts on reboot)"

# ─── Cron: SSL renewal ────────────────────────────────────────────────────────
(crontab -l 2>/dev/null; echo "0 3 * * * docker compose -f ${APP_DIR}/docker-compose.prod.yml --env-file ${ENV_FILE} exec -T nginx nginx -s reload >> /var/log/crm-nginx-reload.log 2>&1") | crontab -
ok "Nginx reload cron scheduled (daily 3am for cert renewal)"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              ✅  Setup Complete!                             ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  App URL:       https://$DOMAIN"
echo "║  Webhook URL:   https://$DOMAIN/webhook/whatsapp"
echo "║  Verify Token:  $WEBHOOK_TOKEN"
echo "║  Env file:      $ENV_FILE"
echo "║  App dir:       $APP_DIR"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Next steps:                                                 ║"
echo "║  1. Edit $ENV_FILE — add OPENAI_API_KEY, SMTP, etc."
echo "║  2. Run: docker compose -f docker-compose.prod.yml restart backend"
echo "║  3. Open https://$DOMAIN and register your account"
echo "║  4. Go to Settings → WhatsApp and add your Meta credentials  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
