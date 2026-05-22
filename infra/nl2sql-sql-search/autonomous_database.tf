resource "oci_database_autonomous_database" "sql_search" {
  admin_password           = random_password.sql_search_admin.result
  compartment_id           = var.compartment_id
  compute_count            = var.compute_count
  compute_model            = "ECPU"
  data_storage_size_in_tbs = var.data_storage_size_in_tbs
  db_name                  = local.autonomous_database_db_name
  db_workload              = "OLTP"
  display_name             = local.autonomous_database_display_name
  is_auto_scaling_enabled  = true
  license_model            = "LICENSE_INCLUDED"

  freeform_tags = {
    demo       = "enterprise-ai-demo"
    capability = "nl2sql-sql-search"
  }
}
