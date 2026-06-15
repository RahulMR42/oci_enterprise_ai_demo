variable "compartment_id" {
  description = "OCI compartment OCID for OCIR and OCI Generative AI hosted application resources."
  type        = string
}

variable "region" {
  description = "OCI region."
  type        = string
  default     = "us-chicago-1"
}

variable "profile" {
  description = "OCI CLI profile."
  type        = string
  default     = "DEFAULT"
}

variable "resource_suffix" {
  description = "Six-character suffix used to group resources."
  type        = string
  default     = "000000"
}

variable "repository_name" {
  description = "OCIR repository name for the hosted agent image."
  type        = string
  default     = "enterprise-ai-demo/hosted-agent"
}

variable "langgraph_repository_name" {
  description = "OCIR repository name for the LangGraph hosted agent image."
  type        = string
  default     = "enterprise-ai-demo/hosted-langgraph-agent"
}

variable "openclaw_repository_name" {
  description = "OCIR repository name for the OpenClaw hosted agent gateway image."
  type        = string
  default     = "enterprise-ai-demo/hosted-openclaw"
}

variable "openclaw_image_repository_uri" {
  description = "Optional prebuilt container repository URI for the OpenClaw hosted agent gateway image. Leave empty to build and push the OpenClaw wrapper image to OCIR."
  type        = string
  default     = ""
}

variable "llamaindex_repository_name" {
  description = "OCIR repository name for the hosted LlamaIndex control tower image."
  type        = string
  default     = "enterprise-ai-demo/hosted-llamaindex-control-tower"
}

variable "llamaindex_image_repository_uri" {
  description = "Optional prebuilt container repository URI for the LlamaIndex control tower image. Leave empty to build and push the wrapper image to OCIR."
  type        = string
  default     = ""
}

variable "image_tag" {
  description = "Container image tag pushed to OCIR and used by hosted deployment."
  type        = string
  default     = "latest"
}

variable "ocir_region_key" {
  description = "OCIR region key. For us-chicago-1 this is ord."
  type        = string
  default     = "ord"
}

variable "container_cli" {
  description = "Container CLI used to build and push the hosted agent image. Use podman when already logged into OCIR."
  type        = string
  default     = "podman"
}

variable "hosted_application_display_name" {
  description = "Display name for the OCI Generative AI hosted application."
  type        = string
  default     = "enterprise-ai-demo-hosted-agent"
}

variable "hosted_deployment_display_name" {
  description = "Display name for the OCI Generative AI hosted deployment."
  type        = string
  default     = "enterprise-ai-demo-hosted-agent-deployment"
}

variable "langgraph_hosted_application_display_name" {
  description = "Display name for the LangGraph OCI Generative AI hosted application."
  type        = string
  default     = "enterprise-ai-demo-langgraph-agent"
}

variable "langgraph_hosted_deployment_display_name" {
  description = "Display name for the LangGraph OCI Generative AI hosted deployment."
  type        = string
  default     = "enterprise-ai-demo-langgraph-agent-deployment"
}

variable "openclaw_hosted_application_display_name" {
  description = "Display name for the OpenClaw OCI Generative AI hosted application."
  type        = string
  default     = "enterprise-ai-demo-openclaw"
}

variable "openclaw_hosted_deployment_display_name" {
  description = "Display name for the OpenClaw OCI Generative AI hosted deployment."
  type        = string
  default     = "enterprise-ai-demo-openclaw-deployment"
}

variable "llamaindex_hosted_application_display_name" {
  description = "Display name for the LlamaIndex OCI Generative AI hosted application."
  type        = string
  default     = "enterprise-ai-demo-llamaindex-control-tower"
}

variable "llamaindex_hosted_deployment_display_name" {
  description = "Display name for the LlamaIndex OCI Generative AI hosted deployment."
  type        = string
  default     = "enterprise-ai-demo-llamaindex-control-tower-deployment"
}

variable "app_source_dir" {
  description = "Local container source directory for the hosted agent application."
  type        = string
  default     = "../../apps/hosted-agent"
}

variable "langgraph_app_source_dir" {
  description = "Local container source directory for the LangGraph hosted agent application."
  type        = string
  default     = "../../apps/hosted-langgraph-agent"
}

variable "openclaw_app_source_dir" {
  description = "Local container source directory for the OpenClaw hosted agent gateway application."
  type        = string
  default     = "../../apps/hosted-openclaw"
}

variable "llamaindex_app_source_dir" {
  description = "Local container source directory for the LlamaIndex control tower hosted application."
  type        = string
  default     = "../../apps/hosted-llamaindex-control-tower"
}

variable "push_image" {
  description = "When true, Terraform local-exec builds and pushes the hosted agent image to OCIR."
  type        = bool
  default     = true
}

variable "hosted_image_build_run_id" {
  description = "Optional OCI DevOps build run OCID that must complete before hosted deployments reference image tags."
  type        = string
  default     = ""
}

variable "hosted_cli_deployments_enabled" {
  description = "When true, this Terraform module runs OCI CLI local-exec deployment for hosted applications. Keep false in Resource Manager and deploy through OCI DevOps instead."
  type        = bool
  default     = true
}

variable "idcs_domain_url" {
  description = "Existing identity domain URL used for hosted application inbound OAuth authentication."
  type        = string
}

variable "idcs_audience" {
  description = "Existing identity domain OAuth audience for hosted application inbound authentication."
  type        = string
}

variable "idcs_scope" {
  description = "Existing identity domain OAuth scope for hosted application inbound authentication."
  type        = string
}

variable "openclaw_gateway_token" {
  description = "Shared gateway token for the OpenClaw Control UI. Provide with TF_VAR_openclaw_gateway_token for a stable token."
  type        = string
  sensitive   = true
  default     = ""
}

variable "hosted_app_idcs_launch_client_enabled" {
  description = "When true, Terraform creates a dedicated confidential IDCS OAuth client for hosted UI launch proxies."
  type        = bool
  default     = true
}

variable "hosted_app_idcs_domain_url" {
  description = "Optional hosted UI launch identity domain URL. Defaults to idcs_domain_url."
  type        = string
  default     = ""
}

variable "hosted_app_idcs_audience" {
  description = "Optional hosted UI launch OAuth audience. Defaults to idcs_audience."
  type        = string
  default     = ""
}

variable "hosted_app_idcs_scope" {
  description = "Optional hosted UI launch OAuth scope. Defaults to idcs_scope."
  type        = string
  default     = ""
}

variable "hosted_app_idcs_client_display_name" {
  description = "Display name for the Terraform-managed hosted UI launch confidential app."
  type        = string
  default     = "enterprise-ai-demo-hosted-launch-client"
}

variable "hosted_app_idcs_redirect_uris" {
  description = "Browser OAuth redirect URIs for the shared hosted UI launch confidential app. Add hosted application callback URLs here if switching from client-credentials proxy launch to authorization-code launch."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for uri in var.hosted_app_idcs_redirect_uris : startswith(uri, "https://")])
    error_message = "IDCS redirect URIs must use https://."
  }
}

variable "scaling_type" {
  description = "Hosted application scaling metric. Valid OCI values include CONCURRENCY, CPU, MEMORY, and REQUESTS_PER_SECOND."
  type        = string
  default     = "REQUESTS_PER_SECOND"
}
