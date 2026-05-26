resource "terraform_data" "langfuse_hosted_observability" {
  count = var.hosted_cli_deployments_enabled ? 1 : 0

  triggers_replace = [
    "20260521-clickhouse-migration-credentials",
    var.resource_suffix,
    var.langfuse_repository_name,
    var.langfuse_image_repository_uri,
    var.image_tag,
    var.idcs_domain_url,
    var.idcs_audience,
    var.idcs_scope,
    oci_psql_db_system.langfuse.id,
    oci_container_instances_container_instance.langfuse_clickhouse.id,
    oci_container_instances_container_instance.langfuse_redis.id,
    oci_objectstorage_bucket.langfuse.id,
    var.hosted_image_build_run_id
  ]

  input = {
    app_source_dir                  = abspath("${path.module}/${var.langfuse_app_source_dir}")
    compartment_id                  = var.compartment_id
    generated_dir                   = local.generated_dir
    hosted_application_display_name = local.langfuse_application_display_name
    hosted_deployment_display_name  = local.langfuse_deployment_display_name
    hosted_image_build_run_id       = var.hosted_image_build_run_id
    image_tag                       = var.image_tag
    container_cli                   = var.container_cli
    idcs_domain_url                 = var.idcs_domain_url
    idcs_audience                   = var.idcs_audience
    idcs_scope                      = var.idcs_scope
    langfuse_image_repository_uri   = var.langfuse_image_repository_uri
    networking_config_json          = local.langfuse_hosted_networking_config_json
    ocir_region_key                 = var.ocir_region_key
    profile                         = var.profile
    provisioning_revision           = "20260521-clickhouse-migration-credentials"
    push_image                      = var.push_image
    region                          = var.region
    repository_name                 = local.langfuse_repository_name
    repository_managed_by_terraform = var.langfuse_image_repository_uri == ""
    scaling_type                    = var.scaling_type
  }

  provisioner "local-exec" {
    environment = {
      LANGFUSE_DATABASE_URL                = local.langfuse_effective_database_url
      LANGFUSE_CLICKHOUSE_URL              = local.langfuse_effective_clickhouse_url
      LANGFUSE_CLICKHOUSE_MIGRATION_URL    = local.langfuse_effective_clickhouse_migration_url
      LANGFUSE_CLICKHOUSE_USER             = local.langfuse_effective_clickhouse_user
      LANGFUSE_CLICKHOUSE_PASSWORD         = local.langfuse_effective_clickhouse_password
      LANGFUSE_REDIS_CONNECTION_STRING     = local.langfuse_effective_redis_connection_string
      LANGFUSE_S3_EVENT_UPLOAD_BUCKET      = local.langfuse_effective_s3_event_upload_bucket
      LANGFUSE_S3_MEDIA_UPLOAD_BUCKET      = local.langfuse_effective_s3_media_upload_bucket
      LANGFUSE_S3_UPLOAD_REGION            = local.langfuse_effective_s3_upload_region
      LANGFUSE_S3_UPLOAD_ENDPOINT          = local.langfuse_effective_s3_upload_endpoint
      LANGFUSE_S3_UPLOAD_ACCESS_KEY_ID     = var.langfuse_s3_upload_access_key_id
      LANGFUSE_S3_UPLOAD_SECRET_ACCESS_KEY = var.langfuse_s3_upload_secret_access_key
      LANGFUSE_NEXTAUTH_SECRET             = local.langfuse_effective_nextauth_secret
      LANGFUSE_SALT                        = local.langfuse_effective_salt
      LANGFUSE_ENCRYPTION_KEY              = local.langfuse_effective_encryption_key
      LANGFUSE_INIT_USER_EMAIL             = var.langfuse_init_user_email
      LANGFUSE_INIT_USER_PASSWORD          = var.langfuse_init_user_password
    }

    command = <<-EOT
      set -euo pipefail
      mkdir -p '${self.input.generated_dir}'

      oci_auth_args="--auth resource_principal"
      if [ -n '${self.input.profile}' ]; then
        oci_auth_args="--profile '${self.input.profile}'"
      fi

      image_repository_uri='${self.input.langfuse_image_repository_uri}'
      repository_lookup_name='${self.input.repository_name}'
      if [ -n "$image_repository_uri" ]; then
        repository_lookup_name="$${image_repository_uri#*/}"
        repository_lookup_name="$${repository_lookup_name#*/}"
      fi
      existing_repository_json="$(oci artifacts container repository list \
          --compartment-id '${self.input.compartment_id}' \
          --display-name "$repository_lookup_name" \
          $oci_auth_args \
          --region '${self.input.region}' \
          --output json)"
      repository_json="$(python3 - <<PY
import json
payload = json.loads('''$existing_repository_json''')
data = payload.get('data') or {}
items = data.get('items') if isinstance(data, dict) else data
items = items or []
if items:
    print(json.dumps({'data': items[0]}))
PY
      )"
      if [ -z "$repository_json" ] && [ -z "$image_repository_uri" ]; then
        repository_json="$(oci artifacts container repository create \
            --compartment-id '${self.input.compartment_id}' \
            --display-name '${self.input.repository_name}' \
            --is-public false \
            $oci_auth_args \
            --region '${self.input.region}' \
            --wait-for-state AVAILABLE \
            --output json)"
      fi
      if [ -z "$repository_json" ]; then
        repository_json='{"data":{}}'
      fi
      printf '%s\n' "$repository_json" > '${self.input.generated_dir}/langfuse_ocir_repository.json'

      if [ -z "$image_repository_uri" ]; then
        namespace="$(oci os ns get \
          $oci_auth_args \
          --region '${self.input.region}' \
          --query 'data' \
          --raw-output)"
        region_key='${self.input.ocir_region_key}'
        image_repository_uri="$${region_key}.ocir.io/$${namespace}/${self.input.repository_name}"
      fi
      image_uri="$${image_repository_uri}:${self.input.image_tag}"

      if [ '${self.input.push_image}' = 'true' ] && [ -z '${self.input.langfuse_image_repository_uri}' ]; then
        '${self.input.container_cli}' build --platform linux/amd64 -t "$image_uri" '${self.input.app_source_dir}'
        '${self.input.container_cli}' push "$image_uri"
      else
        echo "Skipping docker build/push. Expected image URI: $image_uri"
      fi

      application_file='${self.input.generated_dir}/langfuse_hosted_application.json'
      application_raw_file="$(mktemp)"
      deployment_file='${self.input.generated_dir}/langfuse_hosted_deployment.json'

      inbound_auth_config="$(python3 - <<PY
import json
print(json.dumps({
    "inboundAuthConfigType": "IDCS_AUTH_CONFIG",
    "idcsConfig": {
        "domainUrl": "${self.input.idcs_domain_url}",
        "audience": "${self.input.idcs_audience}",
        "scope": "${self.input.idcs_scope}",
    },
}))
PY
      )"
      environment_variables="$(python3 - <<'PY'
