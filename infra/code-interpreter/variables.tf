variable "region" {
  description = "OCI region for the OpenAI-compatible Containers API."
  type        = string
  default     = "us-chicago-1"
}

variable "resource_suffix" {
  description = "Six-character suffix used to group resources."
  type        = string
  default     = "000000"
}

variable "container_display_name" {
  description = "Display name for the Code Interpreter container."
  type        = string
  default     = "enterprise-ai-demo-code-interpreter"
}

variable "container_memory_limit" {
  description = "Code Interpreter container memory limit. Supported OCI values include 1g, 4g, 16g, and 64g."
  type        = string
  default     = "1g"
}

variable "shared_generated_dir" {
  description = "Directory containing shared Responses API generated project/api_key JSON files."
  type        = string
  default     = "../responses-api/.terraform/generated"
}
