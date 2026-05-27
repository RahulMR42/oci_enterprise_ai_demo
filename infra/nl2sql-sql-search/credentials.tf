resource "random_password" "sql_search_admin" {
  length           = 24
  min_lower        = 2
  min_numeric      = 2
  min_special      = 2
  min_upper        = 2
  override_special = "#_-"
}

resource "oci_kms_vault" "sql_search" {
  count = local.create_managed_secret ? 1 : 0

  compartment_id = var.compartment_id
  display_name   = "enterprise-ai-demo-sql-vault-${var.resource_suffix}"
  vault_type     = "DEFAULT"

  freeform_tags = {
    demo       = "enterprise-ai-demo"
    capability = "nl2sql-sql-search"
  }
}

resource "time_sleep" "sql_search_vault_dns" {
  count = local.create_managed_secret ? 1 : 0

  create_duration = "120s"
  depends_on      = [oci_kms_vault.sql_search]
}

resource "oci_kms_key" "sql_search" {
  count = local.create_managed_secret ? 1 : 0

  compartment_id      = var.compartment_id
  display_name        = "enterprise-ai-demo-sql-key-${var.resource_suffix}"
  management_endpoint = oci_kms_vault.sql_search[0].management_endpoint
  depends_on          = [time_sleep.sql_search_vault_dns]

  key_shape {
    algorithm = "AES"
    length    = 32
  }

  freeform_tags = {
    demo       = "enterprise-ai-demo"
    capability = "nl2sql-sql-search"
  }
}

resource "oci_vault_secret" "sql_search_admin_password" {
  count = local.create_managed_secret ? 1 : 0

  compartment_id = var.compartment_id
  key_id         = oci_kms_key.sql_search[0].id
  secret_name    = "enterprise-ai-demo-sql-password-${var.resource_suffix}"
  vault_id       = oci_kms_vault.sql_search[0].id

  secret_content {
    content_type = "BASE64"
    content      = base64encode(random_password.sql_search_admin.result)
  }

  freeform_tags = {
    demo       = "enterprise-ai-demo"
    capability = "nl2sql-sql-search"
  }
}
