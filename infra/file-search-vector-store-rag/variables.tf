variable "compartment_id" {
  description = "OCID of the compartment that owns File Search resources."
  type        = string
}

variable "region" {
  description = "OCI region for the OpenAI-compatible Vector Stores API."
  type        = string
  default     = "us-chicago-1"
}

variable "profile" {
  description = "OCI CLI profile used for Vector Store control-plane authentication."
  type        = string
  default     = "DEFAULT"
}

variable "resource_suffix" {
  description = "Six-character suffix used to group resources."
  type        = string
  default     = "000000"
}

variable "vector_store_display_name" {
  description = "Display name for the File Search vector store."
  type        = string
  default     = "enterprise-ai-demo-file-search"
}

variable "shared_generated_dir" {
  description = "Directory containing shared Responses API generated project/api_key JSON files."
  type        = string
  default     = "../responses-api/.terraform/generated"
}
