resource "oci_identity_dynamic_group" "resource_manager_demo" {
  count          = var.enable_demo_policies ? 1 : 0
  compartment_id = var.tenancy_id
  name           = local.dynamic_group_name
  description    = "Enterprise AI Resource Manager demo dynamic group for resources in ${var.compartment_id}."
  matching_rule  = "ALL {resource.compartment.id = '${var.compartment_id}'}"
}

resource "oci_identity_policy" "resource_manager_demo" {
  count          = var.enable_demo_policies ? 1 : 0
  compartment_id = var.compartment_id
  name           = local.policy_name
  description    = "Enterprise AI Resource Manager demo policy for ${local.dynamic_group_name}."
  statements = [
    "allow dynamic-group ${oci_identity_dynamic_group.resource_manager_demo[0].name} to manage generative-ai-family in compartment id ${var.compartment_id}",
    "allow dynamic-group ${oci_identity_dynamic_group.resource_manager_demo[0].name} to manage autonomous-database-family in compartment id ${var.compartment_id}",
    "allow dynamic-group ${oci_identity_dynamic_group.resource_manager_demo[0].name} to manage database-tools-family in compartment id ${var.compartment_id}",
    "allow dynamic-group ${oci_identity_dynamic_group.resource_manager_demo[0].name} to read secret-family in compartment id ${var.compartment_id}",
    "allow dynamic-group ${oci_identity_dynamic_group.resource_manager_demo[0].name} to read secret-bundles in compartment id ${var.compartment_id}",
    "allow dynamic-group ${oci_identity_dynamic_group.resource_manager_demo[0].name} to read repos in compartment id ${var.compartment_id}",
    "allow dynamic-group ${oci_identity_dynamic_group.resource_manager_demo[0].name} to manage object-family in compartment id ${var.compartment_id}"
  ]
}
