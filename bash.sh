#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

LOG_CAPTURE_ENABLED="${LOG_CAPTURE_ENABLED:-true}"
LOG_DIR="${LOG_DIR:-logs}"
if [[ "$LOG_CAPTURE_ENABLED" == "true" && "${LOG_CAPTURE_ACTIVE:-false}" != "true" ]]; then
  mkdir -p "$LOG_DIR"
  LOG_FILE="${LOG_FILE:-${LOG_DIR}/enterprise-ai-demo-$(date +%Y%m%d-%H%M%S).log}"
  echo "Capturing startup and application logs to ${LOG_FILE}. Set LOG_CAPTURE_ENABLED=false to disable file capture."
  export LOG_CAPTURE_ACTIVE=true
  export LOG_FILE
  "$0" "$@" 2>&1 | tee -a "$LOG_FILE"
  exit "${PIPESTATUS[0]}"
else
  if [[ "$LOG_CAPTURE_ENABLED" != "true" ]]; then
    echo "File log capture disabled with LOG_CAPTURE_ENABLED=false."
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to start the Enterprise AI demo portal."
  exit 1
fi

DEFAULT_COMPARTMENT_ID="ocid1.compartment.oc1..aaaaaaaazx44wly3e4yextfibunmi2bgoibkdupj2opadokvllf4scgaybmq"
OCI_GENAI_COMPARTMENT_ID="${OCI_GENAI_COMPARTMENT_ID:-$DEFAULT_COMPARTMENT_ID}"
OCI_GENAI_REGION="${OCI_GENAI_REGION:-us-chicago-1}"
OCI_PROFILE="${OCI_PROFILE:-DEFAULT}"
OCI_GENAI_PROJECT_DISPLAY_NAME="${OCI_GENAI_PROJECT_DISPLAY_NAME:-enterprise-ai-demo-responses-api}"

existing_resource_suffix=""
if command -v terraform >/dev/null 2>&1; then
  existing_resource_suffix="$(terraform -chdir=infra/responses-api output -raw resource_suffix 2>/dev/null || true)"
fi
RESOURCE_SUFFIX="${RESOURCE_SUFFIX:-${existing_resource_suffix:-$(date +%s | shasum | cut -c1-6)}}"
REQUIRE_DEMO_INFRA="${REQUIRE_DEMO_INFRA:-true}"
PROVISION_SHARED_INFRA="${PROVISION_SHARED_INFRA:-true}"

oci_config_value() {
  local profile="$1"
  local key="$2"
  python3 - "$profile" "$key" <<'PY'
import configparser
import os
import sys
from pathlib import Path

profile = sys.argv[1]
key = sys.argv[2]
config_path = Path(os.environ.get("OCI_CONFIG_FILE", "~/.oci/config")).expanduser()
parser = configparser.ConfigParser()
parser.read(config_path)
if parser.has_option(profile, key):
    print(parser.get(profile, key))
PY
}

OCI_TENANCY_ID="${OCI_TENANCY_ID:-$(oci_config_value "$OCI_PROFILE" tenancy)}"

json_field() {
  local file_path="$1"
  local field_name="$2"
  if [[ ! -f "$file_path" ]]; then
    return 0
  fi
  python3 - "$file_path" "$field_name" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
field = sys.argv[2]
try:
    payload = json.loads(path.read_text())
except Exception:
    sys.exit(0)

value = payload
for part in field.split("."):
    if isinstance(value, dict):
        value = value.get(part, "")
    else:
        value = ""
        break
print(value if isinstance(value, str) else "")
PY
}

