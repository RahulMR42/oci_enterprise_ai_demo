variable "compartment_id" {
  description = "OCID of the compartment where the Resource Manager stack deploys the portal."
  type        = string

  validation {
    condition     = can(regex("^ocid1\\.compartment\\.", var.compartment_id))
    error_message = "compartment_id must be a valid compartment OCID."
  }
}

variable "tenancy_id" {
  description = "Tenancy OCID used for optional stack-managed dynamic group creation."
  type        = string

  validation {
    condition     = can(regex("^ocid1\\.tenancy\\.", var.tenancy_id))
    error_message = "tenancy_id must be a valid tenancy OCID."
  }
}

variable "region" {
  description = "OCI region for the Resource Manager deployment and portal runtime."
  type        = string
  default     = "us-chicago-1"
}

variable "resource_suffix" {
  description = "Short suffix used to group Resource Manager stack resources."
  type        = string
  default     = "rm001"

  validation {
    condition     = can(regex("^[a-zA-Z0-9-]{3,16}$", var.resource_suffix))
    error_message = "resource_suffix must be 3 to 16 letters, numbers, or hyphens."
  }
}

variable "portal_image_uri" {
  description = "Prebuilt private portal image URI in OCIR, for example ord.ocir.io/<namespace>/enterprise-ai-demo/portal:latest."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]+\\.ocir\\.io/.+:.+$", var.portal_image_uri))
    error_message = "portal_image_uri must be a tagged OCIR image URI."
  }
}

variable "ocir_registry_endpoint" {
  description = "OCIR registry endpoint used by the private portal image, for example ord.ocir.io."
  type        = string
  default     = "ord.ocir.io"
}

variable "ocir_pull_secret_id" {
  description = "Optional Vault secret OCID containing Docker registry credentials for pulling the private OCIR image."
  type        = string
  default     = ""
  sensitive   = true

  validation {
    condition     = var.ocir_pull_secret_id == "" || can(regex("^ocid1\\.vaultsecret\\.", var.ocir_pull_secret_id))
    error_message = "ocir_pull_secret_id must be empty or a valid Vault secret OCID."
  }
}

variable "portal_password" {
  description = "Password for the portal login user oci."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.portal_password) >= 12
    error_message = "portal_password must be at least 12 characters."
  }
}

variable "portal_port" {
  description = "Portal HTTP port exposed by the container."
  type        = number
  default     = 5173

  validation {
    condition     = var.portal_port > 0 && var.portal_port < 65536
    error_message = "portal_port must be between 1 and 65535."
  }
}

variable "existing_subnet_id" {
  description = "Optional existing subnet OCID. Leave empty to let the stack create a public demo VCN and subnet."
  type        = string
  default     = ""

  validation {
    condition     = var.existing_subnet_id == "" || can(regex("^ocid1\\.subnet\\.", var.existing_subnet_id))
    error_message = "existing_subnet_id must be empty or a valid subnet OCID."
  }
}

variable "create_public_network" {
  description = "When true and existing_subnet_id is empty, create a public VCN, internet gateway, route table, security list, and subnet."
  type        = bool
  default     = true
}

variable "vcn_cidr" {
  description = "CIDR block for the optional public demo VCN."
  type        = string
  default     = "10.71.0.0/16"
}

variable "subnet_cidr" {
  description = "CIDR block for the optional public demo subnet."
  type        = string
  default     = "10.71.1.0/24"
}

variable "allowed_ingress_cidr" {
  description = "CIDR allowed to reach the portal port. Use a restricted office/VPN range for non-demo deployments."
  type        = string
  default     = "0.0.0.0/0"
}

variable "container_shape" {
  description = "OCI Container Instances shape for the portal."
  type        = string
  default     = "CI.Standard.E4.Flex"
}

variable "container_ocpus" {
  description = "OCPUs assigned to the portal container instance."
  type        = number
  default     = 1
}

variable "container_memory_gbs" {
  description = "Memory in GB assigned to the portal container."
  type        = number
  default     = 6
}

variable "provision_demo_infra" {
  description = "When true, the portal runtime attempts to provision selected demo infrastructure on startup."
  type        = bool
  default     = false
}

variable "enabled_demo_modules" {
  description = "Comma-compatible list of demo modules passed to the portal runtime when provision_demo_infra is true."
  type        = list(string)
  default     = ["responses-api"]
}

variable "require_demo_infra" {
  description = "When true, portal startup fails if selected demo infrastructure provisioning fails."
  type        = bool
  default     = false
}

variable "enable_demo_policies" {
  description = "When true, create IAM policies that let stack-created resources access demo services, private OCIR repositories, Vault secrets, and Object Storage in the same compartment."
  type        = bool
  default     = true
}
