# Deploy WhatsApp CRM to GCP — betteraisender.com

Cheapest GCP option: **e2-small Compute Engine VM (~$13/mo)** with Docker Compose.

---

## Cost on GCP

| VM Type | vCPU | RAM | Cost | Recommendation |
|---------|------|-----|------|----------------|
| e2-micro | 0.25 | 1GB | **FREE** (1/mo limit) | Testing only |
| **e2-small** | 0.5 | 2GB | **~$13/mo** ⭐ | Recommended |
| e2-medium | 1 | 4GB | ~$26/mo | High traffic |

> **Note:** GCP's e2-micro is on the Always Free tier (1 per month in us-central1). But 1GB RAM is tight — use e2-small for production.

---

## Prerequisites (install on your LOCAL machine)

### 1. Install Google Cloud CLI
```bash
# Windows: https://cloud.google.com/sdk/docs/install-sdk#windows
# Mac:
brew install --cask google-cloud-sdk
# Linux:
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

Verify:
```bash
gcloud --version
```

### 2. Install Docker Desktop
Download: https://www.docker.com/products/docker-desktop

---

## Step-by-step deployment

### Step 1 — Create a GCP Project

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**
2. Click the project dropdown → **New Project**
3. Name it `whatsapp-crm` → Create
4. Note your **Project ID** (e.g. `whatsapp-crm-461234`)
5. Make sure **billing is enabled** on the project

### Step 2 — Run the setup script (on your local machine)

```bash
git clone https://github.com/thedigitalharis-cmd/whatsapp.git
cd whatsapp
bash gcp/scripts/setup-gcp.sh
```

It will ask:
- **GCP Project ID** — from step 1
- **Region** — `us-central1` (cheapest) or `asia-southeast1` (Singapore, closer to UAE)
- **SSL email** — your email for Let's Encrypt
- **VM size** — 1 for e2-micro (free) or 2 for e2-small ($13/mo)

Takes ~10 minutes. Fully automated.

### Step 3 — Point your domain DNS

In your domain registrar (GoDaddy, Cloudflare, Namecheap):

| Type | Name | Value |
|------|------|-------|
| **A** | `@` | `STATIC_IP` (shown in script output) |
| **A** | `www` | `STATIC_IP` |

Wait 2–5 minutes. Verify: `ping betteraisender.com` returns your IP.

### Step 4 — Enable SSL (if not done automatically)

```bash
bash gcp/scripts/ssl.sh your@email.com
```

### Step 5 — Open the CRM

**https://betteraisender.com**

Login: `admin@demo.com` / `Admin123!`

### Step 6 — Set up auto-deploy (GitHub Actions)

Every `git push` to `main` automatically deploys to the server.

#### Create a Service Account for CI/CD:

```bash
# In terminal
gcloud iam service-accounts create github-deploy \
  --display-name="GitHub Deploy" \
  --project=YOUR_PROJECT_ID

# Give it Compute SSH permission
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-deploy@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/compute.osAdminLogin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-deploy@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/compute.instanceAdmin"

# Download the key
gcloud iam service-accounts keys create gcp-sa-key.json \
  --iam-account="github-deploy@YOUR_PROJECT_ID.iam.gserviceaccount.com"

# Print the key (copy the entire JSON output)
cat gcp-sa-key.json
```

#### Add GitHub Secrets (Settings → Secrets → Actions):

| Secret | Value |
|--------|-------|
| `GCP_SA_KEY` | The full JSON from `gcp-sa-key.json` |
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_ZONE` | e.g. `us-central1-a` |
| `GCP_VM_NAME` | `whatsapp-crm` |

#### From now on — push to deploy:
```bash
git push origin main   # → automatically deploys to betteraisender.com
```

---

## Add API Keys

SSH into the VM and edit the env file:

```bash
gcloud compute ssh whatsapp-crm --zone=us-central1-a
nano /opt/whatsapp-crm/deploy/.env.production
```

Add:
```
OPENAI_API_KEY=sk-proj-...
STRIPE_SECRET_KEY=sk_live_...
SMTP_HOST=smtp.gmail.com
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
```

Restart backend:
```bash
docker compose -f /opt/whatsapp-crm/docker-compose.prod.yml \
  --env-file /opt/whatsapp-crm/deploy/.env.production \
  restart backend
```

---

## Update Meta Webhook (permanent — never changes again)

In **Meta Developer Console → WhatsApp → Configuration → Webhook**:

| Field | Value |
|-------|-------|
| **Callback URL** | `https://betteraisender.com/webhook/whatsapp` |
| **Verify Token** | Printed at end of setup script |

---

## Useful commands on the VM

```bash
# SSH into the VM
gcloud compute ssh whatsapp-crm --zone=us-central1-a

# View live backend logs
docker compose -f /opt/whatsapp-crm/docker-compose.prod.yml logs -f backend

# Deploy latest code manually
crm-deploy

# Check all services
docker compose -f /opt/whatsapp-crm/docker-compose.prod.yml ps

# Restart a service
docker compose -f /opt/whatsapp-crm/docker-compose.prod.yml restart backend

# Renew SSL
bash /opt/whatsapp-crm/deploy/renew-ssl.sh
```

---

## Monthly Cost Summary

| Resource | Cost |
|----------|------|
| e2-small VM (us-central1) | ~$13/mo |
| 50GB Standard Disk | ~$2/mo |
| Static IP (in use) | Free |
| Egress (first 1GB) | Free |
| **Total** | **~$15/mo** |

> To reduce to ~$8/mo: Use `e2-micro` (free tier) + `pd-balanced` disk 30GB

---

## vs Azure

| | GCP e2-small | Azure CX22 (Hetzner) |
|--|--|--|
| Cost | ~$15/mo | ~$4/mo |
| Setup | Easy | Easiest |
| Brand | Google | European VPS |
| Free trial | $300 credit | None |

**GCP gives $300 free credit** for new accounts — so first ~20 months could be free!
