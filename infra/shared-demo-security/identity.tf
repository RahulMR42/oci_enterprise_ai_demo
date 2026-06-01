resource "oci_identity_dynamic_group" "enterprise_ai_demo" {
  compartment_id = var.tenancy_id
  name           = local.dynamic_group_name
  description    = "Enterprise AI demo shared dynamic group for resources in ${var.compartment_id}."
  matching_rule  = "ALL {resource.compartment.id = '${var.compartment_id}'}"
}

resource "oci_identity_policy" "enterprise_ai_demo" {
  compartment_id = var.compartment_id
  name           = local.policy_name
  description    = "Enterprise AI demo shared resource policy for ${local.dynamic_group_name}."
  statements = [
    "allow dynamic-group ${oci_identity_dynamic_group.enterprise_ai_demo.name} to manage generative-ai-family in compartment id ${var.compartment_id}",
    "allow dynamic-group ${oci_identity_dynamic_group.enterprise_ai_demo.name} to manage autonomous-database-family in compartment id ${var.compartment_id}",
    "allow dynamic-group ${oci_identity_dynamic_group.enterprise_ai_demo.name} to manage database-tools-family in compartment id ${var.compartment_id}",
    "allow dynamic-group ${oci_identity_dynamic_group.enterprise_ai_demo.name} to read secret-family in compartment id ${var.compartment_id}",
    "allow dynamic-group ${oci_identity_dynamic_group.enterprise_ai_demo.name} to manage object-family in compartment id ${var.compartment_id}",
    "allow dynamic-group ${oci_identity_dynamic_group.enterprise_ai_demo.name} to manage repos in compartment id ${var.compartment_id}",
    "allow dynamic-group ${oci_identity_dynamic_group.enterprise_ai_demo.name} to manage compute-container-family in compartment id ${var.compartment_id}",
    "allow dynamic-group ${oci_identity_dynamic_group.enterprise_ai_demo.name} to use virtual-network-family in compartment id ${var.compartment_id}",
    "allow dynamic-group ${oci_identity_dynamic_group.enterprise_ai_demo.name} to manage load-balancers in compartment id ${var.compartment_id}"
  ]
}
