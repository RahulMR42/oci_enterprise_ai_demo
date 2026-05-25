output "portal_public_ip" {
  description = "Public IP assigned to the portal container instance VNIC."
  value       = try(oci_container_instances_container_instance.portal.vnics[0].public_ip, "")
}

output "portal_url" {
  description = "HTTP URL for the deployed portal."
  value       = format("http://%s:%d", try(oci_container_instances_container_instance.portal.vnics[0].public_ip, ""), var.portal_port)
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
  value       = var.portal_image_uri
}

output "enabled_demo_modules" {
  description = "Demo modules passed to the portal runtime."
  value       = var.enabled_demo_modules
}