export_generated_runtime_ids() {
  local conversation_id
  local vector_store_id
  local code_container_id
  conversation_id="$(json_field "infra/conversation-store/.terraform/generated/conversation.json" "id")"
  vector_store_id="$(json_field "infra/file-search-vector-store-rag/.terraform/generated/vector_store.json" "id")"
  code_container_id="$(json_field "infra/code-interpreter/.terraform/generated/container.json" "id")"

  if [[ -n "$conversation_id" ]]; then
    export OCI_GENAI_CONVERSATION_ID="${OCI_GENAI_CONVERSATION_ID:-$conversation_id}"
    echo "Runtime Conversation Store conversation: ${OCI_GENAI_CONVERSATION_ID}"
  else
    echo "Runtime Conversation Store conversation: not found yet."
  fi

  if [[ -n "$vector_store_id" ]]; then
    export OCI_GENAI_VECTOR_STORE_ID="${OCI_GENAI_VECTOR_STORE_ID:-$vector_store_id}"
    echo "Runtime File Search vector store: ${OCI_GENAI_VECTOR_STORE_ID}"
  else
    echo "Runtime File Search vector store: not found yet."
  fi

  if [[ -n "$code_container_id" ]]; then
    export OCI_GENAI_CODE_INTERPRETER_CONTAINER="${OCI_GENAI_CODE_INTERPRETER_CONTAINER:-$code_container_id}"
    echo "Runtime Code Interpreter container: ${OCI_GENAI_CODE_INTERPRETER_CONTAINER}"
  else
    echo "Runtime Code Interpreter container: not found yet."
  fi
}

terraform_init() {
  local module_path="$1"
  echo "Initializing Terraform module ${module_path}."
  terraform -chdir="$module_path" init
}

apply_shared_module() {
  local module_path="infra/shared-demo-security"

  if [[ -z "${OCI_TENANCY_ID:-}" ]]; then
    echo "OCI_TENANCY_ID is required to create the shared Enterprise AI demo dynamic group." >&2
    echo "Set OCI_TENANCY_ID or configure tenancy in ~/.oci/config profile ${OCI_PROFILE}." >&2
    return 1
  fi

  terraform_init "$module_path"
  echo "Applying Terraform module ${module_path}."
  terraform -chdir="$module_path" apply -auto-approve \
    -var="tenancy_id=${OCI_TENANCY_ID}" \
    -var="compartment_id=${OCI_GENAI_COMPARTMENT_ID}" \
    -var="region=${OCI_GENAI_REGION}" \
    -var="resource_suffix=${RESOURCE_SUFFIX}"
}

destroy_shared_module() {
  local module_path="infra/shared-demo-security"

  if [[ -z "${OCI_TENANCY_ID:-}" ]]; then
    echo "OCI_TENANCY_ID is required to destroy the shared Enterprise AI demo dynamic group." >&2
    echo "Set OCI_TENANCY_ID or configure tenancy in ~/.oci/config profile ${OCI_PROFILE}." >&2
    return 1
  fi

  terraform_init "$module_path"
  echo "Destroying Terraform module ${module_path}."
  terraform -chdir="$module_path" destroy -auto-approve \
    -var="tenancy_id=${OCI_TENANCY_ID}" \
    -var="compartment_id=${OCI_GENAI_COMPARTMENT_ID}" \
    -var="region=${OCI_GENAI_REGION}" \
    -var="resource_suffix=${RESOURCE_SUFFIX}"
}

