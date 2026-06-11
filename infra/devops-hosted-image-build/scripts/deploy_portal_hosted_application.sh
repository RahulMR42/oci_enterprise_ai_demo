#!/usr/bin/env bash
set -euo pipefail

unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY no_proxy NO_PROXY PIP_PROXY PIP_INDEX_URL PIP_EXTRA_INDEX_URL
if ! oci generative-ai hosted-application create -h >/dev/null 2>&1; then
  python3 -m pip install --user --upgrade --proxy "" --index-url https://pypi.org/simple oci-cli
fi
export PATH="$HOME/.local/bin:$PATH"
oci --version
oci generative-ai hosted-application update -h >/dev/null
oci generative-ai hosted-deployment add-artifact-create-single-docker-artifact-details -h >/dev/null

: "${RESOURCE_SUFFIX:?RESOURCE_SUFFIX is required}"
: "${OCI_REGION:?OCI_REGION is required}"
: "${COMPARTMENT_ID:?COMPARTMENT_ID is required}"
: "${OCIR_REGION_KEY:?OCIR_REGION_KEY is required}"
: "${OCIR_NAMESPACE:?OCIR_NAMESPACE is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
: "${PORTAL_AUTH_PASSWORD_SECRET_ID:?PORTAL_AUTH_PASSWORD_SECRET_ID is required}"

registry="${OCIR_REGION_KEY}.ocir.io"
portal_repository="${registry}/${OCIR_NAMESPACE}/enterprise-ai-demo/portal-rm"
portal_image_uri="${portal_repository}:${IMAGE_TAG}"
portal_display_name="${PORTAL_HOSTED_APPLICATION_DISPLAY_NAME:-enterprise-ai-demo-portal-noauth-v2-${RESOURCE_SUFFIX}}"
portal_deployment_display_name="${PORTAL_HOSTED_DEPLOYMENT_DISPLAY_NAME:-enterprise-ai-demo-portal-deployment-${RESOURCE_SUFFIX}}"
portal_artifact_json="/tmp/portal-hosted-artifact.json"
portal_app_json="/tmp/portal-hosted-application.json"
portal_deployment_json="/tmp/portal-hosted-deployment.json"

invoke_url() {
  local app_id="$1"
  printf 'https://application.generativeai.%s.oci.oraclecloud.com/20251112/hostedApplications/%s/actions/invoke/\n' "$OCI_REGION" "$app_id"
}

portal_sso_callback_url() {
  local app_id="$1"
  local url
  url="$(invoke_url "$app_id")"
  printf '%s/auth/sso/callback\n' "${url%/}"
}