import json
import os
import secrets

def secret(name, generated=None):
    return os.environ.get(name) or generated or secrets.token_urlsafe(32)

encryption_key = os.environ.get("LANGFUSE_ENCRYPTION_KEY") or secrets.token_hex(32)
values = {
    "NEXTAUTH_URL": "http://0.0.0.0:3000",
    "NEXTAUTH_SECRET": secret("LANGFUSE_NEXTAUTH_SECRET"),
    "SALT": secret("LANGFUSE_SALT"),
    "ENCRYPTION_KEY": encryption_key,
    "DATABASE_URL": os.environ.get("LANGFUSE_DATABASE_URL", ""),
    "CLICKHOUSE_URL": os.environ.get("LANGFUSE_CLICKHOUSE_URL", ""),
    "CLICKHOUSE_USER": os.environ.get("LANGFUSE_CLICKHOUSE_USER", ""),
    "CLICKHOUSE_PASSWORD": os.environ.get("LANGFUSE_CLICKHOUSE_PASSWORD", ""),
    "CLICKHOUSE_CLUSTER_ENABLED": "false",
    "LANGFUSE_AUTO_CLICKHOUSE_MIGRATION_DISABLED": "true",
    "REDIS_CONNECTION_STRING": os.environ.get("LANGFUSE_REDIS_CONNECTION_STRING", ""),
    "LANGFUSE_USE_OCI_NATIVE_OBJECT_STORAGE": "true",
    "LANGFUSE_OCI_AUTH_TYPE": "resource_principal",
    "LANGFUSE_S3_EVENT_UPLOAD_BUCKET": os.environ.get("LANGFUSE_S3_EVENT_UPLOAD_BUCKET", ""),
    "LANGFUSE_S3_EVENT_UPLOAD_REGION": os.environ.get("LANGFUSE_S3_UPLOAD_REGION", "auto"),
    "LANGFUSE_S3_EVENT_UPLOAD_ENDPOINT": os.environ.get("LANGFUSE_S3_UPLOAD_ENDPOINT", ""),
    "LANGFUSE_S3_EVENT_UPLOAD_FORCE_PATH_STYLE": "true",
    "LANGFUSE_S3_MEDIA_UPLOAD_BUCKET": os.environ.get("LANGFUSE_S3_MEDIA_UPLOAD_BUCKET", ""),
    "LANGFUSE_S3_MEDIA_UPLOAD_REGION": os.environ.get("LANGFUSE_S3_UPLOAD_REGION", "auto"),
    "LANGFUSE_S3_MEDIA_UPLOAD_ENDPOINT": os.environ.get("LANGFUSE_S3_UPLOAD_ENDPOINT", ""),
}
print(json.dumps([{"name": name, "type": "PLAINTEXT", "value": value} for name, value in values.items()]))
PY
      )"
      oci generative-ai hosted-application create \
        --compartment-id '${self.input.compartment_id}' \
        --display-name '${self.input.hosted_application_display_name}' \
        --description 'Enterprise AI demo Langfuse hosted observability application.' \
        --scaling-config '{"scalingType":"${self.input.scaling_type}","minReplica":1,"maxReplica":1,"targetRpsThreshold":10}' \
        --environment-variables "$environment_variables" \
        --inbound-auth-config "$inbound_auth_config" \
        --networking-config '${self.input.networking_config_json}' \
        --freeform-tags '{"enterprise-ai-demo":"true","demo":"langfuse-hosted-observability"}' \
        $oci_auth_args \
        --region '${self.input.region}' \
        --wait-for-state SUCCEEDED \
        --max-wait-seconds 1200 \
        --output json > "$application_raw_file"
      python3 - "$application_raw_file" "$application_file" <<'PY'
