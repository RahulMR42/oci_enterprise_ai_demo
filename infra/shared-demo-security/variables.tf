variable "tenancy_id" {
  description = "Tenancy OCID where the dynamic group is created."
  type        = string
}

variable "compartment_id" {
  description = "Compartment OCID containing Enterprise AI demo resources."
  type        = string
}

variable "region" {
  description = "OCI region for provider initialization."
  type        = string
  default     = "us-chicago-1"
}

variable "resource_suffix" {
  description = "Suffix used to group shared demo resources."
  type        = string
  default     = "000000"
}

variable "dynamic_group_name_prefix" {
  description = "Name prefix for the shared Enterprise AI demo dynamic group."
  type        = string
  default     = "enterprise-ai-demo"
}

variable "policy_name_prefix" {
  description = "Name prefix for the shared Enterprise AI demo policy."
  type        = string
  default     = "enterprise-ai-demo"
}
