resource "terraform_data" "llamaindex_control_tower" {
  triggers_replace = [
    "20260525-add-llamaindex-control-tower",
    var.resource_suffix,
    var.llamaindex_repository_name,
    var.llamaindex_image_repository_uri,
    var.image_tag,
    var.idcs_domain_url,
    var.idcs_audience,
    var.idcs_scope
  ]

  input = {
    app_source_dir                  = abspath("${path.module}/${var.llamaindex_app_source_dir}")
    compartment_id                  = var.compartment_id
    generated_dir                   = local.generated_dir
    hosted_application_display_name = local.llamaindex_application_display_name
    hosted_deployment_display_name  = local.llamaindex_deployment_display_name
    image_repository_uri            = var.llamaindex_image_repository_uri
    image_tag                       = var.image_tag
    container_cli                   = var.container_cli
    idcs_domain_url                 = var.idcs_domain_url
    idcs_audience                   = var.idcs_audience
    idcs_scope                      = var.idcs_scope
    ocir_region_key                 = var.ocir_region_key
    profile                         = var.profile
    provisioning_revision           = "20260525-add-llamaindex-control-tower"
    push_image                      = var.push_image
    region                          = var.region
    repository_name                 = local.llamaindex_repository_name
    scaling_type                    = var.scaling_type
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -euo pipefail
      mkdir -p '${self.input.generated_dir}'

      existing_repository_json="$(oci artifacts container repository list \
        --compartment-id '${self.input.compartment_id}' \
        --display-name '${self.input.repository_name}' \
        --profile '${self.input.profile}' \
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
          --profile '${self.input.profile}' \
          --region '${self.input.region}' \
          --wait-for-state AVAILABLE \
          --output json)"
      fi
      printf '%s\n' "$repository_json" > '${self.input.generated_dir}/llamaindex_ocir_repository.json'

      namespace="$(oci os ns get \
        --profile '${self.input.profile}' \
        --region '${self.input.region}' \
        --query 'data' \
        --raw-output)"
      region_key='${self.input.ocir_region_key}'
      image_repository_uri="${self.input.image_repository_uri}"
      if [ -z "$image_repository_uri" ]; then
        image_repository_uri="$${region_key}.ocir.io/$${namespace}/${self.input.repository_name}"
      fi
      image_uri="$${image_repository_uri}:${self.input.image_tag}"

      if [ '${self.input.push_image}' = 'true' ] && [ -z '${self.input.image_repository_uri}' ]; then
        '${self.input.container_cli}' build --platform linux/amd64 -t "$image_uri" '${self.input.app_source_dir}'
        '${self.input.container_cli}' push "$image_uri"
      else
        echo "Skipping docker build/push because push_image=false or a prebuilt image URI was provided. Expected image URI: $image_uri"
      fi

      application_file='${self.input.generated_dir}/llamaindex_hosted_application.json'
      deployment_file='${self.input.generated_dir}/llamaindex_hosted_deployment.json'

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
      oci generative-ai hosted-application create \
        --compartment-id '${self.input.compartment_id}' \
        --display-name '${self.input.hosted_application_display_name}' \
        --description 'Enterprise AI demo hosted LlamaIndex control tower application.' \
        --scaling-config '{"scalingType":"${self.input.scaling_type}","minReplica":1,"maxReplica":1,"targetRpsThreshold":10}' \
        --inbound-auth-config "$inbound_auth_config" \
        --freeform-tags '{"enterprise-ai-demo":"true","demo":"agentic-control-tower"}' \
        --profile '${self.input.profile}' \
        --region '${self.input.region}' \
        --wait-for-state SUCCEEDED \
        --max-wait-seconds 1200 \
        --output json > "$application_file"
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
        echo "OCI LlamaIndex hosted application create response did not include an id." >&2
        exit 1
      fi

      oci generative-ai hosted-deployment create-hosted-deployment-single-docker-artifact \
        --hosted-application-id "$hosted_application_id" \
        --compartment-id '${self.input.compartment_id}' \
        --display-name '${self.input.hosted_deployment_display_name}' \
        --active-artifact-container-uri "$image_repository_uri" \
        --active-artifact-tag '${self.input.image_tag}' \
        --active-artifact-status ACTIVE \
        --freeform-tags '{"enterprise-ai-demo":"true","demo":"agentic-control-tower"}' \
        --profile '${self.input.profile}' \
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
            --profile '${self.input.profile}' \
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
repository = load_json(generated / 'llamaindex_ocir_repository.json').get('data', {})
application = load_json(generated / 'llamaindex_hosted_application.json').get('data', {})
deployment = load_json(generated / 'llamaindex_hosted_deployment.json').get('data', {})
def resource_identifier(payload, entity_type):
    for resource in payload.get('resources') or []:
        if resource.get('entity-type') == entity_type and resource.get('identifier'):
            return resource['identifier']
    return ''
runtime = {
    'repositoryId': repository.get('id', ''),
    'repositoryName': '${self.input.repository_name}',
    'imageUri': '$image_uri',
    'runtime': 'llamaindex',
    'hostedApplicationId': resource_identifier(application, 'HOSTED_APPLICATION') or application.get('id', ''),
    'hostedApplicationDisplayName': application.get('display-name') or application.get('displayName') or '${self.input.hosted_application_display_name}',
    'hostedApplicationLifecycleState': application.get('lifecycle-state') or application.get('lifecycleState') or '',
    'hostedDeploymentId': resource_identifier(deployment, 'HOSTED_DEPLOYMENT') or deployment.get('id', ''),
    'hostedDeploymentDisplayName': deployment.get('display-name') or deployment.get('displayName') or '${self.input.hosted_deployment_display_name}',
    'hostedDeploymentLifecycleState': deployment.get('lifecycle-state') or deployment.get('lifecycleState') or '',
    'endpoint': deployment.get('endpoint') or deployment.get('invoke-endpoint') or deployment.get('invokeEndpoint') or application.get('endpoint') or '',
}
(generated / 'llamaindex_control_tower.json').write_text(json.dumps(runtime, indent=2))
print(json.dumps(runtime, indent=2))
PY
    EOT
  }
}
