output "oci_genai_region" {
  description = "Export as OCI_GENAI_REGION for the backend Responses API call."
  value       = var.region
}

output "oci_genai_project_id" {
  description = "Project ID must be copied from OCI CLI/Terraform apply logs after project creation."
  value       = "copy-from-provisioning-logs"
}

output "oci_profile" {
  description = "OCI profile used for provisioning."
  value       = var.profile
}

output "oci_responses_api_base_url" {
  description = "OCI OpenAI-compatible base URL used by the Responses API demo."
  value       = local.responses_api_base_url
}

output "oci_responses_api_model" {
  description = "Only model used by the Responses API demo."
  value       = local.responses_api_model
}

output "resource_suffix" {
  description = "Suffix used to group resources created for this demo."
  value       = local.resource_suffix
}

output "project_display_name" {
  description = "Generated project display name with stable Terraform-managed suffix."
  value       = local.project_display_name
}

output "api_key_display_name" {
  description = "Generated API key display name with stable Terraform-managed suffix."
  value       = terraform_data.generative_ai_api_key.input.api_key_display_name
}

output "oci_responses_api_docs_url" {
  description = "Oracle documentation for the OCI Responses API."
  value       = local.docs_url
}

output "deployment_requirement" {
  description = "Infrastructure ownership rule for this demo."
  value       = local.deployment_requirement
}