apply_demo_module() {
  local demo_id="$1"
  local module_path="infra/${demo_id}"

  if [[ ! -d "$module_path" ]]; then
    echo "Skipping unknown demo Terraform module ${module_path}."
    return 0
  fi

  case "$demo_id" in
    conversation-store)
      terraform_init "$module_path"
      echo "Applying Terraform module ${module_path}."
      terraform -chdir="$module_path" apply -auto-approve \
        -var="region=${OCI_GENAI_REGION}" \
        -var="resource_suffix=${RESOURCE_SUFFIX}"
      ;;
    file-search-vector-store-rag)
      terraform_init "$module_path"
      echo "Applying Terraform module ${module_path}."
      terraform -chdir="$module_path" apply -auto-approve \
        -var="compartment_id=${OCI_GENAI_COMPARTMENT_ID}" \
        -var="region=${OCI_GENAI_REGION}" \
        -var="profile=${OCI_PROFILE}" \
        -var="resource_suffix=${RESOURCE_SUFFIX}"
      ;;
    code-interpreter)
      terraform_init "$module_path"
      echo "Applying Terraform module ${module_path}."
      terraform -chdir="$module_path" apply -auto-approve \
        -var="region=${OCI_GENAI_REGION}" \
        -var="resource_suffix=${RESOURCE_SUFFIX}"
      ;;
    nl2sql-sql-search)
      terraform_init "$module_path"
      echo "Applying Terraform module ${module_path}."
      terraform -chdir="$module_path" apply -auto-approve \
        -var="compartment_id=${OCI_GENAI_COMPARTMENT_ID}" \
        -var="region=${OCI_GENAI_REGION}" \
        -var="resource_suffix=${RESOURCE_SUFFIX}"
      ;;
    hosted-agentic-applications)
      if [[ -z "${OCI_HOSTED_APP_IDCS_DOMAIN_URL:-}" || -z "${OCI_HOSTED_APP_IDCS_AUDIENCE:-}" || -z "${OCI_HOSTED_APP_IDCS_SCOPE:-}" ]]; then
        echo "Hosted Agentic Applications provisioning requires an existing IDCS domain configuration." >&2
        echo "Set OCI_HOSTED_APP_IDCS_DOMAIN_URL, OCI_HOSTED_APP_IDCS_AUDIENCE, and OCI_HOSTED_APP_IDCS_SCOPE." >&2
        return 1
      fi
      terraform_init "$module_path"
      echo "Applying Terraform module ${module_path}."
      terraform -chdir="$module_path" apply -auto-approve \
        -var="compartment_id=${OCI_GENAI_COMPARTMENT_ID}" \
        -var="region=${OCI_GENAI_REGION}" \
        -var="profile=${OCI_PROFILE}" \
        -var="resource_suffix=${RESOURCE_SUFFIX}" \
        -var="container_cli=${OCI_HOSTED_APP_CONTAINER_CLI:-podman}" \
        -var="ocir_region_key=${OCI_HOSTED_APP_OCIR_REGION_KEY:-ord}" \
        -var="idcs_domain_url=${OCI_HOSTED_APP_IDCS_DOMAIN_URL}" \
        -var="idcs_audience=${OCI_HOSTED_APP_IDCS_AUDIENCE}" \
        -var="idcs_scope=${OCI_HOSTED_APP_IDCS_SCOPE}" \
        -var="langfuse_image_repository_uri=${OCI_HOSTED_LANGFUSE_IMAGE_REPOSITORY_URI:-}" \
        -var="langfuse_database_url=${LANGFUSE_DATABASE_URL:-}" \
        -var="langfuse_clickhouse_url=${LANGFUSE_CLICKHOUSE_URL:-}" \
        -var="langfuse_clickhouse_migration_url=${LANGFUSE_CLICKHOUSE_MIGRATION_URL:-}" \
        -var="langfuse_clickhouse_user=${LANGFUSE_CLICKHOUSE_USER:-}" \
        -var="langfuse_clickhouse_password=${LANGFUSE_CLICKHOUSE_PASSWORD:-}" \
        -var="langfuse_redis_connection_string=${LANGFUSE_REDIS_CONNECTION_STRING:-}" \
        -var="langfuse_s3_event_upload_bucket=${LANGFUSE_S3_EVENT_UPLOAD_BUCKET:-}" \
        -var="langfuse_s3_media_upload_bucket=${LANGFUSE_S3_MEDIA_UPLOAD_BUCKET:-}" \
        -var="langfuse_s3_upload_region=${LANGFUSE_S3_UPLOAD_REGION:-auto}" \
        -var="langfuse_s3_upload_endpoint=${LANGFUSE_S3_UPLOAD_ENDPOINT:-}" \
        -var="langfuse_s3_upload_access_key_id=${LANGFUSE_S3_UPLOAD_ACCESS_KEY_ID:-}" \
        -var="langfuse_s3_upload_secret_access_key=${LANGFUSE_S3_UPLOAD_SECRET_ACCESS_KEY:-}" \
        -var="langfuse_nextauth_secret=${LANGFUSE_NEXTAUTH_SECRET:-}" \
        -var="langfuse_salt=${LANGFUSE_SALT:-}" \
        -var="langfuse_encryption_key=${LANGFUSE_ENCRYPTION_KEY:-}" \
        -var="langfuse_init_user_email=${LANGFUSE_INIT_USER_EMAIL:-}" \
        -var="langfuse_init_user_password=${LANGFUSE_INIT_USER_PASSWORD:-}" \
        -var="openclaw_image_repository_uri=${OCI_HOSTED_OPENCLAW_IMAGE_REPOSITORY_URI:-}" \
        -var="openclaw_gateway_token=${OPENCLAW_GATEWAY_TOKEN:-}" \
        -var="llamaindex_image_repository_uri=${OCI_HOSTED_LLAMAINDEX_IMAGE_REPOSITORY_URI:-}"
      ;;
    *)
      terraform_init "$module_path"
      echo "Applying Terraform module ${module_path}."
      terraform -chdir="$module_path" apply -auto-approve
      ;;
  esac
}

