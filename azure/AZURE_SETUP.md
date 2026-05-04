# Deploy WhatsApp CRM to Azure

Complete guide to deploy on **Azure Container Apps** with PostgreSQL, Redis, and automatic CI/CD.

---

## Architecture

```
Internet → Azure Container Apps (Frontend + Backend)
                ↓                    ↓
         Azure CDN            PostgreSQL Flexible Server
                              Azure Cache for Redis
                              Azure Container Registry (ACR)
                              Azure Storage (uploads + backups)
```

**Cost estimate (UAE North):** ~$40–80/month
- Container Apps (2): ~$10–15/mo (pay-per-use)
- PostgreSQL B1ms: ~$15/mo
- Redis Basic C0: ~$17/mo
- ACR Basic: ~$5/mo
- Storage: ~$1/mo

---

## Option A — One-Command Setup (Recommended)

### Prerequisites
- [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli) installed
- [Docker](https://docs.docker.com/get-docker/) installed
- An Azure account with active subscription

### Run setup script:
```bash
git clone https://github.com/thedigitalharis-cmd/whatsapp.git
cd whatsapp
bash azure/scripts/setup-azure-cli.sh
```

The script will ask for:
- Azure region (`uaenorth` for Dubai)
- Your domain (`crm.huco.ae`)
- Resource prefix

Then it automatically:
1. Creates Resource Group, ACR, PostgreSQL, Redis, Container App Environment
2. Builds and pushes Docker images
3. Deploys backend + frontend Container Apps
4. Runs database migrations + seeds demo data
5. Prints all URLs and webhook tokens

---

## Option B — Terraform (Infrastructure as Code)

### Prerequisites
- [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.5
- Azure CLI authenticated

```bash
cd azure/terraform

# Copy and fill in variables
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars

# Deploy
terraform init
terraform plan
terraform apply
```

---

## Option C — GitHub Actions CI/CD (Auto-Deploy on Push)

After running Option A or B, set up automatic deployments:

### 1. Create Azure Service Principal

```bash
az ad sp create-for-rbac \
  --name "whatsapp-crm-cicd" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv) \
  --json-auth
```

Copy the full JSON output.

### 2. Add GitHub Secrets

Go to your repo → **Settings → Secrets and variables → Actions** → add:

| Secret | Value |
|--------|-------|
| `AZURE_CREDENTIALS` | The full JSON from step 1 |
| `ACR_NAME` | Your ACR name (from deployment output) |
| `ACR_LOGIN_SERVER` | e.g. `whatsappcrmacrXXXXXX.azurecr.io` |
| `AZURE_RESOURCE_GROUP` | e.g. `whatsapp-crm-rg` |

### 3. Add GitHub Variables

Go to **Settings → Variables → Actions** → add:

| Variable | Value |
|----------|-------|
| `AZURE_RESOURCE_GROUP` | e.g. `whatsapp-crm-rg` |

### 4. Push to deploy

```bash
git push origin main        # deploys latest
git tag v1.0.0 && git push --tags  # deploys tagged version
```

---

## Custom Domain Setup

After deployment, point your domain to Azure:

### Frontend domain
```
crm.huco.ae  →  CNAME  →  whatsapp-crm-frontend.XXX.azurecontainerapps.io
```

Then add custom domain in Azure Portal:
1. Go to Container App (frontend) → Custom domains → Add
2. Enter `crm.huco.ae`
3. Azure will provide a TXT record to verify ownership
4. SSL certificate is provisioned automatically (free)

---

## Update Meta Webhook After Deployment

Your webhook URL is now **permanent** (never changes):

```
https://whatsapp-crm-backend.XXX.azurecontainerapps.io/webhook/whatsapp
```

In Meta Developer Console → WhatsApp → Configuration:
- **Callback URL**: `https://whatsapp-crm-backend.XXX.azurecontainerapps.io/webhook/whatsapp`
- **Verify Token**: shown at end of setup script

---

## Useful Azure CLI Commands

```bash
# View logs
az containerapp logs show --name whatsapp-crm-backend --resource-group whatsapp-crm-rg --follow

# Restart backend
az containerapp revision restart --name whatsapp-crm-backend --resource-group whatsapp-crm-rg --revision $(az containerapp revision list --name whatsapp-crm-backend --resource-group whatsapp-crm-rg --query "[0].name" -o tsv)

# Scale up
az containerapp update --name whatsapp-crm-backend --resource-group whatsapp-crm-rg --min-replicas 2 --max-replicas 5

# Connect to database
az postgres flexible-server connect --name <pg-name> --admin-user crm_admin --admin-password <pass> --database-name whatsapp_crm

# Run migration manually
az containerapp exec --name whatsapp-crm-backend --resource-group whatsapp-crm-rg --command "npx prisma migrate deploy"

# Update environment variable
az containerapp update --name whatsapp-crm-backend --resource-group whatsapp-crm-rg \
  --set-env-vars OPENAI_API_KEY=sk-proj-...

# Check deployment status
az containerapp show --name whatsapp-crm-backend --resource-group whatsapp-crm-rg --query "properties.latestRevisionName"
```

---

## Environment Variables to Set After Deployment

```bash
# Add OpenAI key
az containerapp update --name whatsapp-crm-backend --resource-group whatsapp-crm-rg \
  --set-env-vars OPENAI_API_KEY="sk-proj-..."

# Add Stripe
az containerapp update --name whatsapp-crm-backend --resource-group whatsapp-crm-rg \
  --set-env-vars STRIPE_SECRET_KEY="sk_live_..."

# Add SMTP
az containerapp update --name whatsapp-crm-backend --resource-group whatsapp-crm-rg \
  --set-env-vars SMTP_HOST="smtp.gmail.com" SMTP_USER="you@gmail.com" SMTP_PASS="app-password"
```

---

## Estimated Monthly Cost by Region

| Region | PostgreSQL | Redis | Container Apps | Total |
|--------|-----------|-------|----------------|-------|
| UAE North (Dubai) | ~$16 | ~$18 | ~$12 | **~$46/mo** |
| East US | ~$14 | ~$17 | ~$10 | **~$41/mo** |
| West Europe | ~$15 | ~$18 | ~$11 | **~$44/mo** |
| Southeast Asia | ~$14 | ~$17 | ~$10 | **~$41/mo** |

*Scale down to zero replicas when not in use to save on Container Apps cost.*
