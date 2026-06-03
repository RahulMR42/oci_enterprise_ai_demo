variable "tenancy_id" {
  description = "Tenancy OCID where shared IAM resources are created."
  type        = string

  validation {
    condition     = can(regex("^ocid1\\.tenancy\\.oc1\\.", var.tenancy_id))
    error_message = "tenancy_id must be a valid OCI tenancy OCID."
  }
}

variable "compartment_id" {
  description = "Compartment OCID that owns the Enterprise AI demo resources."
  type        = string

  validation {
    condition     = can(regex("^ocid1\\.compartment\\.oc1\\.", var.compartment_id))
    error_message = "compartment_id must be a valid OCI compartment OCID."
  }
}

variable "region" {
  description = "OCI region for the demo stack."
  type        = string
  default     = "us-chicago-1"

  validation {
    condition     = can(regex("^[a-z]+-[a-z]+-[0-9]+$", var.region))
    error_message = "region must be an OCI region identifier such as us-chicago-1."
  }
}

variable "profile" {
  description = "OCI CLI profile used by local-exec based demo modules when running outside OCI Resource Manager."
  type        = string
  default     = ""
}

variable "resource_suffix" {
  description = "Six-character suffix used to group all demo resources."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]{6}$", var.resource_suffix))
    error_message = "resource_suffix must be exactly six lowercase letters or digits."
  }
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
  description = "Enable File Search local-exec vector store provisioning so the portal receives OCI_GENAI_VECTOR_STORE_ID."
  type        = bool
  default     = true
}

variable "conversation_store_local_exec_enabled" {
  description = "Enable Conversation Store local-exec provisioning so the portal receives OCI_GENAI_CONVERSATION_ID."
  type        = bool
  default     = true
}

variable "code_interpreter_local_exec_enabled" {
  description = "Enable Code Interpreter local-exec container provisioning so the portal receives OCI_GENAI_CODE_INTERPRETER_CONTAINER."
  type        = bool
  default     = true
}

