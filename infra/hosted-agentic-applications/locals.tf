locals {
  repository_name                    = "${var.repository_name}-${var.resource_suffix}"
  langgraph_repository_name          = "${var.langgraph_repository_name}-${var.resource_suffix}"
  n8n_repository_name                = "${var.n8n_repository_name}-${var.resource_suffix}"
  langfuse_repository_name           = "${var.langfuse_repository_name}-${var.resource_suffix}"
  openclaw_repository_name           = "${var.openclaw_repository_name}-${var.resource_suffix}"
  hosted_application_display_name    = "${var.hosted_application_display_name}-${var.resource_suffix}"
  hosted_deployment_display_name     = "${var.hosted_deployment_display_name}-${var.resource_suffix}"
  langgraph_application_display_name = "${var.langgraph_hosted_application_display_name}-${var.resource_suffix}"
  langgraph_deployment_display_name  = "${var.langgraph_hosted_deployment_display_name}-${var.resource_suffix}"
  n8n_application_display_name       = "${var.n8n_hosted_application_display_name}-${var.resource_suffix}"
  n8n_deployment_display_name        = "${var.n8n_hosted_deployment_display_name}-${var.resource_suffix}"
  langfuse_application_display_name  = "${var.langfuse_hosted_application_display_name}-${var.resource_suffix}"
  langfuse_deployment_display_name   = "${var.langfuse_hosted_deployment_display_name}-${var.resource_suffix}"
  openclaw_application_display_name  = "${var.openclaw_hosted_application_display_name}-${var.resource_suffix}"
  openclaw_deployment_display_name   = "${var.openclaw_hosted_deployment_display_name}-${var.resource_suffix}"
  n8n_idcs_domain_url                = var.n8n_idcs_domain_url != "" ? var.n8n_idcs_domain_url : var.idcs_domain_url
  n8n_idcs_audience                  = var.n8n_idcs_audience != "" ? var.n8n_idcs_audience : var.idcs_audience
  n8n_idcs_scope                     = var.n8n_idcs_scope != "" ? var.n8n_idcs_scope : var.idcs_scope
  n8n_idcs_scope_fqs                 = startswith(local.n8n_idcs_scope, "http") ? local.n8n_idcs_scope : "${trimsuffix(local.n8n_idcs_audience, "/")}/${trim(local.n8n_idcs_scope, "/")}"
  n8n_idcs_client_display_name       = "${var.n8n_idcs_client_display_name}-${var.resource_suffix}"
  n8n_idcs_client_name               = "enterprise-ai-demo-n8n-launch-${var.resource_suffix}"
  n8n_idcs_redirect_uris             = distinct(compact(var.n8n_idcs_redirect_uris))
  n8n_idcs_allowed_grants            = length(local.n8n_idcs_redirect_uris) > 0 ? ["client_credentials", "authorization_code"] : ["client_credentials"]
  generated_dir                      = "${path.module}/.terraform/generated"
}
