# Hosting Guide — WhatsApp CRM on Your Own Server

Complete self-hosting guide using Docker on a Ubuntu VPS with SSL, CI/CD, and automatic backups.

---

## Minimum Server Requirements

| | Minimum | Recommended |
|-|---------|-------------|
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 2 GB | 4 GB |
| **Disk** | 20 GB SSD | 50 GB SSD |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| **Ports** | 80, 443, 22 | 80, 443, 22 |

**Recommended providers:** DigitalOcean, Hetzner, AWS EC2 (t3.medium), Vultr, Linode, OVH

---

## Option A — One-Command Automatic Setup (Recommended)

### 1. Get a server with a public IP

### 2. Point your domain at the server
Create an **A record** in your DNS:
```
crm.yourdomain.com  →  YOUR_SERVER_IP
```
Wait a few minutes for DNS to propagate (`ping crm.yourdomain.com` should return your server IP).

### 3. SSH into your server
```bash
ssh root@YOUR_SERVER_IP
```

### 4. Run the setup script
```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_GITHUB_USER/whatsapp/main/deploy/setup.sh | sudo bash
```
Or clone first and run locally:
```bash
git clone https://github.com/YOUR_GITHUB_USER/whatsapp.git /opt/whatsapp-crm
cd /opt/whatsapp-crm
sudo bash deploy/setup.sh
```

The script will ask for:
- Your domain (e.g. `crm.yourdomain.com`)
- Your email (for SSL cert)
- Your GitHub repo (e.g. `youruser/whatsapp`)

It will automatically:
- Install Docker & Docker Compose
- Configure UFW firewall (ports 22, 80, 443)
- Configure fail2ban
- Generate secure random secrets
- Start all services
- Issue a free Let's Encrypt SSL certificate
- Set up systemd service (auto-start on reboot)
- Schedule daily database backups

---

## Option B — Manual Setup (Step by Step)

### Step 1 — Install Docker

```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Install Docker Compose plugin
apt-get install -y docker-compose-plugin
docker compose version
```

### Step 2 — Clone the repository

```bash
git clone https://github.com/YOUR_GITHUB_USER/whatsapp.git /opt/whatsapp-crm
cd /opt/whatsapp-crm
```

### Step 3 — Configure environment

```bash
cp deploy/.env.production .env.prod
nano .env.prod   # Fill in all values
```

**Critical values to fill:**

```bash
DOMAIN=crm.yourdomain.com

# Generate secure passwords:
POSTGRES_PASSWORD=$(openssl rand -hex 24)
REDIS_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
ENCRYPTION_KEY=$(openssl rand -hex 16 | cut -c1-32)

# Your Meta App secret (optional but recommended)
WHATSAPP_APP_SECRET=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=my_custom_verify_token_123
```

### Step 4 — Start services (HTTP first for cert issuance)

```bash
# Copy staging nginx config (HTTP only)
cp deploy/nginx.staging.conf deploy/nginx.active.conf

# Start all services
docker compose -f docker-compose.server.yml --env-file deploy/.env.production up -d

# Check everything is running
docker compose -f docker-compose.server.yml ps
```

### Step 5 — Issue SSL certificate

```bash
# Make sure your domain DNS is pointing to this server first!
# Test: curl http://crm.yourdomain.com/health

docker compose -f docker-compose.server.yml --env-file deploy/.env.production \
  run --rm certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d betteraisender.com -d www.betteraisender.com \
  --email your@email.com \
  --agree-tos --non-interactive --no-eff-email
```

### Step 6 — Switch to HTTPS nginx config

```bash
# Switch to the betteraisender.com HTTPS nginx config
cp deploy/nginx.betteraisender.conf deploy/nginx.active.conf

# Restart nginx with HTTPS config
docker compose -f docker-compose.server.yml --env-file deploy/.env.production restart nginx
```

### Step 7 — Run database migrations

```bash
docker compose -f docker-compose.server.yml --env-file deploy/.env.production \
  exec backend npx prisma migrate deploy
```

### Step 8 — Verify everything works

```bash
# Health check
curl -s https://betteraisender.com/health

# Should return: {"status":"ok","timestamp":"..."}
```

### Step 9 — Open in browser

Go to **https://betteraisender.com** and register your account.

---

## Firewall Configuration

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirect to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw enable
ufw status
```

---

## WhatsApp Webhook Configuration

After the server is running, in your **Meta Developer App → WhatsApp → Configuration → Webhook**:

| Field | Value |
|-------|-------|
| **Callback URL** | `https://betteraisender.com/webhook/whatsapp` |
| **Verify token** | The value of `WHATSAPP_WEBHOOK_VERIFY_TOKEN` from your `deploy/.env.production` |

