module "responses_api" {
  count  = var.responses_api_local_exec_enabled ? 1 : 0
  source = "../responses-api"

  compartment_id       = var.compartment_id
  region               = var.region
  profile              = var.profile
  project_display_name = var.project_display_name
  resource_suffix      = var.resource_suffix
}

module "shared_demo_security" {
  source = "../shared-demo-security"

  tenancy_id      = var.tenancy_id
  compartment_id  = var.compartment_id
  region          = var.region
  resource_suffix = var.resource_suffix
}

module "file_search_vector_store_rag" {
  count  = var.file_search_local_exec_enabled ? 1 : 0
  source = "../file-search-vector-store-rag"

  compartment_id  = var.compartment_id
  region          = var.region
  profile         = var.profile
  resource_suffix = var.resource_suffix

  depends_on = [module.responses_api]
}

module "code_interpreter" {
  count  = var.code_interpreter_local_exec_enabled ? 1 : 0
  source = "../code-interpreter"

  region          = var.region
  resource_suffix = var.resource_suffix

  depends_on = [module.responses_api]
}

module "nl2sql_sql_search" {
  source = "../nl2sql-sql-search"

  compartment_id  = var.compartment_id
  region          = var.region
  resource_suffix = var.resource_suffix
}

module "devops_hosted_image_build" {
  source = "../devops-hosted-image-build"

  enabled                        = var.devops_hosted_image_build_enabled
  compartment_id                 = var.compartment_id
  region                         = var.region
  resource_suffix                = var.resource_suffix
  source_repo_url                = var.devops_source_repo_url
  source_branch                  = var.devops_source_branch
  source_connection_type         = var.devops_source_connection_type
  source_connection_id           = var.devops_source_connection_id
  source_repository_id           = var.devops_source_repository_id
  create_devops_repository       = var.devops_create_repository
  devops_repository_git_username = var.devops_repository_git_username
  devops_repository_git_password = var.devops_repository_git_password
  create_github_connection       = var.devops_create_github_connection
  source_access_token_secret_id  = var.devops_source_access_token_secret_id
  ocir_region_key                = var.hosted_app_ocir_region_key
  ocir_username                  = var.devops_ocir_username
  ocir_auth_token                = var.devops_ocir_auth_token
  run_build                      = var.devops_hosted_image_run_build
}

module "hosted_agentic_applications" {
  count  = var.hosted_applications_local_exec_enabled ? 1 : 0
  source = "../hosted-agentic-applications"

  compartment_id                  = var.compartment_id
  region                          = var.region
  profile                         = var.profile
  resource_suffix                 = var.resource_suffix
  container_cli                   = var.hosted_app_container_cli
  ocir_region_key                 = var.hosted_app_ocir_region_key
  push_image                      = var.hosted_app_push_image
  idcs_domain_url                 = var.idcs_domain_url
  idcs_audience                   = var.idcs_audience
  idcs_scope                      = var.idcs_scope
  n8n_basic_auth_user             = var.n8n_basic_auth_user
  n8n_basic_auth_password         = var.n8n_basic_auth_password
  n8n_image_repository_uri        = var.n8n_image_repository_uri
  langfuse_image_repository_uri   = var.langfuse_image_repository_uri
  openclaw_image_repository_uri   = var.openclaw_image_repository_uri
  llamaindex_image_repository_uri = var.llamaindex_image_repository_uri
  openclaw_gateway_token          = var.openclaw_gateway_token
  hosted_image_build_run_id       = module.devops_hosted_image_build.build_run_id
}
