data "oci_objectstorage_namespace" "this" {
  count = var.enabled ? 1 : 0
}

locals {
  build_openclaw_gateway_token = var.openclaw_gateway_token != "" ? var.openclaw_gateway_token : sha256("${var.resource_suffix}-openclaw-gateway-token")
  build_langfuse_database_url  = var.langfuse_database_url != "" ? var.langfuse_database_url : "postgresql://unused:unused@127.0.0.1:5432/unused"
  build_langfuse_clickhouse_url = (
    var.langfuse_clickhouse_url != "" ? var.langfuse_clickhouse_url : "http://127.0.0.1:8123"
  )
  build_langfuse_clickhouse_migration_url = (
    var.langfuse_clickhouse_migration_url != "" ? var.langfuse_clickhouse_migration_url : "clickhouse://127.0.0.1:9000"
  )
  build_langfuse_clickhouse_user         = var.langfuse_clickhouse_user != "" ? var.langfuse_clickhouse_user : "clickhouse"
  build_langfuse_clickhouse_password     = var.langfuse_clickhouse_password != "" ? var.langfuse_clickhouse_password : sha256("${var.resource_suffix}-langfuse-clickhouse")
  build_langfuse_redis_connection_string = var.langfuse_redis_connection_string != "" ? var.langfuse_redis_connection_string : "redis://127.0.0.1:6379"
  build_langfuse_s3_event_upload_bucket  = var.langfuse_s3_event_upload_bucket != "" ? var.langfuse_s3_event_upload_bucket : "unused-${var.resource_suffix}"
  build_langfuse_s3_media_upload_bucket  = var.langfuse_s3_media_upload_bucket != "" ? var.langfuse_s3_media_upload_bucket : "unused-${var.resource_suffix}"
  build_langfuse_s3_upload_region        = var.langfuse_s3_upload_region != "" ? var.langfuse_s3_upload_region : var.region
  build_langfuse_s3_upload_endpoint      = var.langfuse_s3_upload_endpoint != "" ? var.langfuse_s3_upload_endpoint : "https://objectstorage.${var.region}.oraclecloud.com"
  build_langfuse_nextauth_secret         = var.langfuse_nextauth_secret != "" ? var.langfuse_nextauth_secret : sha256("${var.resource_suffix}-langfuse-nextauth")
  build_langfuse_salt                    = var.langfuse_salt != "" ? var.langfuse_salt : sha256("${var.resource_suffix}-langfuse-salt")
  build_langfuse_encryption_key          = var.langfuse_encryption_key != "" ? var.langfuse_encryption_key : sha256("${var.resource_suffix}-langfuse-encryption")
  build_langfuse_networking_config_json  = var.langfuse_networking_config_json != "" ? var.langfuse_networking_config_json : "{}"
}

resource "oci_devops_project" "this" {
  count = var.enabled ? 1 : 0

  compartment_id = var.compartment_id
  name           = local.project_name
  description    = "Enterprise AI demo DevOps project for hosted image builds."

  notification_config {
    topic_id = oci_ons_notification_topic.this[0].topic_id
  }

  freeform_tags = {
    enterprise-ai-demo = "true"
    managed-by         = "resource-manager"
  }
}

resource "oci_ons_notification_topic" "this" {
  count = var.enabled ? 1 : 0

  compartment_id = var.compartment_id
  name           = "enterprise-ai-demo-devops-${var.resource_suffix}"
  description    = "Notifications for Enterprise AI demo hosted image build pipeline."
}

resource "oci_logging_log_group" "devops" {
  count = var.enabled ? 1 : 0

  compartment_id = var.compartment_id
  display_name   = "enterprise-ai-demo-devops-${var.resource_suffix}"
  description    = "Service logs for Enterprise AI demo DevOps build runs."

  freeform_tags = {
    enterprise-ai-demo = "true"
    managed-by         = "resource-manager"
  }
}

resource "oci_logging_log" "devops" {
  count = var.enabled ? 1 : 0

  display_name = "enterprise-ai-demo-devops-${var.resource_suffix}"
  log_group_id = oci_logging_log_group.devops[0].id
  log_type     = "SERVICE"
  is_enabled   = true

  configuration {
    compartment_id = var.compartment_id

    source {
      category    = "all"
      resource    = oci_devops_project.this[0].id
      service     = "devops"
      source_type = "OCISERVICE"
    }
  }
}

