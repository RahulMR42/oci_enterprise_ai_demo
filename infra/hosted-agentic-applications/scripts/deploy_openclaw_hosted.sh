#!/bin/sh
set -eu

mkdir -p "$GENERATED_DIR"
echo "Starting hosted deployment"

oci_auth_args="--auth resource_principal"
if [ -n "${OCI_CLI_PROFILE:-}" ]; then
  oci_auth_args="--profile $OCI_CLI_PROFILE"
fi

demo_name="open""claw"
demo_tag="${DEMO_TAG:-openclaw-hosted-agent-gateway}"
app_source_dir="$APP_SOURCE_ROOT/hosted-$demo_name"
repository_name="enterprise-ai-demo/hosted-$demo_name-$RESOURCE_SUFFIX"
hosted_application_display_name="enterprise-ai-demo-$demo_name-$RESOURCE_SUFFIX"
hosted_deployment_display_name="enterprise-ai-demo-$demo_name-deployment-$RESOURCE_SUFFIX"
repository_file="${OCIR_REPOSITORY_FILE:-openclaw_ocir_repository.json}"
application_file="${HOSTED_APPLICATION_FILE:-openclaw_hosted_application.json}"
deployment_file="${HOSTED_DEPLOYMENT_FILE:-openclaw_hosted_deployment.json}"
gateway_file="${HOSTED_GATEWAY_FILE:-openclaw_hosted_gateway.json}"

if command -v openssl >/dev/null 2>&1; then
  gateway_token="$(openssl rand -hex 24)"
else
  gateway_token="openclaw-$(date +%s)-$$"
fi

repository_json='{"data":{}}'
image_repository_uri=""
if [ "$USE_PUBLIC_BASE" = "true" ]; then
  image_repository_uri="ghcr.io/${demo_name}/${demo_name}"
fi
if [ -z "$image_repository_uri" ]; then
  existing_repository_json="$(oci artifacts container repository list \
    --compartment-id "$COMPARTMENT_ID" \
    --display-name "$repository_name" \
    $oci_auth_args \
    --region "$OCI_CLI_REGION" \
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
      --compartment-id "$COMPARTMENT_ID" \
      --display-name "$repository_name" \
      --is-public false \
      $oci_auth_args \
      --region "$OCI_CLI_REGION" \
      --wait-for-state AVAILABLE \
      --output json)"
  fi
fi
printf '%s\n' "$repository_json" > "$GENERATED_DIR/$repository_file"

if [ -z "$image_repository_uri" ]; then
  namespace="$(oci os ns get $oci_auth_args --region "$OCI_CLI_REGION" --query 'data' --raw-output)"
  image_repository_uri="$OCIR_REGION_KEY.ocir.io/${namespace}/${repository_name}"
fi
image_uri="${image_repository_uri}:${IMAGE_TAG}"

if [ "$PUSH_IMAGE" = "true" ] && [ "$USE_PUBLIC_BASE" != "true" ]; then
  "$CONTAINER_CLI" build --platform linux/amd64 -t "$image_uri" "$app_source_dir"
  "$CONTAINER_CLI" push "$image_uri"
else
  echo "Skipping docker build/push. Expected image URI: $image_uri"
fi

application_path="$GENERATED_DIR/$application_file"
deployment_path="$GENERATED_DIR/$deployment_file"
application_raw_file="$(mktemp)"

inbound_auth_config="$(python3 - <<PY
import json
print(json.dumps({
    "inboundAuthConfigType": "IDCS_AUTH_CONFIG",
    "idcsConfig": {
        "domainUrl": "$IDCS_DOMAIN_URL",
        "audience": "$IDCS_AUDIENCE",
        "scope": "$IDCS_SCOPE",
    },
}))
PY
)"

environment_variables="$(python3 - <<PY
import json
print(json.dumps([
    {"name": "OPENCLAW_GATEWAY_BIND", "type": "PLAINTEXT", "value": "lan"},
    {"name": "OPENCLAW_GATEWAY_PORT", "type": "PLAINTEXT", "value": "18789"},
    {"name": "OPENCLAW_GATEWAY_TOKEN", "type": "PLAINTEXT", "value": "$gateway_token"},
    {"name": "OPENCLAW_SANDBOX", "type": "PLAINTEXT", "value": "0"},
]))
PY
)"

