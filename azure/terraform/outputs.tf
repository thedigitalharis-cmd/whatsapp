output "resource_group" {
  value = azurerm_resource_group.main.name
}

output "acr_login_server" {
  value = azurerm_container_registry.acr.login_server
}

output "acr_username" {
  value = azurerm_container_registry.acr.admin_username
}

output "acr_password" {
  value     = azurerm_container_registry.acr.admin_password
  sensitive = true
}

output "backend_url" {
  value       = "https://${azurerm_container_app.backend.ingress[0].fqdn}"
  description = "Backend API URL"
}

output "frontend_url" {
  value       = "https://${azurerm_container_app.frontend.ingress[0].fqdn}"
  description = "Frontend URL"
}

output "postgres_host" {
  value = azurerm_postgresql_flexible_server.main.fqdn
}

output "redis_host" {
  value = azurerm_redis_cache.main.hostname
}

output "redis_port" {
  value = azurerm_redis_cache.main.ssl_port
}

output "storage_account_name" {
  value = azurerm_storage_account.main.name
}

output "webhook_url" {
  value       = "https://${azurerm_container_app.backend.ingress[0].fqdn}/webhook/whatsapp"
  description = "Paste this as Webhook URL in Meta Developer Console"
}

output "next_steps" {
  value = <<-EOT
    ✅ Infrastructure deployed!

    1. Set your DNS:
       ${var.domain}  →  CNAME  →  ${azurerm_container_app.frontend.ingress[0].fqdn}

    2. Update Meta Webhook:
       URL:   https://${azurerm_container_app.backend.ingress[0].fqdn}/webhook/whatsapp
       Token: ${var.whatsapp_verify_token}

    3. Push Docker images:
       az acr login --name ${azurerm_container_registry.acr.name}
       docker push ${azurerm_container_registry.acr.login_server}/whatsapp-crm-backend:latest
       docker push ${azurerm_container_registry.acr.login_server}/whatsapp-crm-frontend:latest

    4. Run DB migrations:
       az containerapp exec --name whatsapp-crm-backend \
         --resource-group ${azurerm_resource_group.main.name} \
         --command "npx prisma migrate deploy"
  EOT
}