write_portal_environment() {
  local output_file="$1"
  python3 - "$output_file" <<'PY'
import json
import os
import sys

output_file = sys.argv[1]

def plain(name, value):
    value = str(value or "").strip()
    return {"name": name, "type": "PLAINTEXT", "value": value} if value else None

def vault(name, secret_id):
    secret_id = str(secret_id or "").strip()
    return {"name": name, "type": "VAULT", "value": secret_id} if secret_id else None

values = [
    plain("OCI_GENAI_REGION", os.environ["OCI_REGION"]),
    plain("OCI_GENAI_PROJECT_ID", os.getenv("OCI_GENAI_PROJECT_ID", "")),
    plain("OCI_RESOURCE_SUFFIX", os.environ["RESOURCE_SUFFIX"]),
    plain("OCI_PORTAL_RUNTIME_CONFIG_NAMESPACE", os.getenv("PORTAL_RUNTIME_CONFIG_NAMESPACE", "")),
    plain("OCI_PORTAL_RUNTIME_CONFIG_BUCKET", os.getenv("PORTAL_RUNTIME_CONFIG_BUCKET", "")),
    plain("OCI_PORTAL_RUNTIME_CONFIG_OBJECT", os.getenv("PORTAL_RUNTIME_CONFIG_OBJECT", "portal-runtime-config.json")),
    plain("OCI_PORTAL_AUTH_STORE_MODE", "adb" if os.getenv("PORTAL_AUTH_DB_DSN", "") else ""),
    plain("OCI_PORTAL_AUTH_DB_DSN", os.getenv("PORTAL_AUTH_DB_DSN", "")),
    plain("OCI_PORTAL_AUTH_DB_ID", os.getenv("PORTAL_AUTH_DB_ID", "")),
    plain("OCI_PORTAL_AUTH_DB_USER", os.getenv("PORTAL_AUTH_DB_USER", "ADMIN")),
    plain("OCI_HOSTED_APP_IDCS_DOMAIN_URL", os.getenv("IDCS_DOMAIN_URL", "")),
    plain("OCI_HOSTED_APP_IDCS_AUDIENCE", os.getenv("IDCS_AUDIENCE", "")),
    plain("OCI_HOSTED_APP_IDCS_SCOPE", os.getenv("IDCS_SCOPE", "")),
    plain("OCI_HOSTED_APP_IDCS_CLIENT_ID", os.getenv("OCI_HOSTED_APP_IDCS_CLIENT_ID", "")),
    plain("OCI_PORTAL_SSO_REDIRECT_URI", os.getenv("OCI_PORTAL_SSO_REDIRECT_URI", "")),
    plain("OCI_PORTAL_SSO_ADMIN_EMAILS", os.getenv("OCI_PORTAL_SSO_ADMIN_EMAILS", os.getenv("PORTAL_SSO_ADMIN_EMAILS", ""))),
    vault("OCI_PORTAL_PASSWORD", os.environ["PORTAL_AUTH_PASSWORD_SECRET_ID"]),
    vault("OCI_GENAI_API_KEY", os.getenv("OCI_GENAI_API_KEY_SECRET_ID", "")),
    vault("OCI_HOSTED_APP_IDCS_CLIENT_SECRET", os.getenv("OCI_HOSTED_APP_IDCS_CLIENT_SECRET_ID", "")),
    vault("OCI_PORTAL_AUTH_DB_PASSWORD", os.getenv("PORTAL_AUTH_DB_PASSWORD_SECRET_ID", "")),
]
env = [item for item in values if item]
if len(env) > 20:
    raise SystemExit(f"Portal hosted environment has {len(env)} variables; reduce it before deployment.")
with open(output_file, "w", encoding="utf-8") as handle:
    json.dump(env, handle)
PY
}

active_hosted_app_id_by_display_name() {
  local display_name="$1"
  oci generative-ai hosted-application-collection list-hosted-applications \
    --compartment-id "$COMPARTMENT_ID" \
    --display-name "$display_name" \
    --all \
    --auth resource_principal \
    --region "$OCI_REGION" \
    --output json |
    python3 -c 'import json, sys
payload = json.load(sys.stdin)
for item in (payload.get("data") or {}).get("items", []):
    state = (item.get("lifecycleState") or item.get("lifecycle-state") or "").upper()
    app_id = item.get("id") or item.get("identifier") or ""
    if app_id and state in {"ACTIVE", "SUCCEEDED", "AVAILABLE", "CREATED"}:
        print(app_id)
        raise SystemExit(0)'
}

active_or_attention_deployment_id_by_app_id() {
  local app_id="$1"
  oci generative-ai hosted-deployment-collection list-hosted-deployments \
    --compartment-id "$COMPARTMENT_ID" \
    --application-id "$app_id" \
    --all \
    --auth resource_principal \
    --region "$OCI_REGION" \
    --output json |
    python3 -c 'import json, sys
payload = json.load(sys.stdin)
for item in (payload.get("data") or {}).get("items", []):
    state = (item.get("lifecycleState") or item.get("lifecycle-state") or "").upper()
    dep_id = item.get("id") or item.get("identifier") or ""
    if dep_id and state not in {"DELETED", "DELETING"}:
        print(dep_id)
        raise SystemExit(0)'
}

