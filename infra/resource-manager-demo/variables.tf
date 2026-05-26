variable "tenancy_id" {
  description = "Tenancy OCID where shared IAM resources are created."
  type        = string
}

variable "compartment_id" {
  description = "Compartment OCID that owns the Enterprise AI demo resources."
  type        = string
}

variable "region" {
  description = "OCI region for the demo stack."
  type        = string
  default     = "us-chicago-1"
}

variable "profile" {
  description = "OCI CLI profile used by local-exec based demo modules when running outside OCI Resource Manager."
  type        = string
  default     = ""
}

variable "resource_suffix" {
  description = "Six-character suffix used to group all demo resources."
  type        = string
}

variable "hosted_applications_local_exec_enabled" {
  description = "Enable hosted application local-exec deployment. Keep false in OCI Resource Manager because its worker does not expose OCI CLI Resource Principal auth."
  type        = bool
  default     = false
}

variable "responses_api_local_exec_enabled" {
  description = "Enable Responses API local-exec project/API-key provisioning. Keep false in OCI Resource Manager because its worker does not expose OCI CLI Resource Principal auth."
  type        = bool
  default     = false
}

variable "file_search_local_exec_enabled" {
  description = "Enable File Search local-exec vector store provisioning. Keep false in OCI Resource Manager because it depends on generated Responses API credentials."
  type        = bool
  default     = false
}

variable "code_interpreter_local_exec_enabled" {
  description = "Enable Code Interpreter local-exec container provisioning. Keep false in OCI Resource Manager because it depends on generated Responses API credentials."
  type        = bool
  default     = false
}

variable "project_display_name" {
  description = "Display name prefix for the shared OCI Generative AI project."
  type        = string
  default     = "enterprise-ai-demo-responses-api"
}

variable "hosted_app_push_image" {
  description = "When true, hosted-app Terraform provisioners build and push local container images. Keep false for OCI Resource Manager unless its worker image has a compatible container builder."
  type        = bool
  default     = false
}

variable "devops_hosted_image_build_enabled" {
  description = "When true, Resource Manager creates an OCI DevOps build pipeline/run to build and push hosted app images."
  type        = bool
  default     = true
}

variable "devops_hosted_image_run_build" {
  description = "When true, Resource Manager starts the OCI DevOps hosted image build run during apply."
  type        = bool
  default     = true
}

variable "devops_source_repo_url" {
  description = "Git repository URL containing this demo source and the DevOps build spec."
  type        = string
  default     = "https://github.com/RahulMR42/oci_enterprise_ai_demo.git"
}

variable "devops_source_branch" {
  description = "Upstream Git branch Resource Manager clones before seeding the OCI DevOps code repository."
  type        = string
  default     = "main"
}

variable "devops_repository_branch" {
  description = "Branch name used inside the OCI DevOps hosted code repository and build source."
  type        = string
  default     = "main"
}

variable "devops_source_connection_type" {
  description = "Build source connection type. Use GITHUB for GitHub or DEVOPS_CODE_REPOSITORY for an OCI Code Repository."
  type        = string
  default     = "GITHUB"
}

variable "devops_source_connection_id" {
  description = "Existing OCI DevOps connection OCID. Required unless devops_create_github_connection is true."
  type        = string
  default     = ""
}

variable "devops_source_repository_id" {
  description = "OCI DevOps code repository OCID. Required when devops_source_connection_type is DEVOPS_CODE_REPOSITORY."
  type        = string
  default     = ""
}

variable "devops_create_repository" {
  description = "When true, Resource Manager creates an OCI DevOps code repository and seeds it from devops_source_repo_url."
  type        = bool
  default     = true
}

variable "devops_repository_git_username" {
  description = "Git username Resource Manager uses to push source into the OCI DevOps code repository."
  type        = string
  default     = ""
}

