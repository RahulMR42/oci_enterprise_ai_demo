data "oci_objectstorage_namespace" "portal" {
  compartment_id = var.compartment_id
}

resource "oci_artifacts_container_repository" "portal" {
  count = var.portal_container_enabled && var.portal_container_image_uri == "" && var.portal_container_repository_id == "" ? 1 : 0

  compartment_id = var.compartment_id
  display_name   = var.portal_container_repository_name
  is_public      = false
  freeform_tags  = local.portal_tags
}

data "external" "file_search_vector_store" {
  count = var.portal_container_enabled && var.file_search_local_exec_enabled ? 1 : 0

  program = ["python3", "${path.module}/scripts/read_generated_metadata.py"]

  query = {
    generated_file = local.file_search_vector_store_generated_file
    id_keys        = "id,vector_store_id"
  }

  depends_on = [module.file_search_vector_store_rag]
}

data "external" "conversation_store" {
  count = var.portal_container_enabled && var.conversation_store_local_exec_enabled ? 1 : 0

  program = ["python3", "${path.module}/scripts/read_generated_metadata.py"]

  query = {
    generated_file = local.conversation_store_generated_file
    id_keys        = "id"
  }

  depends_on = [module.conversation_store]
}

data "external" "code_interpreter_container" {
  count = var.portal_container_enabled && var.code_interpreter_local_exec_enabled ? 1 : 0

  program = ["python3", "${path.module}/scripts/read_generated_metadata.py"]

  query = {
    generated_file = local.code_interpreter_container_generated_file
    id_keys        = "id"
  }

  depends_on = [module.code_interpreter]
}

resource "oci_objectstorage_bucket" "portal_config" {
  count = var.portal_container_enabled ? 1 : 0

  compartment_id = var.compartment_id
  namespace      = data.oci_objectstorage_namespace.portal.namespace
  name           = "enterprise-ai-demo-portal-config-${var.resource_suffix}"
  access_type    = "NoPublicAccess"
  freeform_tags  = local.portal_tags
}

resource "oci_objectstorage_object" "portal_runtime_config" {
  count = var.portal_container_enabled ? 1 : 0

  namespace    = data.oci_objectstorage_namespace.portal.namespace
  bucket       = oci_objectstorage_bucket.portal_config[0].name
  object       = "portal-runtime-config.json"
  content      = jsonencode(local.portal_runtime_config)
  content_type = "application/json"
}