resource "oci_devops_connection" "github" {
  count = var.enabled && var.create_github_connection ? 1 : 0

  project_id      = oci_devops_project.this[0].id
  connection_type = "GITHUB_ACCESS_TOKEN"
  display_name    = "enterprise-ai-demo-github-${var.resource_suffix}"
  access_token    = var.source_access_token_secret_id
  description     = "GitHub connection for Enterprise AI demo hosted image builds."
}

resource "oci_devops_repository" "source" {
  count = var.enabled && var.create_devops_repository ? 1 : 0

  project_id      = oci_devops_project.this[0].id
  name            = "enterprise-ai-demo-source-${var.resource_suffix}"
  repository_type = "HOSTED"
  default_branch  = var.devops_repository_branch
  description     = "Resource Manager-seeded source repository for Enterprise AI demo hosted image builds."
}

resource "terraform_data" "seed_devops_repository" {
  count = var.enabled && var.create_devops_repository ? 1 : 0

  triggers_replace = [
    var.source_repo_url,
    var.source_branch,
    var.source_revision,
    local.source_package_revision,
    var.devops_repository_branch,
    oci_devops_repository.source[0].id
  ]

  input = {
    devops_repository_http_url = oci_devops_repository.source[0].http_url
    devops_repository_branch   = var.devops_repository_branch
    source_branch              = var.source_branch
    source_package_revision    = local.source_package_revision
    source_revision            = var.source_revision
    source_repo_url            = var.source_repo_url
    username                   = var.devops_repository_git_username
  }

  provisioner "local-exec" {
    environment = {
      DEVOPS_GIT_PASSWORD = var.devops_repository_git_password
    }

    command = <<-EOT
      set -euo pipefail
      if [ -z '${self.input.username}' ] || [ -z "$${DEVOPS_GIT_PASSWORD:-}" ]; then
        echo "devops_repository_git_username and devops_repository_git_password are required to seed the OCI DevOps code repository." >&2
        exit 1
      fi

      work_dir="$(mktemp -d)"
      trap 'rm -rf "$work_dir"' EXIT
      git clone --branch '${self.input.source_branch}' '${self.input.source_repo_url}' "$work_dir/source"
      cd "$work_dir/source"
      git config user.email "resource-manager@example.invalid"
      git config user.name "OCI Resource Manager"

      target_url="$(python3 - <<PY
from urllib.parse import quote, urlsplit, urlunsplit
url = urlsplit("${self.input.devops_repository_http_url}")
username = quote("${self.input.username}", safe="")
password = quote("$${DEVOPS_GIT_PASSWORD}", safe="")
print(urlunsplit((url.scheme, f"{username}:{password}@{url.netloc}", url.path, url.query, url.fragment)))
PY
      )"
      git push "$target_url" "HEAD:refs/heads/${self.input.devops_repository_branch}" --force
    EOT
  }
}

