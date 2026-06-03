variable "region" {
  description = "OCI region for the OpenAI-compatible Conversations API."
  type        = string
  default     = "us-chicago-1"
}

variable "resource_suffix" {
  description = "Six-character suffix used to group generated demo resources."
  type        = string
  default     = "000000"
}

variable "conversation_metadata_topic" {
  description = "Metadata topic stored on the generated OCI conversation object."
  type        = string
  default     = "enterprise-ai-demo-conversation-store"
}

variable "shared_generated_dir" {
  description = "Directory containing shared Responses API generated project/api_key JSON files."
  type        = string
  default     = "../responses-api/.terraform/generated"
}

variable "oci_genai_project_id" {
  description = "Optional OCI Generative AI project OCID. When set, local-exec uses it instead of shared_generated_dir/project.json."
  type        = string
  default     = ""
}

variable "oci_genai_api_key" {
  description = "Optional OCI Generative AI Responses API key. When set, local-exec uses it instead of shared_generated_dir/api_key.json."
  type        = string
  sensitive   = true
  default     = ""
}
