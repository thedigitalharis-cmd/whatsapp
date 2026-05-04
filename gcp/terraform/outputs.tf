output "static_ip" {
  value       = google_compute_address.static_ip.address
  description = "Server IP — add as A record for betteraisender.com"
}

output "vm_name" {
  value = google_compute_instance.vm.name
}

output "ssh_command" {
  value = "gcloud compute ssh ${google_compute_instance.vm.name} --zone=${var.region}-a --project=${var.project_id}"
}

output "artifact_registry" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/whatsapp-crm"
}

output "next_steps" {
  value = <<-EOT
    ✅ Infrastructure ready!

    1. Point DNS: betteraisender.com → A record → ${google_compute_address.static_ip.address}

    2. Run full setup:
       bash gcp/scripts/setup-gcp.sh

    3. SSH in manually:
       gcloud compute ssh ${google_compute_instance.vm.name} --zone=${var.region}-a

    4. After DNS propagates, issue SSL:
       bash gcp/scripts/ssl.sh your@email.com
  EOT
}
