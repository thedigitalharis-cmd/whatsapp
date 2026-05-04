variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
  # UAE / Middle East closest: asia-south1 (Mumbai) or me-west1 (Tel Aviv)
  # Southeast Asia: asia-southeast1 (Singapore)
  # Europe: europe-west1 (Belgium)
}

variable "machine_type" {
  description = "GCP machine type"
  type        = string
  default     = "e2-small"
  # e2-micro  = FREE TIER (1 shared vCPU, 1GB) - tight for this app
  # e2-small  = ~$13/mo (2 shared vCPU, 2GB) - recommended
  # e2-medium = ~$26/mo (2 shared vCPU, 4GB) - comfortable
}

variable "disk_size_gb" {
  description = "Boot disk size in GB"
  type        = number
  default     = 50
}

variable "environment" {
  description = "Environment label"
  type        = string
  default     = "production"
}
