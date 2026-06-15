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
  value       = module.hosted_agentic_applications.container_repository_name
}

output "langgraph_container_repository_name" {
  description = "OCIR repository name for the LangGraph hosted agent image."
  value       = module.hosted_agentic_applications.langgraph_container_repository_name
}

output "openclaw_container_repository_name" {
  description = "OCIR repository name for the OpenClaw hosted gateway image."
  value       = module.hosted_agentic_applications.openclaw_container_repository_name
}

output "llamaindex_container_repository_name" {
  description = "OCIR repository name for the LlamaIndex control tower image."
  value       = module.hosted_agentic_applications.llamaindex_container_repository_name
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
  description = "Deprecated. The demo portal now runs as an OCI Generative AI hosted application, so Terraform does not own a portal container instance."
  value       = ""
}

output "portal_container_image_uri" {
  description = "OCIR image URI used by the demo portal hosted application."
  value       = var.portal_container_enabled ? local.portal_container_image_uri : ""
}

output "portal_container_repository_id" {
  description = "OCIR repository OCID used by the demo portal image."
  value = var.portal_container_enabled ? (
    var.portal_container_repository_id != ""
    ? var.portal_container_repository_id
    : try(oci_artifacts_container_repository.portal[0].id, "")
  ) : ""
}

output "portal_auth_database_id" {
  description = "NL2SQL Autonomous Database reused by the portal protected-user auth store."
  value       = module.nl2sql_sql_search.autonomous_database_id
}

output "portal_auth_database_name" {
  description = "NL2SQL Autonomous Database name reused by the portal protected-user auth store."
  value       = module.nl2sql_sql_search.autonomous_database_name
}

output "portal_runtime_config_bucket" {
  description = "Object Storage bucket holding non-sensitive portal runtime config and run summaries."
  value       = var.portal_container_enabled ? oci_objectstorage_bucket.portal_config[0].name : ""
}

output "portal_runtime_config_object" {
  description = "Object name for non-sensitive portal runtime config."
  value       = var.portal_container_enabled ? oci_objectstorage_object.portal_runtime_config[0].object : ""
}

output "portal_run_history_object" {
  description = "Object name for portal demo run history and count summaries."
  value       = var.portal_container_enabled ? oci_objectstorage_object.portal_run_history[0].object : ""
}

output "portal_change_log_object" {
  description = "Object name for the portal administration change log."
  value       = var.portal_container_enabled ? oci_objectstorage_object.portal_change_log[0].object : ""
}

output "portal_public_ip" {
  description = "Deprecated. The portal hosted application uses the OCI Generative AI invoke URL instead of a Terraform-owned load balancer IP."
  value       = ""
}

output "portal_url" {
  description = "Invoke URL for the demo portal OCI Generative AI hosted application."
  value       = local.portal_url
}

output "portal_login_user" {
  description = "Demo portal login username."
  value       = var.portal_container_enabled ? "oci" : ""
}

output "portal_login_password" {
  description = "Deprecated. The portal login password is not emitted by Terraform; use portal_login_password_secret_id to locate it in OCI Vault."
  value       = ""
  sensitive   = true
}

output "portal_login_password_secret_id" {
  description = "OCI Vault secret OCID containing the demo portal login password."
  value       = var.portal_container_enabled ? var.portal_auth_password_secret_id : ""
  sensitive   = true
}

output "portal_vector_store_id" {
  description = "File Search vector store ID injected into the demo portal."
  value       = var.portal_container_enabled ? local.portal_vector_store_id : ""
}

output "portal_conversation_id" {
  description = "OCI Conversations API conversation ID injected into the demo portal."
  value       = var.portal_container_enabled ? local.portal_conversation_id : ""
}

output "portal_code_interpreter_container_id" {
  description = "Code Interpreter container ID injected into the demo portal."
  value       = var.portal_container_enabled ? local.portal_code_interpreter_container_id : ""
}

output "portal_runtime_note" {
  description = "How the local portal consumes Resource Manager-created runtime metadata."
  value       = "Resource Manager creates the portal image repository and runtime config. OCI DevOps creates or updates the no-auth portal OCI Generative AI hosted application, promotes the latest image artifact, and runs smoke tests against the hosted invoke URL."
}