import json
import sys
from pathlib import Path

def load_json(path):
    text = Path(path).read_text()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find('{')
        end = text.rfind('}')
        if start >= 0 and end > start:
            return json.loads(text[start:end + 1])
        raise

def redact(value):
    if isinstance(value, dict):
        return {key: redact(item) for key, item in value.items()}
    if isinstance(value, list):
        return [
            {**item, "value": "<redacted>"}
            if isinstance(item, dict) and item.get("name") in {"DATABASE_URL", "CLICKHOUSE_PASSWORD", "REDIS_CONNECTION_STRING", "NEXTAUTH_SECRET", "SALT", "ENCRYPTION_KEY", "LANGFUSE_INIT_USER_PASSWORD", "LANGFUSE_S3_EVENT_UPLOAD_ACCESS_KEY_ID", "LANGFUSE_S3_EVENT_UPLOAD_SECRET_ACCESS_KEY", "LANGFUSE_S3_MEDIA_UPLOAD_ACCESS_KEY_ID", "LANGFUSE_S3_MEDIA_UPLOAD_SECRET_ACCESS_KEY"}
            else redact(item)
            for item in value
        ]
    return value

Path(sys.argv[2]).write_text(json.dumps(redact(load_json(sys.argv[1])), indent=2))
PY
      rm -f "$application_raw_file"
      hosted_application_id="$(python3 - "$application_file" <<'PY'