resource "terraform_data" "portal_runtime_config_generated_values" {
  count = var.portal_container_enabled ? 1 : 0

  triggers_replace = [
    var.resource_suffix,
    var.devops_source_revision,
    tostring(var.conversation_store_local_exec_enabled),
    tostring(var.file_search_local_exec_enabled),
    tostring(var.code_interpreter_local_exec_enabled)
  ]

  input = {
    namespace                    = data.oci_objectstorage_namespace.portal.namespace
    bucket                       = oci_objectstorage_bucket.portal_config[0].name
    object                       = oci_objectstorage_object.portal_runtime_config[0].object
    region                       = var.region
    profile                      = var.profile
    conversation_store_generated = local.conversation_store_generated_file
    file_search_vector_store     = local.file_search_vector_store_generated_file
    code_interpreter_container   = local.code_interpreter_container_generated_file
    generated_runtime_config     = "${path.module}/.terraform/generated/portal-runtime-config.json"
    portal_runtime_config_json   = jsonencode(local.portal_runtime_config)
  }

  depends_on = [
    oci_objectstorage_object.portal_runtime_config,
    module.conversation_store,
    module.file_search_vector_store_rag,
    module.code_interpreter
  ]

  provisioner "local-exec" {
    environment = {
      PORTAL_RUNTIME_CONFIG_JSON        = self.input.portal_runtime_config_json
      PORTAL_RUNTIME_CONFIG_NAMESPACE   = self.input.namespace
      PORTAL_RUNTIME_CONFIG_BUCKET      = self.input.bucket
      PORTAL_RUNTIME_CONFIG_OBJECT      = self.input.object
      PORTAL_RUNTIME_CONFIG_OUTPUT_FILE = self.input.generated_runtime_config
      CONVERSATION_STORE_GENERATED_FILE = self.input.conversation_store_generated
      FILE_SEARCH_VECTOR_STORE_FILE     = self.input.file_search_vector_store
      CODE_INTERPRETER_CONTAINER_FILE   = self.input.code_interpreter_container
    }

    command = <<-EOT
      set -euo pipefail
      mkdir -p '${path.module}/.terraform/generated'
      python3 - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

def read_json_file(path_value):
    if not path_value:
        return {}
    path = Path(path_value)
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}

def first_value(payload, *keys):
    for key in keys:
        value = str(payload.get(key) or "").strip()
        if value:
            return value
    return ""

config = json.loads(os.getenv("PORTAL_RUNTIME_CONFIG_JSON") or "{}")
updates = []

conversation_id = first_value(read_json_file(os.getenv("CONVERSATION_STORE_GENERATED_FILE")), "id")
if conversation_id:
    config["conversationId"] = conversation_id
    updates.append("conversationId")

vector_store_id = first_value(read_json_file(os.getenv("FILE_SEARCH_VECTOR_STORE_FILE")), "id", "vector_store_id")
if vector_store_id:
    config["vectorStoreId"] = vector_store_id
    updates.append("vectorStoreId")

code_container_id = first_value(read_json_file(os.getenv("CODE_INTERPRETER_CONTAINER_FILE")), "id")
if code_container_id:
    config["codeInterpreterContainerId"] = code_container_id
    updates.append("codeInterpreterContainerId")

config["generatedRuntimeConfigUpdatedAt"] = datetime.now(timezone.utc).isoformat()
output_path = Path(os.environ["PORTAL_RUNTIME_CONFIG_OUTPUT_FILE"])
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(config, indent=2, sort_keys=True), encoding="utf-8")
print("Prepared portal runtime config generated keys: " + (", ".join(updates) if updates else "none"))
PY
      oci_auth_args="--auth resource_principal"
      if [ -n '${self.input.profile}' ]; then
        oci_auth_args="--profile '${self.input.profile}'"
      else
        python3 -m pip install --user --quiet --upgrade oci-cli || true
        export PATH="$HOME/.local/bin:$PATH"
      fi
      if oci os object put \
        --namespace "$PORTAL_RUNTIME_CONFIG_NAMESPACE" \
        --bucket-name "$PORTAL_RUNTIME_CONFIG_BUCKET" \
        --name "$PORTAL_RUNTIME_CONFIG_OBJECT" \
        --file "$PORTAL_RUNTIME_CONFIG_OUTPUT_FILE" \
        --content-type application/json \
        --force \
        $oci_auth_args \
        --region '${self.input.region}' \
        --output json >/dev/null; then
        echo "Updated portal runtime config generated object."
      else
        echo "Skipping portal runtime config generated Object Storage update after Terraform object creation."
      fi
    EOT
  }
}

resource "oci_objectstorage_object" "portal_run_history" {
  count = var.portal_container_enabled ? 1 : 0

  namespace    = data.oci_objectstorage_namespace.portal.namespace
  bucket       = oci_objectstorage_bucket.portal_config[0].name
  object       = "portal-demo-run-summary.json"
  content      = jsonencode({ updatedAt = "", metrics = {}, runs = [] })
  content_type = "application/json"

  lifecycle {
    ignore_changes = [content]
  }
}

resource "oci_objectstorage_object" "portal_change_log" {
  count = var.portal_container_enabled ? 1 : 0

  namespace    = data.oci_objectstorage_namespace.portal.namespace
  bucket       = oci_objectstorage_bucket.portal_config[0].name
  object       = "portal-change-log.json"
  content      = file("${path.module}/../../change-log.json")
  content_type = "application/json"
}