resource "oci_devops_build_pipeline" "this" {
  count = var.enabled ? 1 : 0

  project_id   = oci_devops_project.this[0].id
  display_name = "enterprise-ai-demo-hosted-images-${var.resource_suffix}"
  description  = "Builds and pushes Enterprise AI demo application images to OCIR."

  build_pipeline_parameters {
    items {
      name          = "RESOURCE_SUFFIX"
      default_value = var.resource_suffix
      description   = "Resource suffix used by the image repository names."
    }
    items {
      name          = "OCI_REGION"
      default_value = var.region
      description   = "OCI region used by OCI CLI calls in the build."
    }
    items {
      name          = "COMPARTMENT_ID"
      default_value = var.compartment_id
      description   = "Compartment OCID for hosted app deployment."
    }
    items {
      name          = "OCIR_REGION_KEY"
      default_value = var.ocir_region_key
      description   = "OCIR region key used for image repository URIs."
    }
    items {
      name          = "OCIR_NAMESPACE"
      default_value = data.oci_objectstorage_namespace.this[0].namespace
      description   = "OCIR namespace used for image repository URIs."
    }
    items {
      name          = "IMAGE_TAG"
      default_value = var.image_tag
      description   = "Image tag to build and push."
    }
    items {
      name          = "SOURCE_REVISION"
      default_value = var.source_revision
      description   = "Source revision marker used to correlate Resource Manager applies and DevOps build runs."
    }
    items {
      name          = "DEPLOY_ONLY_APP"
      default_value = local.deploy_only_app_pipeline_value
      description   = "When true, hosted app deployment stages are skipped and only the portal app container redeploys."
    }
    items {
      name          = "OCI_HA_LANGFUSE_DEPLOY"
      default_value = var.deploy_langfuse_hosted_application ? "true" : "false"
      description   = "When true, deploy the Langfuse hosted application stage."
    }
    items {
      name          = "APP_DEPLOY"
      default_value = local.app_deploy_pipeline_value
      description   = "Hosted application deployment selector. Set to all to deploy every hosted application."
    }
    items {
      name          = "OCI_HA_HOSTED_AGENT_DEPLOY"
      default_value = var.deploy_hosted_agent_hosted_application ? "true" : "false"
      description   = "When true, deploy the hosted-agent hosted application stage."
    }
    items {
      name          = "OCI_HA_LANGGRAPH_DEPLOY"
      default_value = var.deploy_langgraph_hosted_application ? "true" : "false"
      description   = "When true, deploy the LangGraph hosted application stage."
    }
    items {
      name          = "OCI_HA_OPENCLAW_DEPLOY"
      default_value = var.deploy_openclaw_hosted_application ? "true" : "false"
      description   = "When true, deploy the OpenClaw hosted application stage."
    }
    items {
      name          = "OCI_HA_LLAMAINDEX_DEPLOY"
      default_value = var.deploy_llamaindex_hosted_application ? "true" : "false"
      description   = "When true, deploy the LlamaIndex hosted application stage."
    }
    items {
      name          = "PORTAL_CONTAINER_REPOSITORY_ID"
      default_value = var.portal_container_repository_id
      description   = "Portal OCIR repository dependency marker."
    }
    items {
      name          = "PORTAL_PRIVATE_SUBNET_ID"
      default_value = var.portal_private_subnet_id
      description   = "Private subnet used by the rolling portal deployment stage."
    }
    items {
      name          = "PORTAL_NETWORK_SECURITY_GROUP_ID"
      default_value = var.portal_network_security_group_id
      description   = "NSG assigned to rolling portal container instances."
    }
    items {
      name          = "PORTAL_LOAD_BALANCER_ID"
      default_value = var.portal_load_balancer_id
      description   = "Load balancer updated by the rolling portal deployment stage."
    }
    items {
      name          = "PORTAL_BACKEND_SET_NAME"
      default_value = var.portal_backend_set_name
      description   = "Load balancer backend set updated by the rolling portal deployment stage."
    }
    items {
      name          = "SHARED_POLICY_ID"
      default_value = var.shared_policy_id
      description   = "Shared IAM policy dependency marker."
    }
    items {
      name          = "IDCS_DOMAIN_URL"
      default_value = var.idcs_domain_url
      description   = "Identity domain URL used by hosted app inbound auth."
    }
    items {
      name          = "IDCS_AUDIENCE"
      default_value = var.idcs_audience
      description   = "Identity domain OAuth audience used by hosted app inbound auth."
    }
    items {
      name          = "IDCS_SCOPE"
      default_value = var.idcs_scope
      description   = "Identity domain OAuth scope used by hosted app inbound auth."
    }
    items {
      name          = "OCI_HOSTED_APP_IDCS_CLIENT_ID"
      default_value = var.hosted_app_idcs_client_id
      description   = "Identity domain OAuth client id used by portal hosted UI launch proxy."
    }
    items {
      name          = "LANGFUSE_CLICKHOUSE_USER"
      default_value = var.langfuse_clickhouse_user
      description   = "ClickHouse user used by hosted Langfuse."
    }
  }
}