destroy_demo_module() {
  local demo_id="$1"
  local module_path="infra/${demo_id}"

  if [[ ! -d "$module_path" ]]; then
    echo "Skipping unknown demo Terraform module ${module_path}."
    return 0
  fi

  case "$demo_id" in
    conversation-store)
      terraform_init "$module_path"
      echo "Destroying Terraform module ${module_path}."
      terraform -chdir="$module_path" destroy -auto-approve \
        -var="region=${OCI_GENAI_REGION}" \
        -var="resource_suffix=${RESOURCE_SUFFIX}"
      ;;
    file-search-vector-store-rag)
      terraform_init "$module_path"
      echo "Destroying Terraform module ${module_path}."
      terraform -chdir="$module_path" destroy -auto-approve \
        -var="compartment_id=${OCI_GENAI_COMPARTMENT_ID}" \
        -var="region=${OCI_GENAI_REGION}" \
        -var="profile=${OCI_PROFILE}" \
        -var="resource_suffix=${RESOURCE_SUFFIX}"
      ;;
    code-interpreter)
      terraform_init "$module_path"
      echo "Destroying Terraform module ${module_path}."
      terraform -chdir="$module_path" destroy -auto-approve \
        -var="region=${OCI_GENAI_REGION}" \
        -var="resource_suffix=${RESOURCE_SUFFIX}"
      ;;
    nl2sql-sql-search)
      terraform_init "$module_path"
      echo "Destroying Terraform module ${module_path}."
      terraform -chdir="$module_path" destroy -auto-approve \
        -var="compartment_id=${OCI_GENAI_COMPARTMENT_ID}" \
        -var="region=${OCI_GENAI_REGION}" \
        -var="resource_suffix=${RESOURCE_SUFFIX}"
      ;;
    hosted-agentic-applications)
      terraform_init "$module_path"
      echo "Destroying Terraform module ${module_path}."
      terraform -chdir="$module_path" destroy -auto-approve \
        -var="compartment_id=${OCI_GENAI_COMPARTMENT_ID}" \
        -var="region=${OCI_GENAI_REGION}" \
        -var="profile=${OCI_PROFILE}" \
        -var="resource_suffix=${RESOURCE_SUFFIX}" \
        -var="container_cli=${OCI_HOSTED_APP_CONTAINER_CLI:-podman}" \
        -var="ocir_region_key=${OCI_HOSTED_APP_OCIR_REGION_KEY:-ord}" \
        -var="idcs_domain_url=${OCI_HOSTED_APP_IDCS_DOMAIN_URL:-unused}" \
        -var="idcs_audience=${OCI_HOSTED_APP_IDCS_AUDIENCE:-unused}" \
        -var="idcs_scope=${OCI_HOSTED_APP_IDCS_SCOPE:-unused}" \
        -var="langfuse_image_repository_uri=${OCI_HOSTED_LANGFUSE_IMAGE_REPOSITORY_URI:-}" \
        -var="langfuse_database_url=${LANGFUSE_DATABASE_URL:-}" \
        -var="langfuse_clickhouse_url=${LANGFUSE_CLICKHOUSE_URL:-}" \
        -var="langfuse_clickhouse_migration_url=${LANGFUSE_CLICKHOUSE_MIGRATION_URL:-}" \
        -var="langfuse_clickhouse_user=${LANGFUSE_CLICKHOUSE_USER:-}" \
        -var="langfuse_clickhouse_password=${LANGFUSE_CLICKHOUSE_PASSWORD:-}" \
        -var="langfuse_redis_connection_string=${LANGFUSE_REDIS_CONNECTION_STRING:-}" \
        -var="langfuse_s3_event_upload_bucket=${LANGFUSE_S3_EVENT_UPLOAD_BUCKET:-}" \
        -var="langfuse_s3_media_upload_bucket=${LANGFUSE_S3_MEDIA_UPLOAD_BUCKET:-}" \
        -var="langfuse_s3_upload_region=${LANGFUSE_S3_UPLOAD_REGION:-auto}" \
        -var="langfuse_s3_upload_endpoint=${LANGFUSE_S3_UPLOAD_ENDPOINT:-}" \
        -var="langfuse_s3_upload_access_key_id=${LANGFUSE_S3_UPLOAD_ACCESS_KEY_ID:-}" \
        -var="langfuse_s3_upload_secret_access_key=${LANGFUSE_S3_UPLOAD_SECRET_ACCESS_KEY:-}" \
        -var="langfuse_nextauth_secret=${LANGFUSE_NEXTAUTH_SECRET:-}" \
        -var="langfuse_salt=${LANGFUSE_SALT:-}" \
        -var="langfuse_encryption_key=${LANGFUSE_ENCRYPTION_KEY:-}" \
        -var="langfuse_init_user_email=${LANGFUSE_INIT_USER_EMAIL:-}" \
        -var="langfuse_init_user_password=${LANGFUSE_INIT_USER_PASSWORD:-}" \
        -var="openclaw_image_repository_uri=${OCI_HOSTED_OPENCLAW_IMAGE_REPOSITORY_URI:-}" \
        -var="openclaw_gateway_token=${OPENCLAW_GATEWAY_TOKEN:-}" \
        -var="llamaindex_image_repository_uri=${OCI_HOSTED_LLAMAINDEX_IMAGE_REPOSITORY_URI:-}"
      ;;
    *)
      terraform_init "$module_path"
      echo "Destroying Terraform module ${module_path}."
      terraform -chdir="$module_path" destroy -auto-approve
      ;;
  esac
}