create_portal_hosted_application() {
  local app_body="/tmp/portal-hosted-create.json"
  local env_file="$1"
  python3 - "$app_body" "$env_file" <<'PY'
import json
import os
import sys

body_file, env_file = sys.argv[1:3]
payload = {
    "compartmentId": os.environ["COMPARTMENT_ID"],
    "displayName": os.environ["PORTAL_DISPLAY_NAME"],
    "description": "Enterprise AI demo portal hosted application deployed by OCI DevOps.",
    "scalingConfig": {"scalingType": "REQUESTS_PER_SECOND", "minReplica": 1, "maxReplica": 1, "targetRpsThreshold": 10},
    "environmentVariables": json.load(open(env_file, encoding="utf-8")),
    "inboundAuthConfig": {"inboundAuthConfigType": "NO_AUTH_CONFIG"},
    "networkingConfig": {
        "inboundNetworkingConfig": {"endpointMode": "PUBLIC"},
        "outboundNetworkingConfig": {"networkMode": "MANAGED"},
    },
    "freeformTags": {"enterprise-ai-demo": "true", "demo": "portal", "managed-by": "resource-manager-devops"},
}
json.dump(payload, open(body_file, "w", encoding="utf-8"))
PY
  oci raw-request \
    --http-method POST \
    --target-uri "https://generativeai.${OCI_REGION}.oci.oraclecloud.com/20231130/hostedApplications" \
    --request-body "file://${app_body}" \
    --auth resource_principal \
    --region "$OCI_REGION" \
    --output json > "$portal_app_json"
  python3 - "$portal_app_json" <<'PY'
import json
import sys
payload = json.load(open(sys.argv[1], encoding="utf-8"))
data = payload.get("data") or {}
resources = data.get("resources") or []
print(next((r.get("identifier", "") for r in resources if r.get("entityType") == "generativeAiHostedApplication" or r.get("entity-type") == "generativeAiHostedApplication" or r.get("entity-type") == "HOSTED_APPLICATION"), "") or data.get("id", ""))
PY
}

update_portal_hosted_application() {
  local app_id="$1"
  local env_file="$2"
  local no_auth='{"inboundAuthConfigType":"NO_AUTH_CONFIG"}'
  oci generative-ai hosted-application update \
    --hosted-application-id "$app_id" \
    --display-name "$portal_display_name" \
    --description "Enterprise AI demo portal hosted application deployed by OCI DevOps." \
    --scaling-config '{"scalingType":"REQUESTS_PER_SECOND","minReplica":1,"maxReplica":1,"targetRpsThreshold":10}' \
    --environment-variables "file://${env_file}" \
    --inbound-auth-config "$no_auth" \
    --freeform-tags '{"enterprise-ai-demo":"true","demo":"portal","managed-by":"resource-manager-devops"}' \
    --force \
    --auth resource_principal \
    --region "$OCI_REGION" \
    --wait-for-state SUCCEEDED \
    --wait-for-state FAILED \
    --max-wait-seconds 1200 \
    --wait-interval-seconds 20 \
    --output json > "$portal_app_json"
}

create_portal_deployment() {
  local app_id="$1"
  oci generative-ai hosted-deployment create-hosted-deployment-single-docker-artifact \
    --hosted-application-id "$app_id" \
    --compartment-id "$COMPARTMENT_ID" \
    --display-name "$portal_deployment_display_name" \
    --active-artifact-container-uri "$portal_repository" \
    --active-artifact-tag "$IMAGE_TAG" \
    --active-artifact-status ACTIVE \
    --freeform-tags '{"enterprise-ai-demo":"true","demo":"portal","managed-by":"resource-manager-devops"}' \
    --auth resource_principal \
    --region "$OCI_REGION" \
    --output json > "$portal_deployment_json"
  python3 - "$portal_deployment_json" <<'PY'
import json
import sys
print((json.load(open(sys.argv[1], encoding="utf-8")).get("data") or {}).get("id", ""))
PY
}