resource "oci_devops_build_pipeline_stage" "build" {
  count = var.enabled && !local.effective_deploy_only_app ? 1 : 0

  build_pipeline_id                  = oci_devops_build_pipeline.this[0].id
  build_pipeline_stage_type          = "BUILD"
  display_name                       = "build-hosted-images"
  description                        = "Builds demo container images without pushing them."
  build_spec_file                    = "infra/devops-hosted-image-build/build_spec_images.yaml"
  image                              = "OL8_X86_64_STANDARD_10"
  primary_build_source               = "enterprise-ai-demo"
  is_pass_all_parameters_enabled     = true
  stage_execution_timeout_in_seconds = 7200

  build_pipeline_stage_predecessor_collection {
    items {
      id = oci_devops_build_pipeline.this[0].id
    }
  }

  build_runner_shape_config {
    build_runner_type = "CUSTOM"
    ocpus             = 2
    memory_in_gbs     = 16
  }

  build_source_collection {
    items {
      name            = "enterprise-ai-demo"
      connection_type = var.create_devops_repository ? "DEVOPS_CODE_REPOSITORY" : var.source_connection_type
      connection_id   = var.create_github_connection ? oci_devops_connection.github[0].id : (var.source_connection_id != "" ? var.source_connection_id : null)
      repository_id   = var.create_devops_repository ? oci_devops_repository.source[0].id : (var.source_repository_id != "" ? var.source_repository_id : null)
      repository_url  = var.create_devops_repository ? oci_devops_repository.source[0].http_url : (var.source_repo_url != "" ? var.source_repo_url : null)
      branch          = var.create_devops_repository ? var.devops_repository_branch : var.source_branch
    }
  }

  depends_on = [terraform_data.seed_devops_repository]
}

resource "oci_devops_build_pipeline_stage" "build_image" {
  for_each = var.enabled ? local.selected_image_artifacts : {}

  build_pipeline_id                  = oci_devops_build_pipeline.this[0].id
  build_pipeline_stage_type          = "BUILD"
  display_name                       = "build-${each.value.display_name}-image"
  description                        = "Builds the Enterprise AI demo ${each.value.display_name} container image without pushing it."
  build_spec_file                    = each.value.build_spec_file
  image                              = "OL8_X86_64_STANDARD_10"
  primary_build_source               = "enterprise-ai-demo"
  is_pass_all_parameters_enabled     = true
  stage_execution_timeout_in_seconds = 7200

  build_pipeline_stage_predecessor_collection {
    items {
      id = oci_devops_build_pipeline.this[0].id
    }
  }

  build_runner_shape_config {
    build_runner_type = "CUSTOM"
    ocpus             = 2
    memory_in_gbs     = 16
  }

  build_source_collection {
    items {
      name            = "enterprise-ai-demo"
      connection_type = var.create_devops_repository ? "DEVOPS_CODE_REPOSITORY" : var.source_connection_type
      connection_id   = var.create_github_connection ? oci_devops_connection.github[0].id : (var.source_connection_id != "" ? var.source_connection_id : null)
      repository_id   = var.create_devops_repository ? oci_devops_repository.source[0].id : (var.source_repository_id != "" ? var.source_repository_id : null)
      repository_url  = var.create_devops_repository ? oci_devops_repository.source[0].http_url : (var.source_repo_url != "" ? var.source_repo_url : null)
      branch          = var.create_devops_repository ? var.devops_repository_branch : var.source_branch
    }
  }

  depends_on = [terraform_data.seed_devops_repository]
}

resource "oci_devops_deploy_artifact" "image" {
  for_each = var.enabled ? local.selected_image_artifacts : {}

  project_id                 = oci_devops_project.this[0].id
  display_name               = "enterprise-ai-demo-${each.value.display_name}-${var.resource_suffix}"
  deploy_artifact_type       = "DOCKER_IMAGE"
  argument_substitution_mode = "NONE"
  description                = "OCIR image artifact for Enterprise AI demo ${each.value.display_name}."

  deploy_artifact_source {
    deploy_artifact_source_type = "OCIR"
    image_uri                   = "${var.ocir_region_key}.ocir.io/${data.oci_objectstorage_namespace.this[0].namespace}/${local.repositories[each.key]}:${var.image_tag}"
  }
}

resource "oci_devops_build_pipeline_stage" "deliver_image" {
  for_each = var.enabled ? local.selected_image_artifacts : {}

  build_pipeline_id                  = oci_devops_build_pipeline.this[0].id
  build_pipeline_stage_type          = "DELIVER_ARTIFACT"
  display_name                       = "deliver-${each.value.display_name}-image"
  description                        = "Delivers the ${each.value.display_name} image artifact to OCIR."
  stage_execution_timeout_in_seconds = 3600

  build_pipeline_stage_predecessor_collection {
    items {
      id = oci_devops_build_pipeline_stage.build_image[each.key].id
    }
  }

  deliver_artifact_collection {
    items {
      artifact_id   = oci_devops_deploy_artifact.image[each.key].id
      artifact_name = each.value.artifact_name
    }
  }
}

