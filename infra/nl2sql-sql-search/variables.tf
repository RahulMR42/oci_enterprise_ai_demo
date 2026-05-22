variable "compartment_id" {
  description = "OCID of the compartment that owns SQL Search resources."
  type        = string
}

variable "region" {
  description = "OCI region for Autonomous Database, Database Tools, and Generative AI resources."
  type        = string
  default     = "us-chicago-1"
}

variable "resource_suffix" {
  description = "Six-character suffix used to group resources."
  type        = string
  default     = "000000"
}

variable "database_password_secret_id" {
  description = "Optional OCI Vault secret OCID containing the database password for Database Tools connections. Leave empty to let Terraform create a Vault, key, and secret."
  type        = string
  default     = ""
  sensitive   = true
}

variable "database_user_name" {
  description = "Database user for Database Tools connections."
  type        = string
  default     = "ADMIN"
}

variable "autonomous_database_display_name" {
  description = "Display name prefix for the Autonomous Database."
  type        = string
  default     = "enterprise-ai-demo-sql-search"
}

variable "autonomous_database_db_name" {
  description = "Autonomous Database name prefix. Oracle restricts DB names to alphanumeric characters."
  type        = string
  default     = "EADSQL"
}

variable "compute_count" {
  description = "ECPU compute count for the Autonomous Database."
  type        = number
  default     = 2
}

variable "data_storage_size_in_tbs" {
  description = "Storage size in TB for the Autonomous Database."
  type        = number
  default     = 1
}