Subscribe to webhook fields: `messages`, `message_deliveries`, `message_reads`, `messaging_postbacks`

---

## GitHub Actions CI/CD (Auto-Deploy on Push)

### 1. Add GitHub Secrets

In your GitHub repo → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|--------|-------|
| `SERVER_HOST` | Your server's IP or domain |
| `SERVER_USER` | `root` or your deploy user |
| `SERVER_SSH_KEY` | Private SSH key (the one that can SSH into your server) |
| `SERVER_PORT` | `22` (optional) |

### 2. Enable GitHub Packages (GHCR)

The workflow uses GitHub Container Registry (`ghcr.io`) to store Docker images. No extra setup needed — it uses `GITHUB_TOKEN` automatically.

### 3. How it works

Every push to `main`:
1. TypeScript build check runs
2. Docker images are built and pushed to `ghcr.io`
3. SSH into your server and run `deploy/deploy.sh`

Tag a release with `v1.2.3` for a versioned deployment.

---

## Zero-Downtime Redeployment

```bash
# On your server
cd /opt/whatsapp-crm
sudo bash deploy/deploy.sh

# Or trigger it via the convenience alias set up by setup-betteraisender.sh:
crm-deploy
```

---

## Useful Commands

```bash
# View all service status
docker compose -f docker-compose.server.yml ps

# View backend logs (live)
docker compose -f docker-compose.server.yml logs -f backend

# View nginx access logs
docker compose -f docker-compose.server.yml logs -f nginx

# Restart a service
docker compose -f docker-compose.server.yml --env-file deploy/.env.production restart backend

# Stop everything
docker compose -f docker-compose.server.yml down

# Start everything
docker compose -f docker-compose.server.yml --env-file deploy/.env.production up -d

# Connect to database
docker exec -it crm_postgres psql -U crm_user -d whatsapp_crm

# Connect to Redis
docker exec -it crm_redis redis-cli -a YOUR_REDIS_PASSWORD
```

---

## Database Backups

Backups run automatically every 24 hours inside the `db_backup` container and are saved to a Docker volume.

```bash
# List backups
docker exec crm_db_backup ls -lh /backups/

# Manual backup now
docker exec crm_db_backup sh /backup.sh

# Download a backup to your local machine
docker cp crm_db_backup:/backups/crm_20260501_030000.sql.gz ./

# Restore a backup
gunzip -c crm_20260501_030000.sql.gz | docker exec -i crm_postgres \
  psql -U crm_user -d whatsapp_crm
```

---

## SSL Certificate Renewal

Certificates auto-renew via the certbot container. Force-renew manually:

```bash
sudo bash /opt/whatsapp-crm/deploy/renew-ssl.sh
```

---

## Scaling

For high-traffic deployments, use **multiple backend replicas**:

```bash
docker compose -f docker-compose.server.yml --env-file deploy/.env.production \
  up -d --scale backend=3
```

Nginx will round-robin load balance across all backend instances automatically.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DOMAIN` | ✅ | Your domain without https:// |
| `POSTGRES_PASSWORD` | ✅ | Strong DB password |
| `REDIS_PASSWORD` | ✅ | Strong Redis password |
| `JWT_SECRET` | ✅ | 64-char random string |
| `JWT_REFRESH_SECRET` | ✅ | 64-char random string |
| `ENCRYPTION_KEY` | ✅ | Exactly 32 characters |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | ✅ | Token you set in Meta App |
| `WHATSAPP_APP_SECRET` | Recommended | From Meta App → Settings → App Secret |
| `OPENAI_API_KEY` | Optional | For AI features |
| `STRIPE_SECRET_KEY` | Optional | For billing |
| `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` | Optional | For email notifications |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Optional | For Google OAuth login |

---

## Troubleshooting

**Backend won't start**
```bash
docker compose -f docker-compose.server.yml logs backend
# Usually a missing required env var or DB not ready
```

**SSL cert fails**
```bash
# Check DNS is pointing to your server
nslookup betteraisender.com
# Check port 80 is open
curl http://betteraisender.com/.well-known/acme-challenge/test
```

**WhatsApp webhook fails (403)**
```bash
# Verify your token matches what's in Meta App settings
curl "https://betteraisender.com/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"
# Should return: test
```

**Database connection error**
```bash
docker compose -f docker-compose.server.yml logs postgres
docker exec crm_postgres pg_isready -U crm_user
```
