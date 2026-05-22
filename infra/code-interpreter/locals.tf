locals {
  openai_base_url        = "https://inference.generativeai.${var.region}.oci.oraclecloud.com/openai/v1"
  container_display_name = "${var.container_display_name}-${var.resource_suffix}"
}
