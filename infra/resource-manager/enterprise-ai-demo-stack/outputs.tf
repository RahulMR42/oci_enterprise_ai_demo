output "portal_public_ip" {
  description = "Public IP assigned to the portal container instance VNIC."
  value       = data.oci_core_vnic.portal.public_ip_address
}

output "portal_url" {
  description = "HTTP URL for the deployed portal."
  value       = format("http://%s:%d", data.oci_core_vnic.portal.public_ip_address, var.portal_port)
}

output "container_instance_id" {
  description = "OCID of the portal container instance."
  value       = oci_container_instances_container_instance.portal.id
}

output "subnet_id" {
  description = "Subnet used by the portal container instance."
  value       = local.subnet_id
}

output "portal_image_uri" {
  description = "Portal image deployed by the Resource Manager stack."
  value       = local.portal_image_uri
}

output "enabled_demo_modules" {
  description = "Demo modules passed to the portal runtime."
  value       = var.enabled_demo_modules
}

output "demo_dynamic_group_name" {
  description = "Dynamic group created for Resource Manager demo resources when enable_demo_policies is true."
  value       = var.enable_demo_policies ? oci_identity_dynamic_group.resource_manager_demo[0].name : ""
}

output "demo_policy_name" {
  description = "IAM policy created for Resource Manager demo resources when enable_demo_policies is true."
  value       = var.enable_demo_policies ? oci_identity_policy.resource_manager_demo[0].name : ""
}
