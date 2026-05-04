#!/usr/bin/env bash
# =============================================================================
#  WhatsApp CRM — Azure setup using Azure CLI only (no Terraform needed)
#  Usage: bash azure/scripts/setup-azure-cli.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[ OK ]${NC} $*"; }
die()  { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }

command -v az &>/dev/null || die "Install Azure CLI: https://docs.microsoft.com/cli/azure/install-azure-cli"

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║       WhatsApp CRM — Azure Setup                      ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# ─── Inputs ──────────────────────────────────────────────────────────────────
read -rp "Azure region (e.g. uaenorth for Dubai, eastus): " LOCATION
read -rp "Your domain (e.g. crm.huco.ae):                " DOMAIN
read -rp "Resource prefix (default: whatsapp-crm):        " PREFIX
PREFIX="${PREFIX:-whatsapp-crm}"

SUFFIX=$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 6 | head -n 1)
RG="${PREFIX}-rg"
ACR_NAME="${PREFIX//[-_]/}acr${SUFFIX}"
PG_NAME="${PREFIX}-pg-${SUFFIX}"
REDIS_NAME="${PREFIX}-redis-${SUFFIX}"
ENV_NAME="${PREFIX}-env"
LOG_NAME="${PREFIX}-logs"
ST_NAME="${PREFIX//[-_]/}st${SUFFIX}"

# Auto-generate secrets
DB_PASS=$(openssl rand -hex 16)"A1!"
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH=$(openssl rand -hex 64)
ENC_KEY=$(openssl rand -hex 16 | cut -c1-32)
WEBHOOK_TOKEN="crm_verify_$(openssl rand -hex 8)"

info "Azure Login..."
az login --only-show-errors

SUBSCRIPTION=$(az account show --query name -o tsv)
ok "Subscription: $SUBSCRIPTION"

# ─── Resource Group ──────────────────────────────────────────────────────────
info "Creating resource group: $RG in $LOCATION..."
az group create --name "$RG" --location "$LOCATION" --output none
ok "Resource group created"

# ─── Container Registry ──────────────────────────────────────────────────────
info "Creating Azure Container Registry: $ACR_NAME..."
az acr create --resource-group "$RG" --name "$ACR_NAME" --sku Basic --admin-enabled true --output none
ACR_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
ACR_USER=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASS=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)
ok "ACR: $ACR_SERVER"

# ─── PostgreSQL ──────────────────────────────────────────────────────────────
info "Creating PostgreSQL Flexible Server: $PG_NAME (takes ~3 min)..."
az postgres flexible-server create \
  --resource-group "$RG" \
  --name "$PG_NAME" \
  --location "$LOCATION" \
  --admin-user crm_admin \
  --admin-password "$DB_PASS" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 16 \
  --storage-size 32 \
  --public-access 0.0.0.0 \
  --output none

PG_HOST=$(az postgres flexible-server show --resource-group "$RG" --name "$PG_NAME" --query fullyQualifiedDomainName -o tsv)

az postgres flexible-server db create \
  --resource-group "$RG" \
  --server-name "$PG_NAME" \
  --database-name whatsapp_crm \
  --output none

DB_URL="postgresql://crm_admin:${DB_PASS}@${PG_HOST}:5432/whatsapp_crm?sslmode=require"
ok "PostgreSQL: $PG_HOST"

# ─── Redis ────────────────────────────────────────────────────────────────────
info "Creating Redis Cache: $REDIS_NAME..."
az redis create \
  --resource-group "$RG" \
  --name "$REDIS_NAME" \
  --location "$LOCATION" \
  --sku Basic \
  --vm-size C0 \
  --output none

REDIS_HOST=$(az redis show --resource-group "$RG" --name "$REDIS_NAME" --query hostName -o tsv)
REDIS_PORT=$(az redis show --resource-group "$RG" --name "$REDIS_NAME" --query sslPort -o tsv)
REDIS_KEY=$(az redis list-keys --resource-group "$RG" --name "$REDIS_NAME" --query primaryKey -o tsv)
REDIS_URL="rediss://:${REDIS_KEY}@${REDIS_HOST}:${REDIS_PORT}"
ok "Redis: $REDIS_HOST:$REDIS_PORT"

# ─── Log Analytics ────────────────────────────────────────────────────────────
info "Creating Log Analytics workspace..."
az monitor log-analytics workspace create \
  --resource-group "$RG" \
  --workspace-name "$LOG_NAME" \
  --output none
LOG_ID=$(az monitor log-analytics workspace show --resource-group "$RG" --workspace-name "$LOG_NAME" --query customerId -o tsv)
LOG_KEY=$(az monitor log-analytics workspace get-shared-keys --resource-group "$RG" --workspace-name "$LOG_NAME" --query primarySharedKey -o tsv)
ok "Log Analytics created"

# ─── Container App Environment ───────────────────────────────────────────────
info "Creating Container App Environment: $ENV_NAME..."
az containerapp env create \
  --name "$ENV_NAME" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  --logs-workspace-id "$LOG_ID" \
  --logs-workspace-key "$LOG_KEY" \
  --output none
ok "Container App Environment created"

