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

output "langfuse_container_repository_name" {
  description = "OCIR repository name for the Langfuse hosted observability image."
  value       = module.hosted_agentic_applications.langfuse_container_repository_name
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
  description = "OCI Container Instance OCID for the demo portal. DevOps creates and rotates this resource during rollout, so Terraform does not own a stable value."
  value       = ""
}

output "portal_container_image_uri" {
  description = "OCIR image URI used by the demo portal container instance."
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

output "portal_public_ip" {
  description = "Public IP address assigned to the demo portal load balancer."
  value       = var.portal_container_enabled ? oci_load_balancer_load_balancer.portal[0].ip_address_details[0].ip_address : ""
}

output "portal_url" {
  description = "Public URL for the demo portal load balancer."
  value       = local.portal_url
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

output "portal_conversation_id" {
  description = "OCI Conversations API conversation ID injected into the demo portal."
  value       = var.portal_container_enabled ? local.portal_conversation_id : ""
}

output "portal_code_interpreter_container_id" {
  description = "Code Interpreter container ID injected into the demo portal."
  value       = var.portal_container_enabled ? local.portal_code_interpreter_container_id : ""
}

output "langfuse_postgres_private_endpoint" {
  description = "Private PostgreSQL endpoint used by the Langfuse hosted deployment."
  value       = try(module.hosted_agentic_applications.langfuse_postgres_private_endpoint, "")
}

output "langfuse_clickhouse_url" {
  description = "Private ClickHouse HTTP endpoint used by the Langfuse hosted deployment."
  value       = try(module.hosted_agentic_applications.langfuse_clickhouse_url, "")
}

output "langfuse_redis_endpoint" {
  description = "Private Redis endpoint used by the Langfuse hosted deployment."
  value       = try(module.hosted_agentic_applications.langfuse_redis_endpoint, "")
}

output "langfuse_object_storage_bucket" {
  description = "OCI Object Storage bucket used by the Langfuse hosted deployment."
  value       = try(module.hosted_agentic_applications.langfuse_object_storage_bucket, "")
}

output "langfuse_networking_config_json" {
  description = "Hosted application private networking configuration used by Langfuse."
  value       = try(module.hosted_agentic_applications.langfuse_networking_config_json, "")
}

output "portal_runtime_note" {
  description = "How the local portal consumes Resource Manager-created runtime metadata."
  value       = "Resource Manager creates the stable portal load balancer and runtime config. OCI DevOps rolls portal container instances behind the load balancer and runs smoke tests before switching traffic."
}
