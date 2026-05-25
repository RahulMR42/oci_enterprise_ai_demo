data "oci_identity_availability_domains" "portal" {
  compartment_id = var.compartment_id
}

resource "oci_container_instances_container_instance" "portal" {
  availability_domain = data.oci_identity_availability_domains.portal.availability_domains[0].name
  compartment_id      = var.compartment_id
  display_name        = "${local.display_prefix}-portal"
  shape               = var.container_shape
  freeform_tags       = local.freeform_tags

  shape_config {
    ocpus = var.container_ocpus
  }

  vnics {
    display_name           = "${local.display_prefix}-portal-vnic"
    hostname_label         = "portal"
    is_public_ip_assigned  = true
    subnet_id              = local.subnet_id
    skip_source_dest_check = false
  }

  containers {
    display_name          = "enterprise-ai-demo-portal"
    image_url             = local.portal_image_uri
    environment_variables = local.portal_environment

    resource_config {
      memory_limit_in_gbs = var.container_memory_gbs
      vcpus_limit         = var.container_ocpus
    }
  }
}

data "oci_core_vnic" "portal" {
  vnic_id = oci_container_instances_container_instance.portal.vnics[0].vnic_id
}