if [[ "${PROVISION_INFRA:-false}" == "true" ]]; then
  echo "Provisioning Responses API infrastructure before startup."
  echo "Compartment: ${OCI_GENAI_COMPARTMENT_ID}"
  echo "Region: ${OCI_GENAI_REGION}"
  echo "OCI profile: ${OCI_PROFILE}"
  echo "Tenancy: ${OCI_TENANCY_ID:-not configured}"
  echo "Resource suffix: ${RESOURCE_SUFFIX}"
  if command -v terraform >/dev/null 2>&1; then
    terraform_init "infra/responses-api"
    echo "Applying Terraform module infra/responses-api."
    terraform -chdir=infra/responses-api apply -auto-approve \
      -var="compartment_id=${OCI_GENAI_COMPARTMENT_ID}" \
      -var="region=${OCI_GENAI_REGION}" \
      -var="profile=${OCI_PROFILE}" \
      -var="project_display_name=${OCI_GENAI_PROJECT_DISPLAY_NAME}" \
      -var="resource_suffix=${RESOURCE_SUFFIX}"
  elif command -v oci >/dev/null 2>&1; then
    oci generative-ai generative-ai-project create \
      --compartment-id "${OCI_GENAI_COMPARTMENT_ID}" \
      --display-name "${OCI_GENAI_PROJECT_DISPLAY_NAME}" \
      --profile "${OCI_PROFILE}" \
      --region "${OCI_GENAI_REGION}" \
      --wait-for-state SUCCEEDED \
      --output json
  else
    echo "Terraform or OCI CLI is required when PROVISION_INFRA=true."
    exit 1
  fi

  if [[ "$PROVISION_SHARED_INFRA" == "true" ]]; then
    if ! command -v terraform >/dev/null 2>&1; then
      echo "Terraform is required to provision shared demo infrastructure."
      exit 1
    fi
    echo "Provisioning shared demo Terraform module: infra/shared-demo-security"
    apply_shared_module
  fi

  PROVISION_DEMOS="${PROVISION_DEMOS:-conversation-store,file-search-vector-store-rag,code-interpreter,nl2sql-sql-search,hosted-agentic-applications}"
  if [[ -n "$PROVISION_DEMOS" ]]; then
    if ! command -v terraform >/dev/null 2>&1; then
      echo "Terraform is required to provision demo modules."
      exit 1
    fi
    echo "Provisioning demo Terraform modules: ${PROVISION_DEMOS}"
    IFS=',' read -ra demo_modules <<< "$PROVISION_DEMOS"
    for demo_id in "${demo_modules[@]}"; do
      demo_id="$(echo "$demo_id" | xargs)"
      if [[ -n "$demo_id" ]]; then
        set +e
        apply_demo_module "$demo_id"
        demo_status=$?
        set -e
        if [[ "$demo_status" -ne 0 ]]; then
          if [[ "$REQUIRE_DEMO_INFRA" != "true" ]]; then
            echo "Demo Terraform module ${demo_id} failed with status ${demo_status}; continuing startup because REQUIRE_DEMO_INFRA is not true."
          else
            exit "$demo_status"
          fi
        fi
      fi
    done
  fi
