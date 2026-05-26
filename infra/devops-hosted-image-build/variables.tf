variable "compartment_id" {
  description = "Compartment OCID for OCI DevOps, OCIR, and the build run."
  type        = string
}

variable "region" {
  description = "OCI region."
  type        = string
  default     = "us-chicago-1"
}

variable "resource_suffix" {
  description = "Six-character suffix used to group demo resources."
  type        = string
}

variable "enabled" {
  description = "When true, create and run the OCI DevOps build pipeline that builds hosted demo images."
  type        = bool
  default     = true
}

variable "source_repo_url" {
  description = "Git repository URL containing this demo source and the DevOps build spec."
  type        = string
}

variable "source_branch" {
  description = "Upstream Git branch Resource Manager clones before seeding the OCI DevOps code repository."
  type        = string
  default     = "main"
}

variable "devops_repository_branch" {
  description = "Branch name used inside the OCI DevOps hosted code repository and build source."
  type        = string
  default     = "main"
}

variable "source_connection_type" {
  description = "Build source connection type. Use GITHUB for GitHub or DEVOPS_CODE_REPOSITORY for an OCI Code Repository."
  type        = string
  default     = "GITHUB"
}

variable "source_connection_id" {
  description = "Existing OCI DevOps connection OCID. Required for GitHub/GitLab/Bitbucket sources unless create_github_connection is true."
  type        = string
  default     = ""
}

variable "source_repository_id" {
  description = "OCI DevOps code repository OCID. Required when source_connection_type is DEVOPS_CODE_REPOSITORY."
  type        = string
  default     = ""
}

variable "create_devops_repository" {
  description = "When true, create an OCI DevOps code repository and seed it from source_repo_url before running the build."
  type        = bool
  default     = true
}

variable "devops_repository_git_username" {
  description = "Git username used by Resource Manager to push the cloned source into the OCI DevOps code repository."
  type        = string
  default     = ""
}

variable "devops_repository_git_password" {
  description = "Git password or auth token used by Resource Manager to push the cloned source into the OCI DevOps code repository."
  type        = string
  sensitive   = true
  default     = ""
}

variable "create_github_connection" {
  description = "When true, create an OCI DevOps GitHub connection from source_access_token_secret_id."
  type        = bool
  default     = false
}

variable "source_access_token_secret_id" {
  description = "OCI Vault secret OCID containing the GitHub personal access token for the DevOps connection."
  type        = string
  default     = ""
}

variable "ocir_region_key" {
  description = "OCIR region key, for example ord for us-chicago-1."
  type        = string
  default     = "ord"
}

variable "image_tag" {
  description = "Container image tag pushed by the DevOps build."
  type        = string
  default     = "latest"
}

variable "ocir_username" {
  description = "OCIR username used by the DevOps build to push images."
  type        = string
  default     = ""
}

variable "ocir_auth_token" {
  description = "OCIR auth token used by the DevOps build to push images."
  type        = string
  sensitive   = true
  default     = ""
}

variable "run_build" {
  description = "When true, Resource Manager starts a DevOps build run during apply."
  type        = bool
  default     = true
}
