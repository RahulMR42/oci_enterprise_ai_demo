resource "terraform_data" "openclaw_hosted_agent_gateway" {
  count = var.hosted_cli_deployments_enabled ? 1 : 0

  input = {
    provisioning_revision           = "20260522-openclaw-hosted-gateway-demo-ui"
    compartment_id                  = var.compartment_id
    region                          = var.region
    profile                         = var.profile
    ocir_region_key                 = var.ocir_region_key
    container_cli                   = var.container_cli
    repository_name                 = local.openclaw_repository_name
    openclaw_image_repository_uri   = var.openclaw_image_repository_uri
    image_tag                       = "latest"
    hosted_image_build_run_id       = var.hosted_image_build_run_id
    push_image                      = var.push_image
    app_source_dir                  = abspath("${path.module}/${var.openclaw_app_source_dir}")
    generated_dir                   = "${path.module}/.terraform/generated"
    hosted_application_display_name = local.openclaw_application_display_name
    hosted_deployment_display_name  = local.openclaw_deployment_display_name
    idcs_domain_url                 = var.idcs_domain_url
    idcs_audience                   = var.idcs_audience
    idcs_scope                      = var.idcs_scope
    scaling_type                    = "REQUESTS_PER_SECOND"
  }

  triggers_replace = [
    "20260522-openclaw-hosted-gateway-demo-ui",
    abspath("${path.module}/${var.openclaw_app_source_dir}"),
    local.openclaw_repository_name,
    var.openclaw_image_repository_uri,
    "latest",
    local.openclaw_application_display_name,
    local.openclaw_deployment_display_name,
    var.idcs_domain_url,
    var.idcs_audience,
    var.idcs_scope,
    var.hosted_image_build_run_id,
  ]

  provisioner "local-exec" {
    command = "/bin/sh ${path.module}/scripts/deploy_oc_hosted.sh"

    environment = {
      APP_SOURCE_ROOT         = abspath("${path.module}/../../apps")
      COMPARTMENT_ID          = self.input.compartment_id
      CONTAINER_CLI           = self.input.container_cli
      DEMO_TAG                = "openclaw-hosted-agent-gateway"
      GENERATED_DIR           = self.input.generated_dir
      HOSTED_APPLICATION_FILE = "openclaw_hosted_application.json"
      HOSTED_DEPLOYMENT_FILE  = "openclaw_hosted_deployment.json"
      HOSTED_GATEWAY_FILE     = "openclaw_hosted_gateway.json"
      IDCS_AUDIENCE           = self.input.idcs_audience
      IDCS_DOMAIN_URL         = self.input.idcs_domain_url
      IDCS_SCOPE              = self.input.idcs_scope
      IMAGE_TAG               = self.input.image_tag
      OCIR_REPOSITORY_FILE    = "openclaw_ocir_repository.json"
      OCIR_REGION_KEY         = self.input.ocir_region_key
      OCI_CLI_PROFILE         = self.input.profile
      OCI_CLI_REGION          = self.input.region
      PUSH_IMAGE              = tostring(self.input.push_image)
      RESOURCE_SUFFIX         = var.resource_suffix
      USE_PUBLIC_BASE         = tostring(var.openclaw_image_repository_uri != "")
    }
  }
}
