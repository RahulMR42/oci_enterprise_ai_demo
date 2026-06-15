locals {
  repository_name                     = "${var.repository_name}-${var.resource_suffix}"
  langgraph_repository_name           = "${var.langgraph_repository_name}-${var.resource_suffix}"
  openclaw_repository_name            = "${var.openclaw_repository_name}-${var.resource_suffix}"
  llamaindex_repository_name          = "${var.llamaindex_repository_name}-${var.resource_suffix}"
  hosted_application_display_name     = "${var.hosted_application_display_name}-${var.resource_suffix}"
  hosted_deployment_display_name      = "${var.hosted_deployment_display_name}-${var.resource_suffix}"
  langgraph_application_display_name  = "${var.langgraph_hosted_application_display_name}-${var.resource_suffix}"
  langgraph_deployment_display_name   = "${var.langgraph_hosted_deployment_display_name}-${var.resource_suffix}"
  openclaw_application_display_name   = "${var.openclaw_hosted_application_display_name}-${var.resource_suffix}"
  openclaw_deployment_display_name    = "${var.openclaw_hosted_deployment_display_name}-${var.resource_suffix}"
  llamaindex_application_display_name = "${var.llamaindex_hosted_application_display_name}-${var.resource_suffix}"
  llamaindex_deployment_display_name  = "${var.llamaindex_hosted_deployment_display_name}-${var.resource_suffix}"
  hosted_app_idcs_domain_url          = var.hosted_app_idcs_domain_url != "" ? var.hosted_app_idcs_domain_url : var.idcs_domain_url
  hosted_app_idcs_audience            = var.hosted_app_idcs_audience != "" ? var.hosted_app_idcs_audience : var.idcs_audience
  hosted_app_idcs_scope               = var.hosted_app_idcs_scope != "" ? var.hosted_app_idcs_scope : var.idcs_scope
  hosted_app_idcs_scope_fqs           = startswith(local.hosted_app_idcs_scope, "http") ? local.hosted_app_idcs_scope : "${trimsuffix(local.hosted_app_idcs_audience, "/")}/${trim(local.hosted_app_idcs_scope, "/")}"
  hosted_app_idcs_client_display_name = "${var.hosted_app_idcs_client_display_name}-${var.resource_suffix}"
  hosted_app_idcs_client_name         = "enterprise-ai-demo-hosted-launch-${var.resource_suffix}"
  hosted_app_idcs_redirect_uris       = distinct(compact(var.hosted_app_idcs_redirect_uris))
  hosted_app_idcs_allowed_grants      = length(local.hosted_app_idcs_redirect_uris) > 0 ? ["client_credentials", "authorization_code"] : ["client_credentials"]
  generated_dir                       = "${path.module}/.terraform/generated"
}
