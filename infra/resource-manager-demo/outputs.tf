output "resource_suffix" {
  description = "Suffix used to group all demo resources in this Resource Manager stack."
  value       = var.resource_suffix
}

output "responses_api_project_display_name" {
  description = "Shared OCI Generative AI project display name."
  value       = var.responses_api_local_exec_enabled ? module.responses_api[0].project_display_name : "${var.project_display_name}-${var.resource_suffix}"
}

output "hosted_agent_container_repository_name" {
  description = "OCIR repository name for the hosted agent image."
  value       = var.hosted_applications_local_exec_enabled ? module.hosted_agentic_applications[0].container_repository_name : "enterprise-ai-demo/hosted-agent-${var.resource_suffix}"
}

output "langgraph_container_repository_name" {
  description = "OCIR repository name for the LangGraph hosted agent image."
  value       = var.hosted_applications_local_exec_enabled ? module.hosted_agentic_applications[0].langgraph_container_repository_name : "enterprise-ai-demo/hosted-langgraph-agent-${var.resource_suffix}"
}

output "n8n_container_repository_name" {
  description = "OCIR repository name for the n8n hosted workflow image."
  value       = var.hosted_applications_local_exec_enabled ? module.hosted_agentic_applications[0].n8n_container_repository_name : "enterprise-ai-demo/hosted-n8n-${var.resource_suffix}"
}

output "langfuse_container_repository_name" {
  description = "OCIR repository name for the Langfuse hosted observability image."
  value       = var.hosted_applications_local_exec_enabled ? module.hosted_agentic_applications[0].langfuse_container_repository_name : "enterprise-ai-demo/hosted-langfuse-${var.resource_suffix}"
}

output "openclaw_container_repository_name" {
  description = "OCIR repository name for the OpenClaw hosted gateway image."
  value       = var.hosted_applications_local_exec_enabled ? module.hosted_agentic_applications[0].openclaw_container_repository_name : "enterprise-ai-demo/hosted-openclaw-${var.resource_suffix}"
}

output "llamaindex_container_repository_name" {
  description = "OCIR repository name for the LlamaIndex control tower image."
  value       = var.hosted_applications_local_exec_enabled ? module.hosted_agentic_applications[0].llamaindex_container_repository_name : "enterprise-ai-demo/hosted-llamaindex-control-tower-${var.resource_suffix}"
}

output "devops_hosted_image_build_pipeline_id" {
  description = "OCI DevOps build pipeline used to build hosted app images."
  value       = module.devops_hosted_image_build.build_pipeline_id
}

output "devops_hosted_image_build_run_id" {
  description = "OCI DevOps build run started by Resource Manager for hosted app images."
  value       = module.devops_hosted_image_build.build_run_id
}

output "devops_source_repository_id" {
  description = "OCI DevOps source repository used by the hosted image build."
  value       = module.devops_hosted_image_build.source_repository_id
}

output "devops_hosted_image_repository_uris" {
  description = "OCIR image repository URIs pushed by the DevOps hosted image build."
  value       = module.devops_hosted_image_build.image_repository_uris
}

output "devops_hosted_deployment_exports" {
  description = "Hosted app/deployment metadata exported by the DevOps build run."
  value       = module.devops_hosted_image_build.hosted_deployment_exports
}

output "portal_container_instance_id" {
  description = "OCI Container Instance OCID for the demo portal."
  value       = var.portal_container_enabled ? oci_container_instances_container_instance.portal[0].id : ""
}

output "portal_container_image_uri" {
  description = "OCIR image URI used by the demo portal container instance."
  value       = var.portal_container_enabled ? local.portal_container_image_uri : ""
}

output "portal_public_ip" {
  description = "Public IP address assigned to the demo portal container instance."
  value       = var.portal_container_enabled ? data.oci_core_vnic.portal[0].public_ip_address : ""
}

output "portal_url" {
  description = "Public URL for the demo portal container instance."
  value       = var.portal_container_enabled ? "http://${data.oci_core_vnic.portal[0].public_ip_address}:${var.portal_container_port}" : ""
}

output "portal_login_user" {
  description = "Demo portal login username."
  value       = var.portal_container_enabled ? "oci" : ""
}

output "portal_login_password" {
  description = "Demo portal login password."
  value       = var.portal_container_enabled ? local.portal_auth_password : ""
  sensitive   = true
}

output "portal_vector_store_id" {
  description = "File Search vector store ID injected into the demo portal."
  value       = var.portal_container_enabled ? local.portal_vector_store_id : ""
}

output "portal_code_interpreter_container_id" {
  description = "Code Interpreter container ID injected into the demo portal."
  value       = var.portal_container_enabled ? local.portal_code_interpreter_container_id : ""
}

output "portal_runtime_note" {
  description = "How the local portal consumes Resource Manager-created runtime metadata."
  value       = "The portal reads generated runtime JSON from each Terraform module path after apply. Download Resource Manager job logs/generated files or refresh local metadata before launching the local Node portal."
}
