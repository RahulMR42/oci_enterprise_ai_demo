locals {
  normalized_suffix  = lower(replace(var.resource_suffix, "-", ""))
  name_suffix        = substr(local.normalized_suffix, 0, 8)
  display_prefix     = "enterprise-ai-demo-${local.name_suffix}"
  dynamic_group_name = "${local.display_prefix}-rm-demo-dg"
  policy_name        = "${local.display_prefix}-rm-demo-policy"
  create_network     = var.existing_subnet_id == "" && var.create_public_network
  subnet_id          = var.existing_subnet_id != "" ? var.existing_subnet_id : one(oci_core_subnet.portal[*].id)
  ocir_namespace     = var.ocir_namespace != "" ? var.ocir_namespace : data.oci_objectstorage_namespace.portal.namespace
  portal_image_uri   = var.portal_image_uri != "" ? var.portal_image_uri : "${var.ocir_region_key}.ocir.io/${local.ocir_namespace}/${var.portal_repository_name}:${var.portal_image_tag}"

  freeform_tags = {
    "enterprise-ai-demo" = "true"
    "deployment"         = "resource-manager"
  }

  portal_environment = {
    HOST                         = "0.0.0.0"
    PORT                         = tostring(var.portal_port)
    OCI_PORTAL_PASSWORD          = var.portal_password
    OCI_GENAI_COMPARTMENT_ID     = var.compartment_id
    OCI_GENAI_REGION             = var.region
    PROVISION_INFRA              = var.provision_demo_infra ? "true" : "false"
    PROVISION_DEMOS              = join(",", var.enabled_demo_modules)
    REQUIRE_DEMO_INFRA           = var.require_demo_infra ? "true" : "false"
    LOG_CAPTURE_ENABLED          = "false"
    OCI_RESOURCE_MANAGER_PRIMARY = "true"
  }
}
