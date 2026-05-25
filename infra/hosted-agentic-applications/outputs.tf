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

output "langfuse_hosted_observability_generated_file" {
  description = "Generated Langfuse hosted observability application/deployment metadata."
  value       = "${path.module}/.terraform/generated/langfuse_hosted_observability.json"
}

output "langfuse_container_repository_name" {
  description = "OCIR repository name used by the Langfuse hosted observability image."
  value       = local.langfuse_repository_name
}

output "langfuse_hosted_application_display_name" {
  description = "Langfuse OCI Generative AI hosted application display name."
  value       = local.langfuse_application_display_name
}

output "langfuse_hosted_deployment_display_name" {
  description = "Langfuse OCI Generative AI hosted deployment display name."
  value       = local.langfuse_deployment_display_name
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

output "langfuse_postgres_private_endpoint" {
  description = "Private PostgreSQL endpoint used by the Langfuse hosted deployment."
  value       = "${data.oci_psql_db_system_connection_detail.langfuse.primary_db_endpoint[0].ip_address}:${data.oci_psql_db_system_connection_detail.langfuse.primary_db_endpoint[0].port}"
}

output "langfuse_clickhouse_url" {
  description = "Private ClickHouse HTTP endpoint used by the Langfuse hosted deployment."
  value       = local.langfuse_managed_clickhouse_url
}

output "langfuse_redis_endpoint" {
  description = "Private Redis endpoint used by the Langfuse hosted deployment."
  value       = "${local.langfuse_redis_private_ip}:6379"
}

output "langfuse_object_storage_bucket" {
  description = "OCI Object Storage bucket used by the Langfuse hosted deployment."
  value       = oci_objectstorage_bucket.langfuse.name
}
