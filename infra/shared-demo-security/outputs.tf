output "dynamic_group_id" {
  description = "OCID of the shared Enterprise AI demo dynamic group."
  value       = oci_identity_dynamic_group.enterprise_ai_demo.id
}

output "dynamic_group_name" {
  description = "Name of the shared Enterprise AI demo dynamic group."
  value       = oci_identity_dynamic_group.enterprise_ai_demo.name
}

output "policy_id" {
  description = "OCID of the shared Enterprise AI demo policy."
  value       = oci_identity_policy.enterprise_ai_demo.id
}