variable "project_display_name" {
  description = "Display name prefix for the shared OCI Generative AI project."
  type        = string
  default     = "enterprise-ai-demo-responses-api"

  validation {
    condition     = length(trimspace(var.project_display_name)) > 0 && length(var.project_display_name) <= 80
    error_message = "project_display_name must be non-empty and at most 80 characters."
  }
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

variable "deploy_only_app" {
  description = "When true, the OCI DevOps pipeline builds and delivers only the portal image and skips hosted application image delivery and deployment stages so only the portal app container is redeployed."
  type        = bool
  default     = false
}

variable "oci_ha_langfuse_deploy" {
  description = "When true, the OCI DevOps pipeline deploys the Langfuse hosted application stage. Other hosted app deployment stages stay disabled."
  type        = bool
  default     = false
}

variable "app_deploy" {
  description = "Hosted application deployment selector. Use all to deploy every hosted application, or leave empty to use the per-application switches."
  type        = string
  default     = ""

  validation {
    condition     = contains(["", "all"], lower(var.app_deploy))
    error_message = "app_deploy must be empty or all."
  }
}

variable "oci_ha_hosted_agent_deploy" {
  description = "When true, the OCI DevOps pipeline deploys the hosted-agent hosted application stage."
  type        = bool
  default     = false
}

variable "oci_ha_langgraph_deploy" {
  description = "When true, the OCI DevOps pipeline deploys the LangGraph hosted application stage."
  type        = bool
  default     = false
}

variable "oci_ha_openclaw_deploy" {
  description = "When true, the OCI DevOps pipeline deploys the OpenClaw hosted application stage."
  type        = bool
  default     = false
}

variable "oci_ha_llamaindex_deploy" {
  description = "When true, the OCI DevOps pipeline deploys the LlamaIndex control tower hosted application stage."
  type        = bool
  default     = false
}

variable "existing_hosted_deployment_exports_json" {
  description = "Non-sensitive JSON map of existing hosted application deployment IDs and URLs used by deploy_only_app portal-only redeployments."
  type        = string
  default     = "{}"

  validation {
    condition     = can(jsondecode(var.existing_hosted_deployment_exports_json))
    error_message = "existing_hosted_deployment_exports_json must be valid JSON."
  }
}

variable "devops_source_repo_url" {
  description = "Git repository URL containing this demo source and the DevOps build spec."
  type        = string
  default     = "https://github.com/RahulMR42/oci_enterprise_ai_demo.git"

  validation {
    condition     = can(regex("^https://", var.devops_source_repo_url))
    error_message = "devops_source_repo_url must be an HTTPS Git URL."
  }
}

variable "devops_source_branch" {
  description = "Upstream Git branch Resource Manager clones before seeding the OCI DevOps code repository."
  type        = string
  default     = "oci-rms"

  validation {
    condition     = can(regex("^[A-Za-z0-9._/-]+$", var.devops_source_branch))
    error_message = "devops_source_branch may contain only letters, numbers, dot, underscore, slash, and dash."
  }
}

variable "devops_source_revision" {
  description = "Optional source revision marker used to force a new Resource Manager-seeded DevOps build run when branch contents change."
  type        = string
  default     = ""

  validation {
    condition     = var.devops_source_revision == "" || can(regex("^[A-Fa-f0-9]{7,40}$", var.devops_source_revision))
    error_message = "devops_source_revision must be empty or a Git commit SHA."
  }
}

variable "devops_repository_branch" {
  description = "Branch name used inside the OCI DevOps hosted code repository and build source."
  type        = string
  default     = "main"

  validation {
    condition     = can(regex("^[A-Za-z0-9._/-]+$", var.devops_repository_branch))
    error_message = "devops_repository_branch may contain only letters, numbers, dot, underscore, slash, and dash."
  }
}

variable "devops_source_connection_type" {
  description = "Build source connection type. Use GITHUB for GitHub or DEVOPS_CODE_REPOSITORY for an OCI Code Repository."
  type        = string
  default     = "GITHUB"

  validation {
    condition     = contains(["GITHUB", "DEVOPS_CODE_REPOSITORY"], var.devops_source_connection_type)
    error_message = "devops_source_connection_type must be GITHUB or DEVOPS_CODE_REPOSITORY."
  }
}

variable "devops_source_connection_id" {
  description = "Existing OCI DevOps connection OCID. Required unless devops_create_github_connection is true."
  type        = string
  default     = ""

  validation {
    condition     = var.devops_source_connection_id == "" || can(regex("^ocid1\\.devopsconnection\\.oc1\\.", var.devops_source_connection_id))
    error_message = "devops_source_connection_id must be empty or a valid OCI DevOps connection OCID."
  }
}

variable "devops_source_repository_id" {
  description = "OCI DevOps code repository OCID. Required when devops_source_connection_type is DEVOPS_CODE_REPOSITORY."
  type        = string
  default     = ""

  validation {
    condition     = var.devops_source_repository_id == "" || can(regex("^ocid1\\.devopsrepository\\.oc1\\.", var.devops_source_repository_id))
    error_message = "devops_source_repository_id must be empty or a valid OCI DevOps repository OCID."
  }
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

  validation {
    condition     = var.devops_source_access_token_secret_id == "" || can(regex("^ocid1\\.vaultsecret\\.oc1\\.", var.devops_source_access_token_secret_id))
    error_message = "devops_source_access_token_secret_id must be empty or a valid OCI Vault secret OCID."
  }
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

  validation {
    condition     = contains(["podman", "docker"], var.hosted_app_container_cli)
    error_message = "hosted_app_container_cli must be podman or docker."
  }
}

variable "hosted_app_ocir_region_key" {
  description = "OCIR region key used to derive repository URIs."
  type        = string
  default     = "ord"

  validation {
    condition     = can(regex("^[a-z]{3}$", var.hosted_app_ocir_region_key))
    error_message = "hosted_app_ocir_region_key must be a three-letter OCIR region key, for example ord."
  }
}

variable "portal_container_enabled" {
  description = "When true, create a public OCI Container Instance for the demo portal from the RM-owned OCIR image."
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

variable "portal_container_repository_id" {
  description = "Optional existing OCIR repository OCID for the demo portal image. Leave empty to let this stack create the repository."
  type        = string
  default     = ""

  validation {
    condition     = var.portal_container_repository_id == "" || can(regex("^ocid1\\.containerrepo\\.oc1\\.", var.portal_container_repository_id))
    error_message = "portal_container_repository_id must be empty or a valid OCI container repository OCID."
  }
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

  validation {
    condition     = var.portal_container_port >= 1024 && var.portal_container_port <= 65535
    error_message = "portal_container_port must be between 1024 and 65535."
  }
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

  validation {
    condition     = var.portal_container_ocpus >= 1 && var.portal_container_ocpus <= 4
    error_message = "portal_container_ocpus must be between 1 and 4."
  }
}

variable "portal_container_memory_gbs" {
  description = "Memory assigned to the demo portal container."
  type        = number
  default     = 4

  validation {
    condition     = var.portal_container_memory_gbs >= 1 && var.portal_container_memory_gbs <= 64
    error_message = "portal_container_memory_gbs must be between 1 and 64."
  }
}

variable "portal_vcn_cidr" {
  description = "CIDR block for the demo portal VCN."
  type        = string
  default     = "10.42.0.0/16"

  validation {
    condition     = can(cidrhost(var.portal_vcn_cidr, 1))
    error_message = "portal_vcn_cidr must be a valid IPv4 CIDR block."
  }
}

variable "portal_subnet_cidr" {
  description = "Public subnet CIDR block for the demo portal load balancer."
  type        = string
  default     = "10.42.1.0/24"

  validation {
    condition     = can(cidrhost(var.portal_subnet_cidr, 1))
    error_message = "portal_subnet_cidr must be a valid IPv4 CIDR block."
  }
}

variable "portal_private_subnet_cidr" {
  description = "Private subnet CIDR block for the demo portal container instance."
  type        = string
  default     = "10.42.2.0/24"

  validation {
    condition     = can(cidrhost(var.portal_private_subnet_cidr, 1))
    error_message = "portal_private_subnet_cidr must be a valid IPv4 CIDR block."
  }
}

variable "portal_auth_password" {
  description = "Optional fixed portal login password. Leave empty to let Terraform generate one and expose it as a sensitive output."
  type        = string
  sensitive   = true
  default     = ""
}

variable "oci_genai_project_id" {
  description = "Existing OCI Generative AI project OCID injected into the demo portal as OCI_GENAI_PROJECT_ID."
  type        = string
  default     = ""

  validation {
    condition     = var.oci_genai_project_id == "" || can(regex("^ocid1\\.generativeaiproject\\.oc1\\.", var.oci_genai_project_id))
    error_message = "oci_genai_project_id must be empty or a valid OCI Generative AI project OCID."
  }
}

variable "oci_genai_api_key" {
  description = "Existing OCI Generative AI Responses API key injected into the demo portal as OCI_GENAI_API_KEY."
  type        = string
  sensitive   = true
  default     = ""
}

variable "idcs_domain_url" {
  description = "Existing identity domain URL used for hosted application inbound OAuth authentication."
  type        = string

  validation {
    condition     = can(regex("^https://", var.idcs_domain_url))
    error_message = "idcs_domain_url must be an HTTPS URL."
  }
}

variable "idcs_audience" {
  description = "Existing identity domain OAuth audience for hosted application inbound authentication."
  type        = string
}

variable "idcs_scope" {
  description = "Existing identity domain OAuth scope for hosted application inbound authentication."
  type        = string
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
