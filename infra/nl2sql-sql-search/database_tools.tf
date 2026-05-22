locals {
  sql_search_connection_string = try(
    oci_database_autonomous_database.sql_search.connection_strings[0].profiles[0].value,
    oci_database_autonomous_database.sql_search.connection_strings[0].all_connection_strings.low,
    ""
  )
}

resource "oci_database_tools_database_tools_connection" "enrichment" {
  count = local.create_database_tools_connections ? 1 : 0

  compartment_id    = var.compartment_id
  connection_string = local.sql_search_connection_string
  display_name      = "enterprise-ai-demo-sql-enrichment-${var.resource_suffix}"
  type              = "ORACLE_DATABASE"
  user_name         = var.database_user_name

  user_password {
    secret_id  = local.database_password_secret_id
    value_type = "SECRETID"
  }

  freeform_tags = {
    demo       = "enterprise-ai-demo"
    capability = "nl2sql-enrichment"
  }
}

resource "oci_database_tools_database_tools_connection" "query" {
  count = local.create_database_tools_connections ? 1 : 0

  compartment_id    = var.compartment_id
  connection_string = local.sql_search_connection_string
  display_name      = "enterprise-ai-demo-sql-query-${var.resource_suffix}"
  type              = "ORACLE_DATABASE"
  user_name         = var.database_user_name

  user_password {
    secret_id  = local.database_password_secret_id
    value_type = "SECRETID"
  }

  freeform_tags = {
    demo       = "enterprise-ai-demo"
    capability = "nl2sql-query"
  }
}
