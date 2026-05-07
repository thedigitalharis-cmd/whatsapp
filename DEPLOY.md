# Deploy WhatsApp CRM to betteraisender.com

**Cheapest option: $6/month Hetzner VPS** — everything automated, every git push goes live.

---

## Cost Comparison

| Provider | Plan | RAM | Cost | Speed |
|----------|------|-----|------|-------|
| **Hetzner CX22** ⭐ Best | 2 vCPU / 4GB | 4GB | **$4/mo** | Fastest |
| DigitalOcean | Basic Droplet | 1GB | $6/mo | Good |
| Vultr | Cloud Compute | 1GB | $6/mo | Good |
| Azure | Container Apps | — | $40+/mo | Enterprise |
| GCP | Cloud Run | — | $30+/mo | Enterprise |

**Recommendation: Hetzner CX22 (~$4–6/month)** — best value, fast NVMe, located in EU/US/Singapore.

---

## Step 1 — Get a Hetzner Server ($4/month)

1. Sign up at **[hetzner.com/cloud](https://www.hetzner.com/cloud)**

2. Click **"New Server"** and choose:
   - **Location**: Helsinki or Singapore (nearest to UAE)
   - **OS**: Ubuntu 24.04
   - **Type**: **CX22** (2 vCPU, 4GB RAM, 40GB SSD) → **$3.92/month**
   - **SSH Key**: Add your SSH public key (or use password)

3. Click **"Create & Buy Now"**

4. You get a server IP like `65.21.xxx.xxx` in 30 seconds.

---

## Step 2 — Point betteraisender.com DNS to the server

In your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.), add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| **A** | `@` | `YOUR_SERVER_IP` | 300 |
| **A** | `www` | `YOUR_SERVER_IP` | 300 |

Wait 2–5 minutes for DNS to propagate.

Verify: `ping betteraisender.com` should return your server IP.

---

## Step 3 — Run the one-command setup

SSH into your server:
```bash
ssh root@YOUR_SERVER_IP
```

Then run:
```bash
curl -fsSL https://raw.githubusercontent.com/thedigitalharis-cmd/whatsapp/main/deploy/setup-betteraisender.sh | sudo bash
```

**It will ask for:** Your email address (for SSL certificate)

**Then automatically:**
- Installs Docker, sets up firewall
- Clones the repo, generates all secrets
- Starts PostgreSQL, Redis, Backend, Frontend, Nginx
- Issues a **free Let's Encrypt SSL certificate** for betteraisender.com
- Runs database migrations
- Sets up auto-start on reboot

**Takes ~8 minutes total.**

---

## Step 4 — After setup completes

You will see:
```
✅ CRM:     https://betteraisender.com
✅ Webhook: https://betteraisender.com/webhook/whatsapp
🔑 Token:   crm_verify_XXXXXXXXXXXXXXXX
```

Open **https://betteraisender.com** → Login: `admin@demo.com` / `Admin123!`

---

## Step 5 — Update Meta Webhook (one-time, permanent)

Go to: https://developers.facebook.com/apps/1313324394271933/whatsapp-business/wa-dev-console/

Configuration → Edit Webhook:
- **Callback URL**: `https://betteraisender.com/webhook/whatsapp`
- **Verify Token**: shown in setup output

This URL **never changes** — no more updating every session!

---

## Step 6 — Set up Auto-Deploy (push to deploy)

Every time you push code to GitHub, it automatically deploys to betteraisender.com.

### Add 3 secrets in GitHub → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `SERVER_HOST` | Your server IP (e.g. `65.21.xxx.xxx`) |
| `SERVER_USER` | `root` |
| `SERVER_SSH_KEY` | Your private SSH key (run `cat ~/.ssh/id_rsa`) |

### How it works:
```
You push code → GitHub Actions runs → SSH into server → git pull → rebuild → live in ~3 min
```

---

## Add API Keys After Setup

SSH into server and edit the env file:
```bash
nano /opt/whatsapp-crm/deploy/.env.production
```

Add your keys:
```
OPENAI_API_KEY=sk-proj-...        # For AI features
STRIPE_SECRET_KEY=sk_live_...     # For payment links
SMTP_HOST=smtp.gmail.com          # For email notifications
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
```

Then restart:
```bash
cd /opt/whatsapp-crm
docker compose -f docker-compose.server.yml --env-file deploy/.env.production restart backend
```

---

## Useful Commands on the Server

```bash
# View live logs
docker compose -f /opt/whatsapp-crm/docker-compose.server.yml logs -f backend

# Restart everything
docker compose -f /opt/whatsapp-crm/docker-compose.server.yml restart

# Deploy latest code manually
crm-deploy

# Check status
docker compose -f /opt/whatsapp-crm/docker-compose.server.yml ps

# Renew SSL (auto, but manual if needed)
bash /opt/whatsapp-crm/deploy/renew-ssl.sh
```

---

## Monthly Cost Summary

| Item | Cost |
|------|------|
| Hetzner CX22 server | ~$4/mo |
| Domain (betteraisender.com) | ~$1/mo |
| SSL certificate | **FREE** (Let's Encrypt) |
| **Total** | **~$5/month** |

Everything else (PostgreSQL, Redis, Nginx) runs **on the same server** — no extra cost.