variable "devops_repository_git_password" {
  description = "Git password or auth token Resource Manager uses to push source into the OCI DevOps code repository."
  type        = string
  sensitive   = true
  default     = ""
}

variable "devops_create_github_connection" {
  description = "When true, create an OCI DevOps GitHub connection from devops_source_access_token_secret_id."
  type        = bool
  default     = false
}

variable "devops_source_access_token_secret_id" {
  description = "OCI Vault secret OCID containing a GitHub personal access token for the DevOps connection."
  type        = string
  default     = ""
}

variable "devops_ocir_username" {
  description = "OCIR username used by the DevOps build to push hosted app images."
  type        = string
  default     = ""
}

variable "devops_ocir_auth_token" {
  description = "OCIR auth token used by the DevOps build to push hosted app images."
  type        = string
  sensitive   = true
  default     = ""
}

variable "hosted_app_container_cli" {
  description = "Container CLI used by hosted-app modules when hosted_app_push_image is true."
  type        = string
  default     = "podman"
}

variable "hosted_app_ocir_region_key" {
  description = "OCIR region key used to derive repository URIs."
  type        = string
  default     = "ord"
}

variable "portal_container_enabled" {
  description = "When true, create a public OCI Container Instance for the demo portal from the prebuilt OCIR image."
  type        = bool
  default     = true
}

variable "portal_container_image_uri" {
  description = "Optional full OCIR image URI for the demo portal container. Leave empty to use the stack namespace, hosted_app_ocir_region_key, portal_container_repository_name, and portal_container_image_tag."
  type        = string
  default     = ""
}

variable "portal_container_repository_name" {
  description = "OCIR repository name that stores the demo portal image."
  type        = string
  default     = "enterprise-ai-demo/portal-rm"
}

variable "portal_container_image_tag" {
  description = "Image tag for the demo portal container."
  type        = string
  default     = "latest"
}

variable "portal_container_port" {
  description = "Public TCP port exposed by the demo portal container."
  type        = number
  default     = 5173
}

variable "portal_container_shape" {
  description = "OCI Container Instance shape for the demo portal."
  type        = string
  default     = "CI.Standard.E4.Flex"
}

variable "portal_container_ocpus" {
  description = "OCPUs assigned to the demo portal container instance."
  type        = number
  default     = 1
}

variable "portal_container_memory_gbs" {
  description = "Memory assigned to the demo portal container."
  type        = number
  default     = 4
}

variable "portal_vcn_cidr" {
  description = "CIDR block for the demo portal VCN."
  type        = string
  default     = "10.42.0.0/16"
}

variable "portal_subnet_cidr" {
  description = "Public subnet CIDR block for the demo portal container instance."
  type        = string
  default     = "10.42.1.0/24"
}

variable "portal_auth_password" {
  description = "Optional fixed portal login password. Leave empty to let Terraform generate one and expose it as a sensitive output."
  type        = string
  sensitive   = true
  default     = ""
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

variable "n8n_basic_auth_user" {
  description = "Username for the hosted n8n basic authentication boundary."
  type        = string
  default     = "admin"
}

variable "n8n_basic_auth_password" {
  description = "Password for the hosted n8n basic authentication boundary."
  type        = string
  sensitive   = true
}

variable "n8n_image_repository_uri" {
  description = "Optional prebuilt n8n image repository URI."
  type        = string
  default     = ""
}

variable "langfuse_image_repository_uri" {
  description = "Optional prebuilt Langfuse image repository URI."
  type        = string
  default     = ""
}

variable "openclaw_image_repository_uri" {
  description = "Optional prebuilt OpenClaw image repository URI."
  type        = string
  default     = ""
}

variable "llamaindex_image_repository_uri" {
  description = "Optional prebuilt LlamaIndex control tower image repository URI."
  type        = string
  default     = ""
}

variable "openclaw_gateway_token" {
  description = "Shared gateway token for the OpenClaw Control UI."
  type        = string
  sensitive   = true
  default     = ""
}