promote_portal_artifact() {
  local dep_id="$1"
  oci generative-ai hosted-deployment add-artifact-create-single-docker-artifact-details \
    --hosted-deployment-id "$dep_id" \
    --artifact-container-uri "$portal_repository" \
    --artifact-tag "$IMAGE_TAG" \
    --auth resource_principal \
    --region "$OCI_REGION" \
    --output json >/tmp/portal-hosted-add-artifact.json

  oci generative-ai hosted-deployment get \
    --hosted-deployment-id "$dep_id" \
    --auth resource_principal \
    --region "$OCI_REGION" \
    --output json > "$portal_deployment_json"
  python3 - "$portal_deployment_json" "$portal_artifact_json" "$IMAGE_TAG" <<'PY'
import json
import sys
deployment_file, artifact_file, image_tag = sys.argv[1:4]
data = (json.load(open(deployment_file, encoding="utf-8")).get("data") or {})
for artifact in data.get("artifacts") or []:
    if artifact.get("tag") == image_tag:
        json.dump(artifact, open(artifact_file, "w", encoding="utf-8"))
        raise SystemExit(0)
raise SystemExit(f"Artifact for tag {image_tag} was not found")
PY

  oci generative-ai hosted-deployment update \
    --hosted-deployment-id "$dep_id" \
    --active-artifact "file://${portal_artifact_json}" \
    --force \
    --auth resource_principal \
    --region "$OCI_REGION" \
    --wait-for-state SUCCEEDED \
    --wait-for-state FAILED \
    --max-wait-seconds 1200 \
    --wait-interval-seconds 20 \
    --output json > "$portal_deployment_json"
}

wait_for_portal_health() {
  local app_id="$1"
  local url
  url="$(invoke_url "$app_id")"
  for _ in $(seq 1 60); do
    if curl --noproxy '*' --fail --silent --show-error --max-time 30 "${url%/}/health" >/dev/null; then
      curl --noproxy '*' --fail --silent --show-error --max-time 30 "${url%/}/api/admin/demo-runs" >/dev/null || true
      curl --noproxy '*' --fail --silent --show-error --max-time 30 "${url%/}/api/features/responses-api/state" >/dev/null || true
      return 0
    fi
    sleep 10
  done
  echo "Portal hosted application health endpoint did not become ready: ${url%/}/health" >&2
  return 1
}

create_or_update_portal_hosted_application() {
  local env_file="/tmp/portal-hosted-env.json"
  local app_id dep_id

  export PORTAL_DISPLAY_NAME="$portal_display_name"
  write_portal_environment "$env_file"
  app_id="$(active_hosted_app_id_by_display_name "$portal_display_name" || true)"
  if [ -z "$app_id" ]; then
    echo "Creating portal hosted application ${portal_display_name}."
    app_id="$(create_portal_hosted_application "$env_file")"
  else
    echo "Found portal hosted application ${app_id} (${portal_display_name})."
  fi

  if [ -z "$app_id" ]; then
    echo "Portal hosted application id was not returned." >&2
    exit 1
  fi

  export OCI_PORTAL_SSO_REDIRECT_URI="$(portal_sso_callback_url "$app_id")"
  write_portal_environment "$env_file"
  echo "Updating portal hosted application ${app_id} (${portal_display_name})."
  update_portal_hosted_application "$app_id" "$env_file"

  dep_id="$(active_or_attention_deployment_id_by_app_id "$app_id" || true)"
  if [ -z "$dep_id" ]; then
    echo "Creating portal hosted deployment for ${app_id}."
    dep_id="$(create_portal_deployment "$app_id")"
  else
    echo "Updating portal hosted deployment ${dep_id} with ${portal_image_uri}."
    promote_portal_artifact "$dep_id"
  fi

  wait_for_portal_health "$app_id"

  printf 'PORTAL_URL=%s\n' "$(invoke_url "$app_id")" | tee hosted-deployments-PORTAL.env
  printf 'PORTAL_HOSTED_APPLICATION_ID=%s\n' "$app_id" | tee -a hosted-deployments-PORTAL.env
  printf 'PORTAL_HOSTED_DEPLOYMENT_ID=%s\n' "$dep_id" | tee -a hosted-deployments-PORTAL.env
}

create_or_update_portal_hosted_application
