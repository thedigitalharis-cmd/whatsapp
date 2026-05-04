terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.95"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Store state in Azure Blob Storage (uncomment after first apply)
  # backend "azurerm" {
  #   resource_group_name  = "whatsapp-crm-rg"
  #   storage_account_name = "crmtfstate"
  #   container_name       = "tfstate"
  #   key                  = "prod.terraform.tfstate"
  # }
}

provider "azurerm" {
  features {
    resource_group { prevent_deletion_if_contains_resources = false }
    key_vault      { purge_soft_delete_on_destroy = true }
  }
}

# ─── Random suffix for globally unique names ──────────────────────────────────
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

locals {
  suffix = random_string.suffix.result
  tags = {
    project     = "whatsapp-crm"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ─── Resource Group ───────────────────────────────────────────────────────────
resource "azurerm_resource_group" "main" {
  name     = "${var.resource_prefix}-rg"
  location = var.location
  tags     = local.tags
}

# ─── Azure Container Registry ─────────────────────────────────────────────────
resource "azurerm_container_registry" "acr" {
  name                = "${replace(var.resource_prefix, "-", "")}acr${local.suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true
  tags                = local.tags
}

# ─── Log Analytics Workspace ──────────────────────────────────────────────────
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.resource_prefix}-logs"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

# ─── Container Apps Environment ───────────────────────────────────────────────
resource "azurerm_container_app_environment" "main" {
  name                       = "${var.resource_prefix}-env"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = local.tags
}

# ─── PostgreSQL Flexible Server ───────────────────────────────────────────────
resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "${var.resource_prefix}-pg-${local.suffix}"
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = "16"
  administrator_login    = var.db_user
  administrator_password = var.db_password
  zone                   = "1"
  storage_mb             = 32768
  sku_name               = "B_Standard_B1ms"
  backup_retention_days  = 7
  tags                   = local.tags
}

resource "azurerm_postgresql_flexible_server_database" "crm" {
  name      = "whatsapp_crm"
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# ─── Azure Cache for Redis ────────────────────────────────────────────────────
resource "azurerm_redis_cache" "main" {
  name                = "${var.resource_prefix}-redis-${local.suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  capacity            = 0
  family              = "C"
  sku_name            = "Basic"
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"
  tags                = local.tags
}

# ─── Storage Account (for file uploads + DB backups) ─────────────────────────
resource "azurerm_storage_account" "main" {
  name                     = "${replace(var.resource_prefix, "-", "")}st${local.suffix}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
  tags                     = local.tags
}

resource "azurerm_storage_container" "uploads" {
  name                  = "uploads"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "backups" {
  name                  = "db-backups"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

# ─── Backend Container App ────────────────────────────────────────────────────
resource "azurerm_container_app" "backend" {
  name                         = "${var.resource_prefix}-backend"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"
  tags                         = local.tags

  registry {
    server               = azurerm_container_registry.acr.login_server
    username             = azurerm_container_registry.acr.admin_username
    password_secret_name = "acr-password"
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.acr.admin_password
  }
  secret {
    name  = "db-password"
    value = var.db_password
  }
  secret {
    name  = "jwt-secret"
    value = var.jwt_secret
  }
  secret {
    name  = "jwt-refresh-secret"
    value = var.jwt_refresh_secret
  }
  secret {
    name  = "encryption-key"
    value = var.encryption_key
  }
  secret {
    name  = "openai-key"
    value = var.openai_api_key
  }
  secret {
    name  = "stripe-key"
    value = var.stripe_secret_key
  }
  secret {
    name  = "redis-key"
    value = azurerm_redis_cache.main.primary_access_key
  }

  template {
    min_replicas = 1
    max_replicas = 3

    container {
      name   = "backend"
      image  = "${azurerm_container_registry.acr.login_server}/${var.resource_prefix}-backend:latest"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = "5000"
      }
      env {
        name  = "DATABASE_URL"
        value = "postgresql://${var.db_user}:${var.db_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/whatsapp_crm?sslmode=require"
      }
      env {
        name        = "REDIS_URL"
        secret_name = "redis-key"
      }
      env {
        name        = "JWT_SECRET"
        secret_name = "jwt-secret"
      }
      env {
        name        = "JWT_REFRESH_SECRET"
        secret_name = "jwt-refresh-secret"
      }
      env {
        name        = "ENCRYPTION_KEY"
        secret_name = "encryption-key"
      }
      env {
        name        = "OPENAI_API_KEY"
        secret_name = "openai-key"
      }
      env {
        name        = "STRIPE_SECRET_KEY"
        secret_name = "stripe-key"
      }
      env {
        name  = "FRONTEND_URL"
        value = "https://${var.domain}"
      }
      env {
        name  = "WHATSAPP_WEBHOOK_VERIFY_TOKEN"
        value = var.whatsapp_verify_token
      }
      env {
        name  = "WHATSAPP_API_VERSION"
        value = "v19.0"
      }

      liveness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 5000
      }
      readiness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 5000
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 5000
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  depends_on = [azurerm_container_registry.acr]
}

# ─── Frontend Container App ───────────────────────────────────────────────────
resource "azurerm_container_app" "frontend" {
  name                         = "${var.resource_prefix}-frontend"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"
  tags                         = local.tags

  registry {
    server               = azurerm_container_registry.acr.login_server
    username             = azurerm_container_registry.acr.admin_username
    password_secret_name = "acr-password"
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.acr.admin_password
  }

  template {
    min_replicas = 1
    max_replicas = 2

    container {
      name   = "frontend"
      image  = "${azurerm_container_registry.acr.login_server}/${var.resource_prefix}-frontend:latest"
      cpu    = 0.25
      memory = "0.5Gi"
    }
  }

  ingress {
    external_enabled = true
    target_port      = 80
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
    custom_domain {
      name                     = var.domain
      certificate_binding_type = "SniEnabled"
    }
  }

  depends_on = [azurerm_container_registry.acr]
}

# ─── Key Vault (for secrets) ──────────────────────────────────────────────────
data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  name                = "${replace(var.resource_prefix, "-", "")}kv${local.suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id
    secret_permissions = ["Get", "List", "Set", "Delete", "Purge"]
  }

  tags = local.tags
}