fi

if [[ "${DESTROY_INFRA:-false}" == "true" ]]; then
  echo "Destroying Enterprise AI demo infrastructure."
  echo "Compartment: ${OCI_GENAI_COMPARTMENT_ID}"
  echo "Region: ${OCI_GENAI_REGION}"
  echo "OCI profile: ${OCI_PROFILE}"
  echo "Tenancy: ${OCI_TENANCY_ID:-not configured}"
  echo "Resource suffix: ${RESOURCE_SUFFIX}"

  if ! command -v terraform >/dev/null 2>&1; then
    echo "Terraform is required when DESTROY_INFRA=true."
    exit 1
  fi

  DESTROY_DEMOS="${DESTROY_DEMOS:-hosted-agentic-applications,nl2sql-sql-search,code-interpreter,file-search-vector-store-rag,conversation-store}"
  if [[ -n "$DESTROY_DEMOS" ]]; then
    echo "Destroying demo Terraform modules: ${DESTROY_DEMOS}"
    IFS=',' read -ra destroy_modules <<< "$DESTROY_DEMOS"
    for demo_id in "${destroy_modules[@]}"; do
      demo_id="$(echo "$demo_id" | xargs)"
      if [[ -n "$demo_id" ]]; then
        destroy_demo_module "$demo_id"
      fi
    done
  fi

  if [[ "$PROVISION_SHARED_INFRA" == "true" ]]; then
    destroy_shared_module
  fi

  terraform_init "infra/responses-api"
  echo "Destroying Terraform module infra/responses-api."
  terraform -chdir=infra/responses-api destroy -auto-approve \
    -var="compartment_id=${OCI_GENAI_COMPARTMENT_ID}" \
    -var="region=${OCI_GENAI_REGION}" \
    -var="profile=${OCI_PROFILE}" \
    -var="project_display_name=${OCI_GENAI_PROJECT_DISPLAY_NAME}" \
    -var="resource_suffix=${RESOURCE_SUFFIX}"

  echo "Infrastructure cleanup complete."
  exit 0
fi

export_generated_runtime_ids
echo "Starting Enterprise AI demo portal at http://localhost:${PORT:-5173}"
node server.mjs
