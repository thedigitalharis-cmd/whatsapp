terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = "${var.region}-a"
}

# ─── Static IP ────────────────────────────────────────────────────────────────
resource "google_compute_address" "static_ip" {
  name   = "whatsapp-crm-ip"
  region = var.region
}

# ─── Firewall rules ───────────────────────────────────────────────────────────
resource "google_compute_firewall" "http_https" {
  name    = "whatsapp-crm-http-https"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  target_tags   = ["whatsapp-crm"]
  source_ranges = ["0.0.0.0/0"]
}

resource "google_compute_firewall" "ssh" {
  name    = "whatsapp-crm-ssh"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  target_tags   = ["whatsapp-crm"]
  source_ranges = ["0.0.0.0/0"]
}

# ─── Compute Engine VM ────────────────────────────────────────────────────────
resource "google_compute_instance" "vm" {
  name         = "whatsapp-crm"
  machine_type = var.machine_type
  zone         = "${var.region}-a"
  tags         = ["whatsapp-crm"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts"
      size  = var.disk_size_gb
      type  = "pd-standard"
    }
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip = google_compute_address.static_ip.address
    }
  }

  metadata_startup_script = <<-SCRIPT
    #!/bin/bash
    apt-get update -qq
    apt-get install -y -qq git curl
    # Full setup runs via gcloud ssh in setup-gcp.sh
  SCRIPT

  service_account {
    scopes = ["cloud-platform"]
  }

  labels = {
    project     = "whatsapp-crm"
    environment = var.environment
  }
}

# ─── Artifact Registry (for Docker images) ────────────────────────────────────
resource "google_artifact_registry_repository" "registry" {
  location      = var.region
  repository_id = "whatsapp-crm"
  description   = "WhatsApp CRM Docker images"
  format        = "DOCKER"
}