oci generative-ai hosted-application create \
  --compartment-id "$COMPARTMENT_ID" \
  --display-name "$hosted_application_display_name" \
  --description "Enterprise AI demo OpenClaw hosted agent gateway application." \
  --scaling-config '{"scalingType":"REQUESTS_PER_SECOND","minReplica":1,"maxReplica":1,"targetRpsThreshold":10}' \
  --environment-variables "$environment_variables" \
  --inbound-auth-config "$inbound_auth_config" \
  --freeform-tags "{\"enterprise-ai-demo\":\"true\",\"demo\":\"$demo_tag\"}" \
  $oci_auth_args \
  --region "$OCI_CLI_REGION" \
  --wait-for-state SUCCEEDED \
  --max-wait-seconds 1200 \
  --output json > "$application_raw_file"

python3 - "$application_raw_file" "$application_path" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text())

def redact(value):
    if isinstance(value, dict):
        return {
            key: ("<redacted>" if key == "value" and value.get("name") == "OPENCLAW_GATEWAY_TOKEN" else redact(item))
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value

Path(sys.argv[2]).write_text(json.dumps(redact(payload), indent=2))
PY
rm -f "$application_raw_file"

hosted_application_id="$(python3 - "$application_path" <<'PY'
import json
import sys
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text()).get("data", {})
identifier = ""
for resource in data.get("resources") or []:
    if resource.get("entity-type") == "HOSTED_APPLICATION" and resource.get("identifier"):
        identifier = resource["identifier"]
        break
print(identifier or data.get("id", ""))
PY
)"

if [ -z "$hosted_application_id" ]; then
  echo "OCI hosted application create response did not include an id." >&2
  exit 1
fi

oci generative-ai hosted-deployment create-hosted-deployment-single-docker-artifact \
  --hosted-application-id "$hosted_application_id" \
  --compartment-id "$COMPARTMENT_ID" \
  --display-name "$hosted_deployment_display_name" \
  --active-artifact-container-uri "$image_repository_uri" \
  --active-artifact-tag "$IMAGE_TAG" \
  --active-artifact-status ACTIVE \
  --freeform-tags "{\"enterprise-ai-demo\":\"true\",\"demo\":\"$demo_tag\"}" \
  $oci_auth_args \
  --region "$OCI_CLI_REGION" \
  --output json > "$deployment_path"

python3 - "$GENERATED_DIR" "$repository_file" "$application_file" "$deployment_file" "$gateway_file" "$repository_name" "$image_uri" "$OCI_CLI_REGION" "$hosted_application_display_name" "$hosted_deployment_display_name" <<'PY'
import json
import sys
from pathlib import Path

generated = Path(sys.argv[1])
repository_file = sys.argv[2]
application_file = sys.argv[3]
deployment_file = sys.argv[4]
gateway_file = sys.argv[5]
repository_name = sys.argv[6]
image_uri = sys.argv[7]
region = sys.argv[8]
application_display_name = sys.argv[9]
deployment_display_name = sys.argv[10]
repository = json.loads((generated / repository_file).read_text()).get("data", {})
application = json.loads((generated / application_file).read_text()).get("data", {})
deployment = json.loads((generated / deployment_file).read_text()).get("data", {})

def resource_identifier(payload, entity_type):
    for resource in payload.get("resources") or []:
        if resource.get("entity-type") == entity_type and resource.get("identifier"):
            return resource["identifier"]
    return ""

hosted_application_id = resource_identifier(application, "HOSTED_APPLICATION") or application.get("id", "")
endpoint = (
    deployment.get("endpoint")
    or deployment.get("invoke-endpoint")
    or deployment.get("invokeEndpoint")
    or (f"https://application.generativeai.{region}.oci.oraclecloud.com/20251112/hostedApplications/{hosted_application_id}/actions/invoke/" if hosted_application_id else "")
)
runtime = {
    "repositoryId": repository.get("id", ""),
    "repositoryName": repository_name,
    "imageUri": image_uri,
    "runtime": "openclaw",
    "hostedApplicationId": hosted_application_id,
    "hostedApplicationDisplayName": application.get("display-name") or application.get("displayName") or application_display_name,
    "hostedApplicationLifecycleState": application.get("lifecycle-state") or application.get("lifecycleState") or "",
    "hostedDeploymentId": resource_identifier(deployment, "HOSTED_DEPLOYMENT") or deployment.get("id", ""),
    "hostedDeploymentDisplayName": deployment.get("display-name") or deployment.get("displayName") or deployment_display_name,
    "hostedDeploymentLifecycleState": deployment.get("lifecycle-state") or deployment.get("lifecycleState") or "",
    "endpoint": endpoint,
    "url": endpoint,
}
(generated / gateway_file).write_text(json.dumps(runtime, indent=2))
PY
