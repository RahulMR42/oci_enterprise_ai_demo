locals {
  responses_api_base_url = "https://inference.generativeai.${var.region}.oci.oraclecloud.com/openai/v1"
  responses_api_model    = "openai.gpt-oss-120b"
  docs_url               = "https://docs.oracle.com/en-us/iaas/Content/generative-ai/responses-api.htm"
  deployment_requirement = "All OCI resources required by this demo must be added to this Terraform module before runtime code depends on them."
  resource_suffix        = terraform_data.resource_suffix.input.resource_suffix
  project_display_name   = "${var.project_display_name}-${local.resource_suffix}"
}
