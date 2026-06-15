output "hosted_agent_generated_file" {
  description = "Generated hosted application/deployment metadata."
  value       = "${path.module}/.terraform/generated/hosted_agent.json"
}

output "container_repository_name" {
  description = "OCIR repository name used by the hosted agent image."
  value       = local.repository_name
}

output "langgraph_container_repository_name" {
  description = "OCIR repository name used by the LangGraph hosted agent image."
  value       = local.langgraph_repository_name
}

output "hosted_application_display_name" {
  description = "OCI Generative AI hosted application display name."
  value       = local.hosted_application_display_name
}

output "hosted_deployment_display_name" {
  description = "OCI Generative AI hosted deployment display name."
  value       = local.hosted_deployment_display_name
}

output "langgraph_hosted_agent_generated_file" {
  description = "Generated LangGraph hosted application/deployment metadata."
  value       = "${path.module}/.terraform/generated/langgraph_hosted_agent.json"
}

output "langgraph_hosted_application_display_name" {
  description = "LangGraph OCI Generative AI hosted application display name."
  value       = local.langgraph_application_display_name
}

output "langgraph_hosted_deployment_display_name" {
  description = "LangGraph OCI Generative AI hosted deployment display name."
  value       = local.langgraph_deployment_display_name
}

output "hosted_app_idcs_launch_client_generated_file" {
  description = "Generated hosted UI launch IDCS client metadata."
  value       = "${path.module}/.terraform/generated/hosted_app_idcs_client.json"
}

output "hosted_app_idcs_launch_client_id" {
  description = "Client ID for the Terraform-managed hosted UI launch confidential app."
  value       = var.hosted_app_idcs_launch_client_enabled ? local.hosted_app_idcs_client_name : ""
}

output "hosted_app_idcs_launch_client_app_id" {
  description = "Identity Domains app OCID for the Terraform-managed hosted UI launch confidential app."
  value       = var.hosted_app_idcs_launch_client_enabled ? oci_identity_domains_app.hosted_app_launch_client[0].id : ""
}

output "hosted_app_idcs_launch_client_secret" {
  description = "Client secret for the Terraform-managed hosted UI launch confidential app."
  value       = var.hosted_app_idcs_launch_client_enabled ? oci_identity_domains_app.hosted_app_launch_client[0].client_secret : ""
  sensitive   = true
}

output "openclaw_hosted_gateway_generated_file" {
  description = "Generated OpenClaw hosted agent gateway application/deployment metadata."
  value       = "${path.module}/.terraform/generated/openclaw_hosted_gateway.json"
}

output "openclaw_container_repository_name" {
  description = "OCIR repository name used by the OpenClaw hosted agent gateway image."
  value       = local.openclaw_repository_name
}

output "openclaw_hosted_application_display_name" {
  description = "OpenClaw OCI Generative AI hosted application display name."
  value       = local.openclaw_application_display_name
}

output "openclaw_hosted_deployment_display_name" {
  description = "OpenClaw OCI Generative AI hosted deployment display name."
  value       = local.openclaw_deployment_display_name
}

output "llamaindex_control_tower_generated_file" {
  description = "Generated LlamaIndex control tower hosted application/deployment metadata."
  value       = "${path.module}/.terraform/generated/llamaindex_control_tower.json"
}

output "llamaindex_container_repository_name" {
  description = "OCIR repository name used by the LlamaIndex control tower image."
  value       = local.llamaindex_repository_name
}

output "llamaindex_hosted_application_display_name" {
  description = "LlamaIndex OCI Generative AI hosted application display name."
  value       = local.llamaindex_application_display_name
}

output "llamaindex_hosted_deployment_display_name" {
  description = "LlamaIndex OCI Generative AI hosted deployment display name."
  value       = local.llamaindex_deployment_display_name
}