import json
import sys
from pathlib import Path

payload=json.loads(Path(sys.argv[1]).read_text())
data=payload.get('data', payload)
resources = data.get('resources') or []
identifier = ''
for resource in resources:
    if resource.get('entity-type') == 'HOSTED_APPLICATION' and resource.get('identifier'):
        identifier = resource['identifier']
        break
print(identifier or data.get('hosted-application-id') or data.get('hostedApplicationId') or data.get('id', ''))
PY
      )"
      if [ -z "$hosted_application_id" ]; then
        echo "OCI Langfuse hosted application create response did not include an id." >&2
        exit 1
      fi

      oci generative-ai hosted-deployment create-hosted-deployment-single-docker-artifact \
        --hosted-application-id "$hosted_application_id" \
        --compartment-id '${self.input.compartment_id}' \
        --display-name '${self.input.hosted_deployment_display_name}' \
        --active-artifact-container-uri "$image_repository_uri" \
        --active-artifact-tag '${self.input.image_tag}' \
        --active-artifact-status ACTIVE \
        --freeform-tags '{"enterprise-ai-demo":"true","demo":"langfuse-hosted-observability"}' \
        $oci_auth_args \
        --region '${self.input.region}' \
        --output json > "$deployment_file"
      hosted_deployment_id="$(python3 - "$deployment_file" <<'PY'
import json
import sys
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text()).get("data", {})
print(data.get("id", ""))
PY
      )"
      if [ -n "$hosted_deployment_id" ]; then
        for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
          oci generative-ai hosted-deployment get \
            --hosted-deployment-id "$hosted_deployment_id" \
            $oci_auth_args \
            --region '${self.input.region}' \
            --output json > "$deployment_file"
          deployment_state="$(python3 - "$deployment_file" <<'PY'
import json
import sys
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text()).get("data", {})
print(data.get("lifecycle-state", ""))
PY
          )"
          if [ "$deployment_state" = "ACTIVE" ] || [ "$deployment_state" = "FAILED" ]; then
            break
          fi
          sleep 10
        done
      fi

      python3 - <<PY
import json
from pathlib import Path

generated = Path('${self.input.generated_dir}')
repository = json.loads((generated / 'langfuse_ocir_repository.json').read_text()).get('data', {})
application = json.loads((generated / 'langfuse_hosted_application.json').read_text()).get('data', {})
deployment = json.loads((generated / 'langfuse_hosted_deployment.json').read_text()).get('data', {})
def resource_identifier(payload, entity_type):
    for resource in payload.get('resources') or []:
        if resource.get('entity-type') == entity_type and resource.get('identifier'):
            return resource['identifier']
    return ''