# ─── Backend Container App ────────────────────────────────────────────────────
info "Creating Backend Container App..."
az containerapp create \
  --name "${PREFIX}-backend" \
  --resource-group "$RG" \
  --environment "$ENV_NAME" \
  --image "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest" \
  --registry-server "$ACR_SERVER" \
  --registry-username "$ACR_USER" \
  --registry-password "$ACR_PASS" \
  --target-port 5000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars \
    NODE_ENV=production \
    PORT=5000 \
    DATABASE_URL="$DB_URL" \
    REDIS_URL="$REDIS_URL" \
    JWT_SECRET="$JWT_SECRET" \
    JWT_REFRESH_SECRET="$JWT_REFRESH" \
    ENCRYPTION_KEY="$ENC_KEY" \
    FRONTEND_URL="https://$DOMAIN" \
    WHATSAPP_WEBHOOK_VERIFY_TOKEN="$WEBHOOK_TOKEN" \
    WHATSAPP_API_VERSION=v19.0 \
  --output none

BACKEND_FQDN=$(az containerapp show --name "${PREFIX}-backend" --resource-group "$RG" --query "properties.configuration.ingress.fqdn" -o tsv)
ok "Backend: https://$BACKEND_FQDN"

# ─── Frontend Container App ───────────────────────────────────────────────────
info "Creating Frontend Container App..."
az containerapp create \
  --name "${PREFIX}-frontend" \
  --resource-group "$RG" \
  --environment "$ENV_NAME" \
  --image "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest" \
  --registry-server "$ACR_SERVER" \
  --registry-username "$ACR_USER" \
  --registry-password "$ACR_PASS" \
  --target-port 80 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 2 \
  --cpu 0.25 \
  --memory 0.5Gi \
  --output none

FRONTEND_FQDN=$(az containerapp show --name "${PREFIX}-frontend" --resource-group "$RG" --query "properties.configuration.ingress.fqdn" -o tsv)
ok "Frontend: https://$FRONTEND_FQDN"

# ─── Build & Push Docker images ───────────────────────────────────────────────
info "Building and pushing Docker images..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

az acr login --name "$ACR_NAME"

docker build -t "$ACR_SERVER/whatsapp-crm-backend:latest" "$ROOT_DIR/backend"
docker push "$ACR_SERVER/whatsapp-crm-backend:latest"

docker build \
  --build-arg REACT_APP_API_URL="https://${BACKEND_FQDN}/api" \
  --build-arg REACT_APP_WS_URL="https://${BACKEND_FQDN}" \
  -t "$ACR_SERVER/whatsapp-crm-frontend:latest" \
  "$ROOT_DIR/frontend"
docker push "$ACR_SERVER/whatsapp-crm-frontend:latest"
ok "Images pushed to ACR"

# ─── Update Container Apps with real images ───────────────────────────────────
info "Updating Container Apps with production images..."
az containerapp update --name "${PREFIX}-backend" --resource-group "$RG" \
  --image "$ACR_SERVER/whatsapp-crm-backend:latest" --output none
az containerapp update --name "${PREFIX}-frontend" --resource-group "$RG" \
  --image "$ACR_SERVER/whatsapp-crm-frontend:latest" --output none

# ─── Run migrations ───────────────────────────────────────────────────────────
info "Waiting 30s for backend to start, then running migrations..."
sleep 30
az containerapp exec --name "${PREFIX}-backend" --resource-group "$RG" \
  --command "npx prisma migrate deploy" 2>/dev/null || true
az containerapp exec --name "${PREFIX}-backend" --resource-group "$RG" \
  --command "npx ts-node prisma/seed.ts" 2>/dev/null || true

# ─── Save config to file ─────────────────────────────────────────────────────
CONFIG_FILE="$ROOT_DIR/azure/azure-deployment.env"
cat > "$CONFIG_FILE" << EOF
# Azure Deployment Config — generated $(date)
AZURE_RESOURCE_GROUP=${RG}
AZURE_LOCATION=${LOCATION}
ACR_NAME=${ACR_NAME}
ACR_LOGIN_SERVER=${ACR_SERVER}
ACR_USERNAME=${ACR_USER}
BACKEND_URL=https://${BACKEND_FQDN}
FRONTEND_URL=https://${FRONTEND_FQDN}
WEBHOOK_URL=https://${BACKEND_FQDN}/webhook/whatsapp
WEBHOOK_VERIFY_TOKEN=${WEBHOOK_TOKEN}
DB_HOST=${PG_HOST}
REDIS_HOST=${REDIS_HOST}
EOF
ok "Config saved to $CONFIG_FILE"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║         ✅  Azure Deployment Complete!                           ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
printf "║  🌐 Frontend:  https://%-42s ║\n" "$FRONTEND_FQDN"
printf "║  🔧 Backend:   https://%-42s ║\n" "$BACKEND_FQDN"
printf "║  🔗 Webhook:   https://%s/webhook/whatsapp ║\n" "$BACKEND_FQDN"
printf "║  🔑 Token:     %-50s ║\n" "$WEBHOOK_TOKEN"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Next steps:                                                     ║"
echo "║  1. Add DNS CNAME: $DOMAIN → $FRONTEND_FQDN"
echo "║  2. Update Meta Webhook URL and verify token above               ║"
echo "║  3. Login: admin@demo.com / Admin123!                            ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

echo ""
echo "📋 GitHub Actions secrets to add (Settings → Secrets):"
echo "   AZURE_CREDENTIALS     = (run: az ad sp create-for-rbac --role contributor --scopes /subscriptions/\$(az account show --query id -o tsv) --json-auth)"
echo "   ACR_NAME              = $ACR_NAME"
echo "   ACR_LOGIN_SERVER      = $ACR_SERVER"
echo "   AZURE_RESOURCE_GROUP  = $RG"
