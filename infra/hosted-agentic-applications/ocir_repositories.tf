resource "oci_artifacts_container_repository" "hosted_agent" {
  compartment_id = var.compartment_id
  display_name   = local.repository_name
  is_public      = false
}

resource "oci_artifacts_container_repository" "langgraph" {
  compartment_id = var.compartment_id
  display_name   = local.langgraph_repository_name
  is_public      = false
}

resource "oci_artifacts_container_repository" "openclaw" {
  count = var.openclaw_image_repository_uri == "" ? 1 : 0

  compartment_id = var.compartment_id
  display_name   = local.openclaw_repository_name
  is_public      = false
}

resource "oci_artifacts_container_repository" "llamaindex" {
  count = var.llamaindex_image_repository_uri == "" ? 1 : 0

  compartment_id = var.compartment_id
  display_name   = local.llamaindex_repository_name
  is_public      = false
}