locals {
  portal_display_name = "enterprise-ai-demo-portal-${var.resource_suffix}"
  portal_tags = {
    "enterprise-ai-demo" = "true"
    "demo"               = "portal"
  }
  portal_container_image_uri = var.portal_container_image_uri != "" ? var.portal_container_image_uri : format(
    "%s.ocir.io/%s/%s:%s",
    var.hosted_app_ocir_region_key,
    data.oci_objectstorage_namespace.portal.namespace,
    var.portal_container_repository_name,
    local.devops_image_tag
  )
  devops_image_tag                          = var.devops_source_revision != "" ? var.devops_source_revision : var.portal_container_image_tag
  conversation_store_generated_file         = "${path.module}/../conversation-store/.terraform/generated/conversation.json"
  file_search_vector_store_generated_file   = "${path.module}/../file-search-vector-store-rag/.terraform/generated/vector_store.json"
  code_interpreter_container_generated_file = "${path.module}/../code-interpreter/.terraform/generated/container.json"
  existing_portal_runtime_config            = try(jsondecode(var.existing_portal_runtime_config_json), {})
  retained_generated_runtime_config = {
    conversationId                       = try(tostring(local.existing_portal_runtime_config.conversationId), "")
    vectorStoreId                        = try(tostring(local.existing_portal_runtime_config.vectorStoreId), "")
    codeInterpreterContainerId           = try(tostring(local.existing_portal_runtime_config.codeInterpreterContainerId), "")
    codeInterpreterContainerStatus       = try(tostring(local.existing_portal_runtime_config.codeInterpreterContainerStatus), "")
    fileSearchSeedDocumentCount          = try(tonumber(local.existing_portal_runtime_config.fileSearchSeedDocumentCount), 0)
    fileSearchSeedDocumentCompletedCount = try(tonumber(local.existing_portal_runtime_config.fileSearchSeedDocumentCompletedCount), 0)
    fileSearchVectorStore                = try(local.existing_portal_runtime_config.fileSearchVectorStore, {})
    fileSearchSeedDocuments              = try(local.existing_portal_runtime_config.fileSearchSeedDocuments, {})
    generatedRuntimeConfigUpdatedAt      = try(tostring(local.existing_portal_runtime_config.generatedRuntimeConfigUpdatedAt), "")
    generatedRuntimeProvisioner          = try(tostring(local.existing_portal_runtime_config.generatedRuntimeProvisioner), "")
  }
  generated_portal_conversation_id = (
    var.conversation_store_local_exec_enabled
    ? try(data.external.conversation_store[0].result.id, "")
    : ""
  )
  generated_portal_vector_store_id = (
    var.file_search_local_exec_enabled
    ? try(data.external.file_search_vector_store[0].result.id, "")
    : ""
  )
  generated_portal_code_interpreter_container_id = (
    var.code_interpreter_local_exec_enabled
    ? try(data.external.code_interpreter_container[0].result.id, "")
    : ""
  )
  portal_conversation_id_for_devops = (
    local.generated_portal_conversation_id != ""
    ? local.generated_portal_conversation_id
    : local.retained_generated_runtime_config.conversationId
  )
  portal_vector_store_id_for_devops = (
    local.generated_portal_vector_store_id != ""
    ? local.generated_portal_vector_store_id
    : local.retained_generated_runtime_config.vectorStoreId
  )
  portal_code_interpreter_container_id_for_devops = (
    local.generated_portal_code_interpreter_container_id != ""
    ? local.generated_portal_code_interpreter_container_id
    : local.retained_generated_runtime_config.codeInterpreterContainerId
  )
  current_devops_build_exports = module.devops_hosted_image_build.hosted_deployment_exports
  devops_portal_conversation_id = (
    try(tostring(local.current_devops_build_exports.PORTAL_CONVERSATION_ID), "") != " "
    ? trimspace(try(tostring(local.current_devops_build_exports.PORTAL_CONVERSATION_ID), ""))
    : ""
  )
  devops_portal_vector_store_id = (
    try(tostring(local.current_devops_build_exports.PORTAL_VECTOR_STORE_ID), "") != " "
    ? trimspace(try(tostring(local.current_devops_build_exports.PORTAL_VECTOR_STORE_ID), ""))
    : ""
  )
  devops_portal_code_interpreter_container_id = (
    try(tostring(local.current_devops_build_exports.PORTAL_CODE_INTERPRETER_CONTAINER_ID), "") != " "
    ? trimspace(try(tostring(local.current_devops_build_exports.PORTAL_CODE_INTERPRETER_CONTAINER_ID), ""))
    : ""
  )
  devops_portal_code_interpreter_container_status  = trimspace(try(tostring(local.current_devops_build_exports.PORTAL_CODE_INTERPRETER_CONTAINER_STATUS), ""))
  devops_file_search_seed_document_count           = try(tonumber(trimspace(try(tostring(local.current_devops_build_exports.PORTAL_FILE_SEARCH_SEED_DOCUMENT_COUNT), ""))), 0)
  devops_file_search_seed_document_completed_count = try(tonumber(trimspace(try(tostring(local.current_devops_build_exports.PORTAL_FILE_SEARCH_SEED_DOCUMENT_COMPLETED_COUNT), ""))), 0)
  portal_conversation_id = (
    local.generated_portal_conversation_id != ""
    ? local.generated_portal_conversation_id
    : local.devops_portal_conversation_id != ""
    ? local.devops_portal_conversation_id
    : local.retained_generated_runtime_config.conversationId
  )
  portal_vector_store_id = (
    local.generated_portal_vector_store_id != ""
    ? local.generated_portal_vector_store_id
    : local.devops_portal_vector_store_id != ""
    ? local.devops_portal_vector_store_id
    : local.retained_generated_runtime_config.vectorStoreId
  )
  portal_code_interpreter_container_id = (
    local.generated_portal_code_interpreter_container_id != ""
    ? local.generated_portal_code_interpreter_container_id
    : local.devops_portal_code_interpreter_container_id != ""
    ? local.devops_portal_code_interpreter_container_id
    : local.retained_generated_runtime_config.codeInterpreterContainerId
  )
  portal_code_interpreter_container_status = (
    local.devops_portal_code_interpreter_container_status != ""
    ? local.devops_portal_code_interpreter_container_status
    : local.retained_generated_runtime_config.codeInterpreterContainerStatus != ""
    ? local.retained_generated_runtime_config.codeInterpreterContainerStatus
    : local.portal_code_interpreter_container_id != ""
    ? "created"
    : ""
  )
  portal_file_search_seed_document_count = (
    local.devops_file_search_seed_document_count > 0
    ? local.devops_file_search_seed_document_count
    : local.retained_generated_runtime_config.fileSearchSeedDocumentCount
  )
  portal_file_search_seed_document_completed_count = (
    local.devops_file_search_seed_document_completed_count > 0
    ? local.devops_file_search_seed_document_completed_count
    : local.retained_generated_runtime_config.fileSearchSeedDocumentCompletedCount
  )
  default_hosted_deployment_exports = {
    HOSTED_AGENT_DEPLOYMENT_ID   = ""
    HOSTED_AGENT_URL             = ""
    LANGFUSE_DEPLOYMENT_ID       = ""
    LANGFUSE_URL                 = ""
    LANGGRAPH_DEPLOYMENT_ID      = ""
    LANGGRAPH_URL                = ""
    LLAMAINDEX_DEPLOYMENT_ID     = ""
    LLAMAINDEX_URL               = ""
    OPENCLAW_DEPLOYMENT_ID       = ""
    OPENCLAW_URL                 = ""
    PORTAL_HOSTED_APPLICATION_ID = ""
    PORTAL_HOSTED_DEPLOYMENT_ID  = ""
    PORTAL_URL                   = ""
  }
  existing_hosted_deployment_exports = {
    for key, value in try(jsondecode(var.existing_hosted_deployment_exports_json), {}) :
    key => tostring(value)
    if contains(keys(local.default_hosted_deployment_exports), key)
  }
  current_hosted_deployment_exports = {
    for key, value in local.current_devops_build_exports :
    key => value
    if contains(keys(local.default_hosted_deployment_exports), key)
  }
  normalized_app_deploy          = lower(trimspace(var.app_deploy))
  deploy_all_hosted_applications = local.normalized_app_deploy == "all"
  deploy_portal_only             = local.normalized_app_deploy == "portal"
  effective_deploy_only_app      = local.deploy_all_hosted_applications ? false : (local.deploy_portal_only || var.deploy_only_app)
  selected_hosted_deployment_export_keys = local.effective_deploy_only_app ? [
    "PORTAL_HOSTED_APPLICATION_ID",
    "PORTAL_HOSTED_DEPLOYMENT_ID",
    "PORTAL_URL"
    ] : local.deploy_all_hosted_applications ? keys(local.default_hosted_deployment_exports) : concat(
    var.oci_ha_hosted_agent_deploy ? ["HOSTED_AGENT_DEPLOYMENT_ID", "HOSTED_AGENT_URL"] : [],
    var.oci_ha_langgraph_deploy ? ["LANGGRAPH_DEPLOYMENT_ID", "LANGGRAPH_URL"] : [],
    var.oci_ha_langfuse_deploy ? ["LANGFUSE_DEPLOYMENT_ID", "LANGFUSE_URL"] : [],
    var.oci_ha_openclaw_deploy ? ["OPENCLAW_DEPLOYMENT_ID", "OPENCLAW_URL"] : [],
    var.oci_ha_llamaindex_deploy ? ["LLAMAINDEX_DEPLOYMENT_ID", "LLAMAINDEX_URL"] : [],
    ["PORTAL_HOSTED_APPLICATION_ID", "PORTAL_HOSTED_DEPLOYMENT_ID", "PORTAL_URL"]
  )
  non_empty_current_hosted_deployment_exports = {
    for key, value in local.current_hosted_deployment_exports :
    key => tostring(value)
    if tostring(value) != ""
  }
  stale_hosted_deployment_export_keys = local.effective_deploy_only_app ? [] : [
    for key, value in local.current_hosted_deployment_exports :
    key if tostring(value) == "" && contains(keys(local.existing_hosted_deployment_exports), key) && contains(local.selected_hosted_deployment_export_keys, key)
  ]
  retained_existing_hosted_deployment_exports = {
    for key, value in local.existing_hosted_deployment_exports :
    key => value
    if !contains(local.stale_hosted_deployment_export_keys, key)
  }
  hosted_deployment_exports = merge(
    local.default_hosted_deployment_exports,
    local.retained_existing_hosted_deployment_exports,
    local.non_empty_current_hosted_deployment_exports
  )
  portal_url              = var.portal_container_enabled ? trimspace(try(tostring(local.hosted_deployment_exports.PORTAL_URL), "")) : ""
  portal_sso_callback_url = local.portal_url != "" ? "${trimsuffix(local.portal_url, "/")}/auth/sso/callback" : ""
  portal_runtime_config = {
    resourceSuffix                       = var.resource_suffix
    region                               = var.region
    sourceRevision                       = var.devops_source_revision
    codeSourceRepoUrl                    = var.devops_source_repo_url
    codeSourceBranch                     = var.devops_source_branch
    devopsHostedImageBuildRunId          = module.devops_hosted_image_build.build_run_id
    devopsHostedImageBuildPipelineId     = module.devops_hosted_image_build.build_pipeline_id
    projectId                            = var.oci_genai_project_id
    conversationId                       = local.portal_conversation_id
    vectorStoreId                        = local.portal_vector_store_id
    codeInterpreterContainerId           = local.portal_code_interpreter_container_id
    codeInterpreterContainerStatus       = local.portal_code_interpreter_container_status
    fileSearchVectorStore                = local.retained_generated_runtime_config.fileSearchVectorStore
    fileSearchSeedDocuments              = local.retained_generated_runtime_config.fileSearchSeedDocuments
    fileSearchSeedDocumentCount          = local.portal_file_search_seed_document_count
    fileSearchSeedDocumentCompletedCount = local.portal_file_search_seed_document_completed_count
    generatedRuntimeConfigUpdatedAt      = local.retained_generated_runtime_config.generatedRuntimeConfigUpdatedAt
    generatedRuntimeProvisioner          = local.retained_generated_runtime_config.generatedRuntimeProvisioner != "" ? local.retained_generated_runtime_config.generatedRuntimeProvisioner : (local.portal_conversation_id != "" || local.portal_vector_store_id != "" || local.portal_code_interpreter_container_id != "" ? "oci-devops-build-pipeline" : "")
    hosted                               = local.hosted_deployment_exports
    runHistoryObjectNamespace            = data.oci_objectstorage_namespace.portal.namespace
    runHistoryObjectBucket               = var.portal_container_enabled ? oci_objectstorage_bucket.portal_config[0].name : ""
    runHistoryObjectName                 = "portal-demo-run-summary.json"
    changeLogObjectNamespace             = data.oci_objectstorage_namespace.portal.namespace
    changeLogObjectBucket                = var.portal_container_enabled ? oci_objectstorage_bucket.portal_config[0].name : ""
    changeLogObjectName                  = "portal-change-log.json"
    runtimeConfigObjectNamespace         = data.oci_objectstorage_namespace.portal.namespace
    runtimeConfigObjectBucket            = var.portal_container_enabled ? oci_objectstorage_bucket.portal_config[0].name : ""
    runtimeConfigObjectName              = "portal-runtime-config.json"
  }
}

