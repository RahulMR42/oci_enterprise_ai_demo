resource "terraform_data" "n8n_hosted_workflow_automation" {
  count = var.hosted_cli_deployments_enabled ? 1 : 0

  triggers_replace = [
    "20260515-add-n8n-hosted-workflow",
    var.resource_suffix,
    var.n8n_repository_name,
    var.n8n_image_repository_uri,
    var.image_tag,
    local.n8n_idcs_domain_url,
    local.n8n_idcs_audience,
    local.n8n_idcs_scope,
    var.n8n_idcs_launch_client_enabled ? oci_identity_domains_app.n8n_launch_client[0].id : "shared-idcs-launch-client",
    var.n8n_basic_auth_user,
    var.hosted_image_build_run_id
  ]

  input = {
    app_source_dir                  = abspath("${path.module}/${var.n8n_app_source_dir}")
    compartment_id                  = var.compartment_id
    generated_dir                   = local.generated_dir
    hosted_application_display_name = local.n8n_application_display_name
    hosted_deployment_display_name  = local.n8n_deployment_display_name
    hosted_image_build_run_id       = var.hosted_image_build_run_id
    image_tag                       = var.image_tag
    container_cli                   = var.container_cli
    idcs_domain_url                 = local.n8n_idcs_domain_url
    idcs_audience                   = local.n8n_idcs_audience
    idcs_scope                      = local.n8n_idcs_scope
    n8n_idcs_launch_client_id       = var.n8n_idcs_launch_client_enabled ? oci_identity_domains_app.n8n_launch_client[0].id : ""
    n8n_basic_auth_user             = var.n8n_basic_auth_user
    n8n_image_repository_uri        = var.n8n_image_repository_uri
    ocir_region_key                 = var.ocir_region_key
    profile                         = var.profile
    provisioning_revision           = "20260519-upgrade-n8n-stable"
    push_image                      = var.push_image
    region                          = var.region
    repository_name                 = local.n8n_repository_name
    repository_managed_by_terraform = var.n8n_image_repository_uri == ""
    scaling_type                    = var.scaling_type
  }

  depends_on = [
    oci_artifacts_container_repository.n8n,
    terraform_data.n8n_idcs_launch_client_metadata
  ]

  provisioner "local-exec" {
    environment = {
      N8N_BASIC_AUTH_PASSWORD = var.n8n_basic_auth_password
    }

    command = <<-EOT
      set -euo pipefail
      mkdir -p '${self.input.generated_dir}'

      oci_auth_args="--auth resource_principal"
      if [ -n '${self.input.profile}' ]; then
        oci_auth_args="--profile '${self.input.profile}'"
      fi

      n8n_basic_auth_password="$${N8N_BASIC_AUTH_PASSWORD:-}"
      if [ -z "$n8n_basic_auth_password" ]; then
        n8n_basic_auth_password="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(18))
PY
        )"
      fi

      repository_json='{"data":{}}'
      image_repository_uri='${self.input.n8n_image_repository_uri}'
      if [ -z "$image_repository_uri" ]; then
        existing_repository_json="$(oci artifacts container repository list \
          --compartment-id '${self.input.compartment_id}' \
          --display-name '${self.input.repository_name}' \
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
        if [ -z "$repository_json" ]; then
          repository_json="$(oci artifacts container repository create \
            --compartment-id '${self.input.compartment_id}' \
            --display-name '${self.input.repository_name}' \
            --is-public false \
            $oci_auth_args \
            --region '${self.input.region}' \
            --wait-for-state AVAILABLE \
            --output json)"
        fi
      fi
      printf '%s\n' "$repository_json" > '${self.input.generated_dir}/n8n_ocir_repository.json'

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

      if [ '${self.input.push_image}' = 'true' ] && [ -z '${self.input.n8n_image_repository_uri}' ]; then
        '${self.input.container_cli}' build --platform linux/amd64 -t "$image_uri" '${self.input.app_source_dir}'
        '${self.input.container_cli}' push "$image_uri"
      else
        echo "Skipping docker build/push. Expected image URI: $image_uri"
      fi

      application_file='${self.input.generated_dir}/n8n_hosted_application.json'
      application_raw_file="$(mktemp)"
      deployment_file='${self.input.generated_dir}/n8n_hosted_deployment.json'

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
      environment_variables="$(python3 - <<PY
import json
print(json.dumps([
    {"name": "N8N_BASIC_AUTH_ACTIVE", "type": "PLAINTEXT", "value": "false"},
    {"name": "N8N_BASIC_AUTH_USER", "type": "PLAINTEXT", "value": "${self.input.n8n_basic_auth_user}"},
    {"name": "N8N_BASIC_AUTH_PASSWORD", "type": "PLAINTEXT", "value": "$n8n_basic_auth_password"},
    {"name": "N8N_HOST", "type": "PLAINTEXT", "value": "0.0.0.0"},
    {"name": "N8N_LISTEN_ADDRESS", "type": "PLAINTEXT", "value": "0.0.0.0"},
    {"name": "N8N_PORT", "type": "PLAINTEXT", "value": "8080"},
    {"name": "N8N_SECURE_COOKIE", "type": "PLAINTEXT", "value": "false"},
    {"name": "N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS", "type": "PLAINTEXT", "value": "false"},
]))
PY
      )"
      oci generative-ai hosted-application create \
        --compartment-id '${self.input.compartment_id}' \
        --display-name '${self.input.hosted_application_display_name}' \
        --description 'Enterprise AI demo n8n hosted workflow automation application.' \
        --scaling-config '{"scalingType":"${self.input.scaling_type}","minReplica":1,"maxReplica":1,"targetRpsThreshold":10}' \
        --environment-variables "$environment_variables" \
        --inbound-auth-config "$inbound_auth_config" \
        --freeform-tags '{"enterprise-ai-demo":"true","demo":"n8n-hosted-workflow-automation"}' \
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