hosted_application_id = resource_identifier(application, 'HOSTED_APPLICATION') or application.get('id', '')
endpoint = (
    deployment.get('endpoint')
    or deployment.get('invoke-endpoint')
    or deployment.get('invokeEndpoint')
    or application.get('endpoint')
    or (f"https://application.generativeai.${self.input.region}.oci.oraclecloud.com/20251112/hostedApplications/{hosted_application_id}/actions/invoke/" if hosted_application_id else "")
)
runtime = {
    'repositoryId': repository.get('id', ''),
    'repositoryName': '${self.input.repository_name}',
    'imageUri': '$image_uri',
    'runtime': 'langfuse',
    'hostedApplicationId': hosted_application_id,
    'hostedApplicationDisplayName': application.get('display-name') or application.get('displayName') or '${self.input.hosted_application_display_name}',
    'hostedApplicationLifecycleState': application.get('lifecycle-state') or application.get('lifecycleState') or '',
    'hostedDeploymentId': resource_identifier(deployment, 'HOSTED_DEPLOYMENT') or deployment.get('id', ''),
    'hostedDeploymentDisplayName': deployment.get('display-name') or deployment.get('displayName') or '${self.input.hosted_deployment_display_name}',
    'hostedDeploymentLifecycleState': deployment.get('lifecycle-state') or deployment.get('lifecycleState') or '',
    'endpoint': endpoint,
    'url': endpoint,
}
(generated / 'langfuse_hosted_observability.json').write_text(json.dumps(runtime, indent=2))
print(json.dumps(runtime, indent=2))
PY
    EOT
  }

  provisioner "local-exec" {
    when    = destroy
    command = <<-EOT
      set -euo pipefail
      runtime_file='${self.input.generated_dir}/langfuse_hosted_observability.json'
      hosted_application_file='${self.input.generated_dir}/langfuse_hosted_application.json'
      hosted_deployment_file='${self.input.generated_dir}/langfuse_hosted_deployment.json'
      repository_file='${self.input.generated_dir}/langfuse_ocir_repository.json'
      ids="$(python3 - "$runtime_file" "$hosted_application_file" "$hosted_deployment_file" <<'PY'
import json
import sys
from pathlib import Path

def load_json(path):
    path = Path(path)
    if not path.exists():
        return {}
    return json.loads(path.read_text())

def resource_identifier(payload, entity_type):
    data = payload.get("data", payload)
    for resource in data.get("resources") or []:
        if resource.get("entity-type") == entity_type and resource.get("identifier"):
            return resource["identifier"]
    return ""

runtime = load_json(sys.argv[1])
application = load_json(sys.argv[2])
deployment = load_json(sys.argv[3])
deployment_data = deployment.get("data", deployment)
application_data = application.get("data", application)
deployment_id = runtime.get("hostedDeploymentId") or resource_identifier(deployment, "HOSTED_DEPLOYMENT") or deployment_data.get("id", "")
application_id = runtime.get("hostedApplicationId") or resource_identifier(application, "HOSTED_APPLICATION") or deployment_data.get("hosted-application-id", "") or deployment_data.get("hostedApplicationId", "") or application_data.get("id", "")
print(deployment_id)
print(application_id)
PY
      )"
      hosted_deployment_id="$(printf '%s\n' "$ids" | sed -n '1p')"
      hosted_application_id="$(printf '%s\n' "$ids" | sed -n '2p')"
      if [ -n "$hosted_deployment_id" ]; then
          oci generative-ai hosted-deployment delete \
            --hosted-deployment-id "$hosted_deployment_id" \
            --force \
            $oci_auth_args \
            --region '${self.input.region}' \
            --wait-for-state SUCCEEDED || true
      fi
      if [ -n "$hosted_application_id" ]; then
          oci generative-ai hosted-application delete \
            --hosted-application-id "$hosted_application_id" \
            --force \
            $oci_auth_args \
            --region '${self.input.region}' \
            --wait-for-state SUCCEEDED || true
      fi
      if [ -f "$repository_file" ]; then
        repository_id="$(python3 -c 'import json, pathlib, sys; print(json.loads(pathlib.Path(sys.argv[1]).read_text()).get("data", {}).get("id", ""))' "$repository_file")"
        if [ -n "$repository_id" ]; then
          image_ids="$(oci artifacts container image list \
            --compartment-id '${self.input.compartment_id}' \
            --repository-id "$repository_id" \
            $oci_auth_args \
            --region '${self.input.region}' \
            --all \
            --query 'data[].id' \
            --raw-output 2>/dev/null || true)"
          for image_id in $image_ids; do
            if [ -n "$image_id" ]; then
              oci artifacts container image delete \
                --image-id "$image_id" \
                --force \
                $oci_auth_args \
                --region '${self.input.region}' \
                --wait-for-state DELETED || true
            fi
          done
        fi
        if [ '${self.input.repository_managed_by_terraform}' != 'true' ] && [ -n "$repository_id" ]; then
          oci artifacts container repository delete \
            --repository-id "$repository_id" \
            --force \
            $oci_auth_args \
            --region '${self.input.region}' \
            --wait-for-state DELETED || true
        fi
      fi
      rm -f "$runtime_file" "$hosted_deployment_file" "$hosted_application_file" "$repository_file"
    EOT
  }

  depends_on = [oci_artifacts_container_repository.langfuse]
}
