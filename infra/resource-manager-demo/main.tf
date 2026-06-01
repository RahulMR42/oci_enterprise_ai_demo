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

  compartment_id       = var.compartment_id
  region               = var.region
  profile              = var.profile
  resource_suffix      = var.resource_suffix
  oci_genai_project_id = var.oci_genai_project_id
  oci_genai_api_key    = var.oci_genai_api_key

  depends_on = [module.responses_api]
}

module "code_interpreter" {
  count  = var.code_interpreter_local_exec_enabled ? 1 : 0
  source = "../code-interpreter"

  region               = var.region
  resource_suffix      = var.resource_suffix
  oci_genai_project_id = var.oci_genai_project_id
  oci_genai_api_key    = var.oci_genai_api_key

  depends_on = [module.responses_api]
}

module "conversation_store" {
  source = "../conversation-store"
}

module "guardrails" {
  source = "../guardrails"
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
  source_revision                = var.devops_source_revision
  devops_repository_branch       = var.devops_repository_branch
  source_connection_type         = var.devops_source_connection_type
  source_connection_id           = var.devops_source_connection_id
  source_repository_id           = var.devops_source_repository_id
  create_devops_repository       = var.devops_create_repository
  devops_repository_git_username = var.devops_repository_git_username
  devops_repository_git_password = var.devops_repository_git_password
  create_github_connection       = var.devops_create_github_connection
  source_access_token_secret_id  = var.devops_source_access_token_secret_id
  ocir_region_key                = var.hosted_app_ocir_region_key
  idcs_domain_url                = var.idcs_domain_url
  idcs_audience                  = var.idcs_audience
  idcs_scope                     = var.idcs_scope
  hosted_app_idcs_client_id      = module.hosted_agentic_applications.n8n_idcs_launch_client_id
  hosted_app_idcs_client_secret  = module.hosted_agentic_applications.n8n_idcs_launch_client_secret
  oci_genai_project_id           = var.oci_genai_project_id
  oci_genai_api_key              = var.oci_genai_api_key
  n8n_basic_auth_user            = var.n8n_basic_auth_user
  n8n_basic_auth_password        = var.n8n_basic_auth_password
  openclaw_gateway_token         = var.openclaw_gateway_token
  langfuse_database_url          = try(module.hosted_agentic_applications.langfuse_database_url, "")
  langfuse_clickhouse_url        = try(module.hosted_agentic_applications.langfuse_clickhouse_url, "")
  langfuse_clickhouse_migration_url = try(
    module.hosted_agentic_applications.langfuse_clickhouse_migration_url,
    ""
  )
  langfuse_clickhouse_user         = try(module.hosted_agentic_applications.langfuse_clickhouse_user, "")
  langfuse_clickhouse_password     = try(module.hosted_agentic_applications.langfuse_clickhouse_password, "")
  langfuse_redis_connection_string = try(module.hosted_agentic_applications.langfuse_redis_connection_string, "")
  langfuse_s3_event_upload_bucket  = try(module.hosted_agentic_applications.langfuse_s3_event_upload_bucket, "")
  langfuse_s3_media_upload_bucket  = try(module.hosted_agentic_applications.langfuse_s3_media_upload_bucket, "")
  langfuse_s3_upload_region        = try(module.hosted_agentic_applications.langfuse_s3_upload_region, "")
  langfuse_s3_upload_endpoint      = try(module.hosted_agentic_applications.langfuse_s3_upload_endpoint, "")
  langfuse_nextauth_secret         = try(module.hosted_agentic_applications.langfuse_nextauth_secret, "")
  langfuse_salt                    = try(module.hosted_agentic_applications.langfuse_salt, "")
  langfuse_encryption_key          = try(module.hosted_agentic_applications.langfuse_encryption_key, "")
  langfuse_networking_config_json  = try(module.hosted_agentic_applications.langfuse_networking_config_json, "")
  portal_container_repository_id = (
    var.portal_container_repository_id != ""
    ? var.portal_container_repository_id
    : try(oci_artifacts_container_repository.portal[0].id, "")
  )
  portal_private_subnet_id               = try(oci_core_subnet.portal_private[0].id, "")
  portal_network_security_group_id       = try(oci_core_network_security_group.portal[0].id, "")
  portal_load_balancer_id                = try(oci_load_balancer_load_balancer.portal[0].id, "")
  portal_backend_set_name                = try(oci_load_balancer_backend_set.portal[0].name, "")
  portal_public_url                      = local.portal_url
  portal_container_port                  = var.portal_container_port
  portal_container_shape                 = var.portal_container_shape
  portal_container_ocpus                 = var.portal_container_ocpus
  portal_container_memory_gbs            = var.portal_container_memory_gbs
  portal_auth_password                   = local.portal_auth_password
  portal_runtime_config_json             = jsonencode(local.portal_rollout_runtime_config)
  portal_run_history_object              = oci_objectstorage_object.portal_run_history[0].object
  shared_policy_id                       = module.shared_demo_security.policy_id
  run_build                              = var.devops_hosted_image_run_build
  deploy_only_app                        = var.deploy_only_app
  app_deploy                             = var.app_deploy
  deploy_hosted_agent_hosted_application = var.oci_ha_hosted_agent_deploy
  deploy_langgraph_hosted_application    = var.oci_ha_langgraph_deploy
  deploy_langfuse_hosted_application     = var.oci_ha_langfuse_deploy
  deploy_openclaw_hosted_application     = var.oci_ha_openclaw_deploy
  deploy_llamaindex_hosted_application   = var.oci_ha_llamaindex_deploy
}

module "hosted_agentic_applications" {
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
  hosted_image_build_run_id       = ""
  hosted_cli_deployments_enabled  = var.hosted_applications_local_exec_enabled
}