resource "oci_devops_build_pipeline_stage" "deploy_hosted" {
  for_each = var.enabled ? local.hosted_application_deployments : {}

  build_pipeline_id                  = oci_devops_build_pipeline.this[0].id
  build_pipeline_stage_type          = "BUILD"
  display_name                       = each.value.stage_name
  description                        = "Creates the OCI Generative AI hosted application and deployment for ${each.value.display_name}."
  build_spec_file                    = each.value.build_spec_file
  image                              = "OL8_X86_64_STANDARD_10"
  primary_build_source               = "enterprise-ai-demo"
  is_pass_all_parameters_enabled     = true
  stage_execution_timeout_in_seconds = 7200

  build_pipeline_stage_predecessor_collection {
    items {
      id = contains(keys(oci_devops_build_pipeline_stage.deliver_image), each.key) ? oci_devops_build_pipeline_stage.deliver_image[each.key].id : oci_devops_build_pipeline.this[0].id
    }
  }

  build_runner_shape_config {
    build_runner_type = "CUSTOM"
    ocpus             = 2
    memory_in_gbs     = 16
  }

  build_source_collection {
    items {
      name            = "enterprise-ai-demo"
      connection_type = var.create_devops_repository ? "DEVOPS_CODE_REPOSITORY" : var.source_connection_type
      connection_id   = var.create_github_connection ? oci_devops_connection.github[0].id : (var.source_connection_id != "" ? var.source_connection_id : null)
      repository_id   = var.create_devops_repository ? oci_devops_repository.source[0].id : (var.source_repository_id != "" ? var.source_repository_id : null)
      repository_url  = var.create_devops_repository ? oci_devops_repository.source[0].http_url : (var.source_repo_url != "" ? var.source_repo_url : null)
      branch          = var.create_devops_repository ? var.devops_repository_branch : var.source_branch
    }
  }

  depends_on = [oci_devops_build_pipeline_stage.deliver_image]
}

resource "oci_devops_build_pipeline_stage" "deploy_portal" {
  count = var.enabled ? 1 : 0

  build_pipeline_id                  = oci_devops_build_pipeline.this[0].id
  build_pipeline_stage_type          = "BUILD"
  display_name                       = "deploy-portal-container"
  description                        = "Creates a replacement portal container instance, smoke-tests it, switches the load balancer, and removes old portal instances."
  build_spec_file                    = "infra/devops-hosted-image-build/build_spec_deploy_portal.yaml"
  image                              = "OL8_X86_64_STANDARD_10"
  primary_build_source               = "enterprise-ai-demo"
  is_pass_all_parameters_enabled     = true
  stage_execution_timeout_in_seconds = 3600

  build_pipeline_stage_predecessor_collection {
    items {
      id = oci_devops_build_pipeline_stage.deliver_image["portal"].id
    }
    dynamic "items" {
      for_each = oci_devops_build_pipeline_stage.deploy_hosted

      content {
        id = items.value.id
      }
    }
  }

  build_runner_shape_config {
    build_runner_type = "CUSTOM"
    ocpus             = 2
    memory_in_gbs     = 16
  }

  build_source_collection {
    items {
      name            = "enterprise-ai-demo"
      connection_type = var.create_devops_repository ? "DEVOPS_CODE_REPOSITORY" : var.source_connection_type
      connection_id   = var.create_github_connection ? oci_devops_connection.github[0].id : (var.source_connection_id != "" ? var.source_connection_id : null)
      repository_id   = var.create_devops_repository ? oci_devops_repository.source[0].id : (var.source_repository_id != "" ? var.source_repository_id : null)
      repository_url  = var.create_devops_repository ? oci_devops_repository.source[0].http_url : (var.source_repo_url != "" ? var.source_repo_url : null)
      branch          = var.create_devops_repository ? var.devops_repository_branch : var.source_branch
    }
  }

  depends_on = [oci_devops_build_pipeline_stage.deliver_image]
}

