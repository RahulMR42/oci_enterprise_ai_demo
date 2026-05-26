data "oci_objectstorage_namespace" "this" {
  count = var.enabled ? 1 : 0
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

  project_id       = oci_devops_project.this[0].id
  name             = "enterprise-ai-demo-source-${var.resource_suffix}"
  repository_type  = "HOSTED"
  default_branch   = var.source_branch
  description      = "Resource Manager-seeded source repository for Enterprise AI demo hosted image builds."
}

resource "terraform_data" "seed_devops_repository" {
  count = var.enabled && var.create_devops_repository ? 1 : 0

  triggers_replace = [
    var.source_repo_url,
    var.source_branch,
    oci_devops_repository.source[0].id
  ]

  input = {
    devops_repository_http_url = oci_devops_repository.source[0].http_url
    source_branch              = var.source_branch
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
      git push "$target_url" "HEAD:refs/heads/${self.input.source_branch}" --force
    EOT
  }
}

resource "oci_devops_build_pipeline" "this" {
  count = var.enabled ? 1 : 0

  project_id   = oci_devops_project.this[0].id
  display_name = "enterprise-ai-demo-hosted-images-${var.resource_suffix}"
  description  = "Builds and pushes Enterprise AI demo hosted application images to OCIR."

  build_pipeline_parameters {
    items {
      name          = "RESOURCE_SUFFIX"
      default_value = var.resource_suffix
      description   = "Resource suffix used by the hosted image repository names."
    }
    items {
      name          = "OCI_REGION"
      default_value = var.region
      description   = "OCI region used by OCI CLI calls in the build."
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
  }
}

resource "oci_devops_build_pipeline_stage" "build" {
  count = var.enabled ? 1 : 0

  build_pipeline_id                  = oci_devops_build_pipeline.this[0].id
  build_pipeline_stage_type          = "BUILD"
  display_name                       = "build-hosted-images"
  description                        = "Managed build stage for all hosted demo images."
  build_spec_file                    = "infra/devops-hosted-image-build/build_spec.yaml"
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
      branch          = var.source_branch
    }
  }

  depends_on = [terraform_data.seed_devops_repository]
}

resource "oci_devops_build_run" "this" {
  count = var.enabled && var.run_build ? 1 : 0

  build_pipeline_id = oci_devops_build_pipeline.this[0].id
  display_name      = "enterprise-ai-demo-hosted-images-${var.resource_suffix}"

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
      name  = "OCIR_USERNAME"
      value = var.ocir_username
    }
    items {
      name  = "OCIR_AUTH_TOKEN"
      value = var.ocir_auth_token
    }
  }

  depends_on = [oci_devops_build_pipeline_stage.build]
}
