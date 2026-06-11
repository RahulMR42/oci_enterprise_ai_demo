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

output "langfuse_database_url" {
  description = "DATABASE_URL used by the Langfuse hosted deployment."
  value       = local.langfuse_effective_database_url
  sensitive   = true
}

output "langfuse_clickhouse_migration_url" {
  description = "ClickHouse migration endpoint used by the Langfuse hosted deployment."
  value       = local.langfuse_effective_clickhouse_migration_url
  sensitive   = true
}

output "langfuse_clickhouse_user" {
  description = "ClickHouse user used by the Langfuse hosted deployment."
  value       = local.langfuse_effective_clickhouse_user
}

output "langfuse_clickhouse_password" {
  description = "ClickHouse password used by the Langfuse hosted deployment."
  value       = local.langfuse_effective_clickhouse_password
  sensitive   = true
}

output "langfuse_redis_connection_string" {
  description = "Redis connection string used by the Langfuse hosted deployment."
  value       = local.langfuse_effective_redis_connection_string
  sensitive   = true
}

output "langfuse_s3_event_upload_bucket" {
  description = "Event upload bucket used by the Langfuse hosted deployment."
  value       = local.langfuse_effective_s3_event_upload_bucket
}

output "langfuse_s3_media_upload_bucket" {
  description = "Media upload bucket used by the Langfuse hosted deployment."
  value       = local.langfuse_effective_s3_media_upload_bucket
}

output "langfuse_s3_upload_region" {
  description = "Object Storage upload region used by the Langfuse hosted deployment."
  value       = local.langfuse_effective_s3_upload_region
}

output "langfuse_s3_upload_endpoint" {
  description = "Object Storage upload endpoint used by the Langfuse hosted deployment."
  value       = local.langfuse_effective_s3_upload_endpoint
}

output "langfuse_nextauth_secret" {
  description = "NEXTAUTH_SECRET used by the Langfuse hosted deployment."
  value       = local.langfuse_effective_nextauth_secret
  sensitive   = true
}

output "langfuse_salt" {
  description = "SALT used by the Langfuse hosted deployment."
  value       = local.langfuse_effective_salt
  sensitive   = true
}

output "langfuse_encryption_key" {
  description = "ENCRYPTION_KEY used by the Langfuse hosted deployment."
  value       = local.langfuse_effective_encryption_key
  sensitive   = true
}

output "langfuse_networking_config_json" {
  description = "Hosted application private networking configuration used by Langfuse."
  value       = local.langfuse_hosted_networking_config_json
}
