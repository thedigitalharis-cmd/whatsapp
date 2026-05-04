#!/usr/bin/env bash
# =============================================================================
#  WhatsApp CRM — Azure Deployment Script
#  Usage: bash azure/scripts/deploy.sh [--first-time]
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[ OK ]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()  { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }

FIRST_TIME="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
AZURE_DIR="$ROOT_DIR/azure"

# ─── Prerequisites ────────────────────────────────────────────────────────────
command -v az      &>/dev/null || die "Azure CLI not installed. Run: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
command -v docker  &>/dev/null || die "Docker not installed"
command -v terraform &>/dev/null || warn "Terraform not installed — skipping infra step"

# ─── Login check ─────────────────────────────────────────────────────────────
info "Checking Azure login..."
az account show &>/dev/null || { info "Logging in to Azure..."; az login; }
SUBSCRIPTION=$(az account show --query name -o tsv)
ok "Using Azure subscription: $SUBSCRIPTION"

# ─── First time: provision infrastructure with Terraform ─────────────────────
if [[ "$FIRST_TIME" == "--first-time" ]]; then
  info "Provisioning Azure infrastructure with Terraform..."

  if [[ ! -f "$AZURE_DIR/terraform/terraform.tfvars" ]]; then
    die "Create $AZURE_DIR/terraform/terraform.tfvars first. See terraform.tfvars.example"
  fi

  cd "$AZURE_DIR/terraform"
  terraform init
  terraform plan -out=tfplan
  echo ""
  read -rp "Apply this plan? (yes/no): " CONFIRM
  [[ "$CONFIRM" == "yes" ]] || die "Aborted"
  terraform apply tfplan

  # Extract outputs
  ACR_SERVER=$(terraform output -raw acr_login_server)
  ACR_USER=$(terraform output -raw acr_username)
  ACR_PASS=$(terraform output -raw acr_password)
  RG=$(terraform output -raw resource_group)

  ok "Infrastructure provisioned!"
  terraform output next_steps
else
  # Load from existing Terraform state
  cd "$AZURE_DIR/terraform"
  if terraform output acr_login_server &>/dev/null 2>&1; then
    ACR_SERVER=$(terraform output -raw acr_login_server)
    ACR_USER=$(terraform output -raw acr_username)
    ACR_PASS=$(terraform output -raw acr_password)
    RG=$(terraform output -raw resource_group)
  else
    # Fallback: read from env or prompt
    read -rp "ACR Login Server (e.g. whatsappcrmacrXXXXXX.azurecr.io): " ACR_SERVER
    ACR_USER=$(az acr credential show --name "${ACR_SERVER%%.*}" --query username -o tsv 2>/dev/null || echo "")
    ACR_PASS=$(az acr credential show --name "${ACR_SERVER%%.*}" --query passwords[0].value -o tsv 2>/dev/null || echo "")
    read -rp "Resource Group: " RG
  fi
fi

IMAGE_TAG="${IMAGE_TAG:-$(git -C "$ROOT_DIR" describe --tags --always 2>/dev/null || echo latest)}"
ACR_NAME="${ACR_SERVER%%.*}"

info "Building and pushing Docker images (tag: $IMAGE_TAG)..."

# ─── Login to ACR ─────────────────────────────────────────────────────────────
info "Logging in to ACR: $ACR_SERVER"
echo "$ACR_PASS" | docker login "$ACR_SERVER" -u "$ACR_USER" --password-stdin
ok "ACR login successful"

# ─── Build backend ────────────────────────────────────────────────────────────
info "Building backend image..."
docker build -t "$ACR_SERVER/whatsapp-crm-backend:$IMAGE_TAG" \
             -t "$ACR_SERVER/whatsapp-crm-backend:latest" \
             "$ROOT_DIR/backend"
docker push "$ACR_SERVER/whatsapp-crm-backend:$IMAGE_TAG"
docker push "$ACR_SERVER/whatsapp-crm-backend:latest"
ok "Backend image pushed"

# ─── Build frontend ───────────────────────────────────────────────────────────
info "Building frontend image..."
BACKEND_URL=$(az containerapp show --name whatsapp-crm-backend --resource-group "$RG" \
  --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "")
FRONTEND_BUILD_ARGS=""
if [[ -n "$BACKEND_URL" ]]; then
  FRONTEND_BUILD_ARGS="--build-arg REACT_APP_API_URL=https://${BACKEND_URL}/api --build-arg REACT_APP_WS_URL=https://${BACKEND_URL}"
fi

docker build $FRONTEND_BUILD_ARGS \
  -t "$ACR_SERVER/whatsapp-crm-frontend:$IMAGE_TAG" \
  -t "$ACR_SERVER/whatsapp-crm-frontend:latest" \
  "$ROOT_DIR/frontend"
docker push "$ACR_SERVER/whatsapp-crm-frontend:$IMAGE_TAG"
docker push "$ACR_SERVER/whatsapp-crm-frontend:latest"
ok "Frontend image pushed"

# ─── Update Container Apps to new revision ───────────────────────────────────
info "Updating Container App revisions..."
az containerapp update \
  --name whatsapp-crm-backend \
  --resource-group "$RG" \
  --image "$ACR_SERVER/whatsapp-crm-backend:$IMAGE_TAG" \
  --output none
ok "Backend Container App updated"

az containerapp update \
  --name whatsapp-crm-frontend \
  --resource-group "$RG" \
  --image "$ACR_SERVER/whatsapp-crm-frontend:$IMAGE_TAG" \
  --output none
ok "Frontend Container App updated"

# ─── Run DB migrations ────────────────────────────────────────────────────────
info "Running database migrations..."
az containerapp exec \
  --name whatsapp-crm-backend \
  --resource-group "$RG" \
  --command "npx prisma migrate deploy" 2>/dev/null || warn "Migration exec failed — may need to run manually"

# ─── Done ─────────────────────────────────────────────────────────────────────
BACKEND_URL=$(az containerapp show --name whatsapp-crm-backend --resource-group "$RG" \
  --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "check Azure portal")
FRONTEND_URL=$(az containerapp show --name whatsapp-crm-frontend --resource-group "$RG" \
  --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "check Azure portal")

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              ✅  Azure Deploy Complete!                      ║"
echo "╠══════════════════════════════════════════════════════════════╣"
printf "║  Frontend:  https://%-40s ║\n" "$FRONTEND_URL"
printf "║  Backend:   https://%-40s ║\n" "$BACKEND_URL"
printf "║  Webhook:   https://%s/webhook/whatsapp  ║\n" "$BACKEND_URL"
echo "╚══════════════════════════════════════════════════════════════╝"
