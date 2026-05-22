locals {
  normalized_suffix                 = replace(var.resource_suffix, "-", "")
  autonomous_database_display_name  = "${var.autonomous_database_display_name}-${var.resource_suffix}"
  autonomous_database_db_name       = upper(substr("${var.autonomous_database_db_name}${local.normalized_suffix}", 0, 14))
  create_managed_secret             = var.database_password_secret_id == ""
  database_password_secret_id       = var.database_password_secret_id != "" ? var.database_password_secret_id : oci_vault_secret.sql_search_admin_password[0].id
  create_database_tools_connections = true
}