resource "oci_devops_build_run" "this" {
  count = var.enabled && var.run_build ? 1 : 0

  build_pipeline_id = oci_devops_build_pipeline.this[0].id
  display_name      = "enterprise-ai-demo-hosted-images-${var.resource_suffix}"

  timeouts {
    create = "90m"
  }

  build_run_arguments {
    items {
      name  = "RESOURCE_SUFFIX"
      value = var.resource_suffix
    }
    items {
      name  = "OCI_REGION"
      value = var.region
    }
    items {
      name  = "COMPARTMENT_ID"
      value = var.compartment_id
    }
    items {
      name  = "OCIR_REGION_KEY"
      value = var.ocir_region_key
    }
    items {
      name  = "OCIR_NAMESPACE"
      value = data.oci_objectstorage_namespace.this[0].namespace
    }
    items {
      name  = "IMAGE_TAG"
      value = var.image_tag
    }
    items {
      name  = "SOURCE_REVISION"
      value = var.source_revision
    }
    items {
      name  = "SOURCE_PACKAGE_REVISION"
      value = local.source_package_revision
    }
    items {
      name  = "DEPLOY_ONLY_APP"
      value = local.deploy_only_app_pipeline_value
    }
    items {
      name  = "OCI_HA_LANGFUSE_DEPLOY"
      value = var.deploy_langfuse_hosted_application ? "true" : "false"
    }
    items {
      name  = "APP_DEPLOY"
      value = local.app_deploy_pipeline_value
    }
    items {
      name  = "OCI_HA_HOSTED_AGENT_DEPLOY"
      value = var.deploy_hosted_agent_hosted_application ? "true" : "false"
    }
    items {
      name  = "OCI_HA_LANGGRAPH_DEPLOY"
      value = var.deploy_langgraph_hosted_application ? "true" : "false"
    }
    items {
      name  = "OCI_HA_OPENCLAW_DEPLOY"
      value = var.deploy_openclaw_hosted_application ? "true" : "false"
    }
    items {
      name  = "OCI_HA_LLAMAINDEX_DEPLOY"
      value = var.deploy_llamaindex_hosted_application ? "true" : "false"
    }
    items {
      name  = "PORTAL_CONTAINER_REPOSITORY_ID"
      value = var.portal_container_repository_id
    }
    items {
      name  = "PORTAL_PRIVATE_SUBNET_ID"
      value = var.portal_private_subnet_id
    }
    items {
      name  = "PORTAL_NETWORK_SECURITY_GROUP_ID"
      value = var.portal_network_security_group_id
    }
    items {
      name  = "PORTAL_LOAD_BALANCER_ID"
      value = var.portal_load_balancer_id
    }
    items {
      name  = "PORTAL_BACKEND_SET_NAME"
      value = var.portal_backend_set_name
    }
    items {
      name  = "PORTAL_PUBLIC_URL"
      value = var.portal_public_url
    }
    items {
      name  = "PORTAL_CONTAINER_PORT"
      value = tostring(var.portal_container_port)
    }
    items {
      name  = "PORTAL_CONTAINER_SHAPE"
      value = var.portal_container_shape
    }
    items {
      name  = "PORTAL_CONTAINER_OCPUS"
      value = tostring(var.portal_container_ocpus)
    }
    items {
      name  = "PORTAL_CONTAINER_MEMORY_GBS"
      value = tostring(var.portal_container_memory_gbs)
    }
    items {
      name  = "PORTAL_AUTH_PASSWORD"
      value = var.portal_auth_password
    }
    items {
      name  = "PORTAL_RUNTIME_CONFIG_NAMESPACE"
      value = var.portal_runtime_config_namespace
    }
    items {
      name  = "PORTAL_RUNTIME_CONFIG_BUCKET"
      value = var.portal_runtime_config_bucket
    }
    items {
      name  = "PORTAL_RUNTIME_CONFIG_OBJECT"
      value = var.portal_runtime_config_object
    }
    items {
      name  = "PORTAL_RUN_HISTORY_NAMESPACE"
      value = var.portal_run_history_namespace
    }
    items {
      name  = "PORTAL_RUN_HISTORY_BUCKET"
      value = var.portal_run_history_bucket
    }
    items {
      name  = "PORTAL_RUN_HISTORY_OBJECT"
      value = var.portal_run_history_object
    }
    items {
      name  = "PORTAL_CHANGE_LOG_NAMESPACE"
      value = var.portal_change_log_namespace
    }
    items {
      name  = "PORTAL_CHANGE_LOG_BUCKET"
      value = var.portal_change_log_bucket
    }
    items {
      name  = "PORTAL_CHANGE_LOG_OBJECT"
      value = var.portal_change_log_object
    }
    items {
      name  = "PORTAL_VECTOR_STORE_ID"
      value = var.portal_vector_store_id != null && var.portal_vector_store_id != "" ? var.portal_vector_store_id : " "
    }
    items {
      name  = "PORTAL_CONVERSATION_ID"
      value = var.portal_conversation_id != null && var.portal_conversation_id != "" ? var.portal_conversation_id : " "
    }
    items {
      name  = "PORTAL_CODE_INTERPRETER_CONTAINER_ID"
      value = var.portal_code_interpreter_container_id != null && var.portal_code_interpreter_container_id != "" ? var.portal_code_interpreter_container_id : " "
    }
    items {
      name  = "SHARED_POLICY_ID"
      value = var.shared_policy_id
    }
    items {
      name  = "IDCS_DOMAIN_URL"
      value = var.idcs_domain_url
    }
    items {
      name  = "IDCS_AUDIENCE"
      value = var.idcs_audience
    }
    items {
      name  = "IDCS_SCOPE"
      value = var.idcs_scope
    }
    items {
      name  = "OCI_HOSTED_APP_IDCS_CLIENT_ID"
      value = var.hosted_app_idcs_client_id
    }
    items {
      name  = "OCI_HOSTED_APP_IDCS_CLIENT_SECRET"
      value = var.hosted_app_idcs_client_secret
    }
    items {
      name  = "OCI_GENAI_PROJECT_ID"
      value = var.oci_genai_project_id
    }
    items {
      name  = "OCI_GENAI_API_KEY"
      value = var.oci_genai_api_key
    }
    items {
      name  = "OPENCLAW_GATEWAY_TOKEN"
      value = local.build_openclaw_gateway_token
    }
    items {
      name  = "LANGFUSE_DATABASE_URL"
      value = local.build_langfuse_database_url
    }
    items {
      name  = "LANGFUSE_CLICKHOUSE_URL"
      value = local.build_langfuse_clickhouse_url
    }
    items {
      name  = "LANGFUSE_CLICKHOUSE_MIGRATION_URL"
      value = local.build_langfuse_clickhouse_migration_url
    }
    items {
      name  = "LANGFUSE_CLICKHOUSE_USER"
      value = local.build_langfuse_clickhouse_user
    }
    items {
      name  = "LANGFUSE_CLICKHOUSE_PASSWORD"
      value = local.build_langfuse_clickhouse_password
    }
    items {
      name  = "LANGFUSE_REDIS_CONNECTION_STRING"
      value = local.build_langfuse_redis_connection_string
    }
    items {
      name  = "LANGFUSE_S3_EVENT_UPLOAD_BUCKET"
      value = local.build_langfuse_s3_event_upload_bucket
    }
    items {
      name  = "LANGFUSE_S3_MEDIA_UPLOAD_BUCKET"
      value = local.build_langfuse_s3_media_upload_bucket
    }
    items {
      name  = "LANGFUSE_S3_UPLOAD_REGION"
      value = local.build_langfuse_s3_upload_region
    }
    items {
      name  = "LANGFUSE_S3_UPLOAD_ENDPOINT"
      value = local.build_langfuse_s3_upload_endpoint
    }
    items {
      name  = "LANGFUSE_NEXTAUTH_SECRET"
      value = local.build_langfuse_nextauth_secret
    }
    items {
      name  = "LANGFUSE_SALT"
      value = local.build_langfuse_salt
    }
    items {
      name  = "LANGFUSE_ENCRYPTION_KEY"
      value = local.build_langfuse_encryption_key
    }
    items {
      name  = "LANGFUSE_NETWORKING_CONFIG_JSON"
      value = local.build_langfuse_networking_config_json
    }
  }

  depends_on = [
    oci_devops_build_pipeline_stage.build_image,
    oci_devops_build_pipeline_stage.deliver_image,
    oci_devops_build_pipeline_stage.deploy_hosted,
    oci_devops_build_pipeline_stage.deploy_portal,
    oci_logging_log.devops,
    terraform_data.seed_devops_repository
  ]

  lifecycle {
    replace_triggered_by = [
      terraform_data.seed_devops_repository
    ]
  }
}
