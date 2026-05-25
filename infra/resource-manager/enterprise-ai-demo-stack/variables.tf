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
  description = "Optional prebuilt private portal image URI in OCIR. Leave empty to derive it from OCIR inputs."
  type        = string
  default     = ""

  validation {
    condition     = var.portal_image_uri == "" || can(regex("^[a-z0-9-]+\\.ocir\\.io/.+:.+$", var.portal_image_uri))
    error_message = "portal_image_uri must be empty or a tagged OCIR image URI."
  }
}

variable "ocir_region_key" {
  description = "OCIR region key used in the private portal image URI. For us-chicago-1 this is ord."
  type        = string
  default     = "ord"
}

variable "ocir_namespace" {
  description = "Optional OCIR namespace. Leave empty to read the namespace from Object Storage."
  type        = string
  default     = ""
}

variable "portal_repository_name" {
  description = "Private OCIR repository path for the portal image."
  type        = string
  default     = "enterprise-ai-demo/portal-rm"
}

variable "portal_image_tag" {
  description = "Portal image tag used when portal_image_uri is not supplied."
  type        = string
  default     = "latest"
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
  description = "When true, create IAM policies that let stack-created resources access demo services, private OCIR repositories, Vault secret bundles, and Object Storage in the same compartment."
  type        = bool
  default     = true
}
