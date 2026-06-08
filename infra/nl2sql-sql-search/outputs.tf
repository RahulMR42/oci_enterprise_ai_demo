output "autonomous_database_id" {
  description = "Autonomous Database OCID for the NL2SQL/SQL Search demo."
  value       = oci_database_autonomous_database.sql_search.id
}

output "autonomous_database_name" {
  description = "Autonomous Database name."
  value       = oci_database_autonomous_database.sql_search.db_name
}

output "autonomous_database_connection_string" {
  description = "TLS connection string for the NL2SQL Autonomous Database reused by the portal auth store."
  value       = local.sql_search_connection_string
}

output "database_user_name" {
  description = "Database user name for Database Tools and portal auth store access."
  value       = var.database_user_name
}

output "database_tools_enrichment_connection_id" {
  description = "Database Tools enrichment connection OCID."
  value       = local.create_database_tools_connections ? oci_database_tools_database_tools_connection.enrichment[0].id : ""
}

output "database_tools_query_connection_id" {
  description = "Database Tools query connection OCID."
  value       = local.create_database_tools_connections ? oci_database_tools_database_tools_connection.query[0].id : ""
}

output "database_password_secret_id" {
  description = "Vault secret OCID containing the generated or externally supplied database password."
  value       = local.database_password_secret_id
  sensitive   = true
}

output "managed_vault_id" {
  description = "Managed Vault OCID when this module creates the DB password secret."
  value       = local.create_managed_secret ? oci_kms_vault.sql_search[0].id : ""
}

output "managed_key_id" {
  description = "Managed KMS key OCID when this module creates the DB password secret."
  value       = local.create_managed_secret ? oci_kms_key.sql_search[0].id : ""
}

output "semantic_store_note" {
  description = "Next step for NL2SQL."
  value       = "Create the OCI Generative AI Semantic Store using the enrichment/query Database Tools connection IDs after apply. Terraform provider support for Semantic Store should replace this note when available in this workspace."
}