resource "terraform_data" "portal_idcs_redirect_uri" {
  count = var.portal_container_enabled && var.devops_hosted_image_build_enabled && var.devops_hosted_image_run_build ? 1 : 0

  triggers_replace = [
    var.resource_suffix,
    var.devops_source_revision,
    local.portal_sso_callback_url,
    module.hosted_agentic_applications.hosted_app_idcs_launch_client_app_id
  ]

  input = {
    idcs_app_id             = module.hosted_agentic_applications.hosted_app_idcs_launch_client_app_id
    idcs_domain_url         = var.idcs_domain_url
    portal_sso_callback_url = local.portal_sso_callback_url
    profile                 = var.profile
    region                  = var.region
  }

  depends_on = [module.devops_hosted_image_build]

  provisioner "local-exec" {
    environment = {
      IDCS_APP_ID             = self.input.idcs_app_id
      IDCS_DOMAIN_URL         = self.input.idcs_domain_url
      OCI_CLI_PROFILE         = self.input.profile
      OCI_REGION              = self.input.region
      PORTAL_SSO_CALLBACK_URL = self.input.portal_sso_callback_url
    }

    command = <<-EOT
      set -euo pipefail
      unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY no_proxy NO_PROXY

      if [ -z "$IDCS_APP_ID" ] || [ -z "$IDCS_DOMAIN_URL" ] || [ -z "$PORTAL_SSO_CALLBACK_URL" ]; then
        echo "Skipping portal IDCS redirect URI registration; SSO app or portal URL is not available."
        exit 0
      fi

      if ! oci identity-domains app patch -h >/dev/null 2>&1; then
        python3 -m pip install --user --quiet --upgrade --proxy "" --index-url https://pypi.org/simple oci-cli
      fi
      export PATH="$HOME/.local/bin:$PATH"

      oci_auth_args=(--auth resource_principal)
      if [ -n "$OCI_CLI_PROFILE" ]; then
        oci_auth_args=(--profile "$OCI_CLI_PROFILE")
      fi

      app_json="/tmp/portal-idcs-app.json"
      operations_json="/tmp/portal-idcs-app-patch.json"

      oci identity-domains app get \
        --endpoint "$IDCS_DOMAIN_URL" \
        --app-id "$IDCS_APP_ID" \
        "$${oci_auth_args[@]}" \
        --region "$OCI_REGION" \
        --output json > "$app_json"

      python3 - "$app_json" "$PORTAL_SSO_CALLBACK_URL" "$operations_json" <<'PY'
import json
import sys

app_file, callback_uri, operations_file = sys.argv[1:4]
payload = json.load(open(app_file, encoding="utf-8"))
data = payload.get("data") or payload

def read_list(*names):
    for name in names:
        value = data.get(name)
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
    return []

redirect_uris = read_list("redirectUris", "redirect-uris", "redirect_uris")
allowed_grants = read_list("allowedGrants", "allowed-grants", "allowed_grants")
if callback_uri and callback_uri not in redirect_uris:
    redirect_uris.append(callback_uri)
for grant in ["client_credentials", "authorization_code"]:
    if grant not in allowed_grants:
        allowed_grants.append(grant)

operations = [
    {"op": "replace", "path": "redirectUris", "value": redirect_uris},
    {"op": "replace", "path": "allowedGrants", "value": allowed_grants},
]
with open(operations_file, "w", encoding="utf-8") as handle:
    json.dump(operations, handle)
PY

      oci identity-domains app patch \
        --endpoint "$IDCS_DOMAIN_URL" \
        --app-id "$IDCS_APP_ID" \
        --schemas '["urn:ietf:params:scim:api:messages:2.0:PatchOp"]' \
        --operations "file://$operations_json" \
        "$${oci_auth_args[@]}" \
        --region "$OCI_REGION" \
        --output json >/tmp/portal-idcs-app-patch-response.json

      echo "Registered portal SSO callback on IDCS app: $PORTAL_SSO_CALLBACK_URL"
    EOT
  }
}
