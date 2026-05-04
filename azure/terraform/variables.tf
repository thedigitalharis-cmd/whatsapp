variable "resource_prefix" {
  description = "Prefix for all Azure resource names"
  type        = string
  default     = "whatsapp-crm"
}

variable "location" {
  description = "Azure region to deploy resources"
  type        = string
  default     = "eastus"
  # Other options: westeurope, uaenorth (Dubai), southeastasia, centralindia
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "domain" {
  description = "Your custom domain e.g. crm.huco.ae"
  type        = string
}

# ─── Database ────────────────────────────────────────────────────────────────
variable "db_user" {
  description = "PostgreSQL admin username"
  type        = string
  default     = "crm_admin"
}

variable "db_password" {
  description = "PostgreSQL admin password (min 8 chars, requires uppercase, number, special char)"
  type        = string
  sensitive   = true
}

# ─── JWT Secrets ─────────────────────────────────────────────────────────────
variable "jwt_secret" {
  description = "JWT signing secret (64+ chars random string)"
  type        = string
  sensitive   = true
}

variable "jwt_refresh_secret" {
  description = "JWT refresh token secret"
  type        = string
  sensitive   = true
}

variable "encryption_key" {
  description = "32-character encryption key"
  type        = string
  sensitive   = true
}

# ─── WhatsApp ────────────────────────────────────────────────────────────────
variable "whatsapp_verify_token" {
  description = "Webhook verify token for Meta"
  type        = string
  default     = "crm_verify_y2y2v2i0"
}

# ─── Optional services ───────────────────────────────────────────────────────
variable "openai_api_key" {
  description = "OpenAI API key for AI features"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_secret_key" {
  description = "Stripe secret key for payments"
  type        = string
  sensitive   = true
  default     = ""
}