def redact_environment_variables(value):
    if isinstance(value, dict):
        redacted = {}
        for key, item in value.items():
            if key in {"environment-variables", "environmentVariables"} and isinstance(item, list):
                redacted[key] = [
                    {
                        **entry,
                        "value": "<redacted>" if entry.get("name") == "N8N_BASIC_AUTH_PASSWORD" else entry.get("value")
                    }
                    if isinstance(entry, dict)
                    else entry
                    for entry in item
                ]
            else:
                redacted[key] = redact_environment_variables(item)
        return redacted
    if isinstance(value, list):
        return [redact_environment_variables(item) for item in value]
    return value

payload = redact_environment_variables(load_json(sys.argv[1]))
Path(sys.argv[2]).write_text(json.dumps(payload, indent=2))
PY
      rm -f "$application_raw_file"
      hosted_application_id="$(python3 - "$application_file" <<'PY'
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

payload=load_json(sys.argv[1])
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
        echo "OCI n8n hosted application create response did not include an id." >&2
        exit 1
      fi

      oci generative-ai hosted-deployment create-hosted-deployment-single-docker-artifact \
        --hosted-application-id "$hosted_application_id" \
        --compartment-id '${self.input.compartment_id}' \
        --display-name '${self.input.hosted_deployment_display_name}' \
        --active-artifact-container-uri "$image_repository_uri" \
        --active-artifact-tag '${self.input.image_tag}' \
        --active-artifact-status ACTIVE \
        --freeform-tags '{"enterprise-ai-demo":"true","demo":"n8n-hosted-workflow-automation"}' \
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
def load_json(path):
    text = path.read_text()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find('{')
        end = text.rfind('}')
        if start >= 0 and end > start:
            return json.loads(text[start:end + 1])
        raise
repository = load_json(generated / 'n8n_ocir_repository.json').get('data', {})
application = load_json(generated / 'n8n_hosted_application.json').get('data', {})
deployment = load_json(generated / 'n8n_hosted_deployment.json').get('data', {})
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
    'runtime': 'n8n',
    'hostedApplicationId': hosted_application_id,
    'hostedApplicationDisplayName': application.get('display-name') or application.get('displayName') or '${self.input.hosted_application_display_name}',
    'hostedApplicationLifecycleState': application.get('lifecycle-state') or application.get('lifecycleState') or '',
    'hostedDeploymentId': resource_identifier(deployment, 'HOSTED_DEPLOYMENT') or deployment.get('id', ''),
    'hostedDeploymentDisplayName': deployment.get('display-name') or deployment.get('displayName') or '${self.input.hosted_deployment_display_name}',
    'hostedDeploymentLifecycleState': deployment.get('lifecycle-state') or deployment.get('lifecycleState') or '',
    'endpoint': endpoint,
    'url': endpoint,
    'basicAuthUser': '${self.input.n8n_basic_auth_user}',
}
(generated / 'n8n_hosted_workflow.json').write_text(json.dumps(runtime, indent=2))
print(json.dumps(runtime, indent=2))
PY
    EOT
  }

  provisioner "local-exec" {
    when    = destroy
    command = <<-EOT
      set -euo pipefail
      runtime_file='${self.input.generated_dir}/n8n_hosted_workflow.json'
      hosted_application_file='${self.input.generated_dir}/n8n_hosted_application.json'
      hosted_deployment_file='${self.input.generated_dir}/n8n_hosted_deployment.json'
      repository_file='${self.input.generated_dir}/n8n_ocir_repository.json'
      ids="$(python3 - "$runtime_file" "$hosted_application_file" "$hosted_deployment_file" <<'PY'
import json
import sys
from pathlib import Path

def load_json(path):
    path = Path(path)
    if not path.exists():
        return {}
    text = path.read_text()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start:end + 1])
        return {}

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
      rm -f '${self.input.generated_dir}/n8n_hosted_workflow.json' '${self.input.generated_dir}/n8n_hosted_deployment.json' '${self.input.generated_dir}/n8n_hosted_application.json' '${self.input.generated_dir}/n8n_ocir_repository.json'
    EOT
  }
}
