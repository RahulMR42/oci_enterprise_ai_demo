variable "compartment_id" {
  description = "OCID of the compartment that owns any OCI resources required by this demo."
  type        = string
  default     = ""
}

variable "region" {
  description = "OCI region for the Responses API endpoint."
  type        = string
  default     = "us-chicago-1"
}

variable "profile" {
  description = "OCI CLI profile used by Terraform local-exec fallback provisioning."
  type        = string
  default     = "DEFAULT"
}

variable "project_display_name" {
  description = "Display name for the OCI Generative AI project created for the Responses API demo."
  type        = string
  default     = "enterprise-ai-demo-responses-api"
}

variable "api_key_display_name" {
  description = "Display name for the OCI Generative AI API key created for the Responses API demo."
  type        = string
  default     = "enterprise-ai-demo-responses-api-key"
}

variable "api_key_expiry" {
  description = "Expiration timestamp for the generated OCI Generative AI API key."
  type        = string
  default     = "2035-01-01T00:00:00+00:00"
}

variable "resource_suffix" {
  description = "Six-character suffix used to group resources. The backend/startup script generates it only when Terraform state does not already contain one."
  type        = string
  default     = "000000"
}
