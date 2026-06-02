#!/usr/bin/env bash
set -euo pipefail

unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY no_proxy NO_PROXY PIP_PROXY PIP_INDEX_URL PIP_EXTRA_INDEX_URL
if ! oci container-instances container-instance create -h >/dev/null 2>&1; then
  python3 -m pip install --user --upgrade --proxy "" --index-url https://pypi.org/simple oci-cli
fi
export PATH="$HOME/.local/bin:$PATH"
oci --version
oci container-instances container-instance create -h >/dev/null
oci lb backend create -h >/dev/null

: "${RESOURCE_SUFFIX:?RESOURCE_SUFFIX is required}"
: "${OCI_REGION:?OCI_REGION is required}"
: "${COMPARTMENT_ID:?COMPARTMENT_ID is required}"
: "${OCIR_REGION_KEY:?OCIR_REGION_KEY is required}"
: "${OCIR_NAMESPACE:?OCIR_NAMESPACE is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
: "${PORTAL_PRIVATE_SUBNET_ID:?PORTAL_PRIVATE_SUBNET_ID is required}"
: "${PORTAL_NETWORK_SECURITY_GROUP_ID:?PORTAL_NETWORK_SECURITY_GROUP_ID is required}"
: "${PORTAL_LOAD_BALANCER_ID:?PORTAL_LOAD_BALANCER_ID is required}"
: "${PORTAL_BACKEND_SET_NAME:?PORTAL_BACKEND_SET_NAME is required}"
: "${PORTAL_PUBLIC_URL:?PORTAL_PUBLIC_URL is required}"
: "${PORTAL_AUTH_PASSWORD:?PORTAL_AUTH_PASSWORD is required}"

portal_port="${PORTAL_CONTAINER_PORT:-5173}"
portal_shape="${PORTAL_CONTAINER_SHAPE:-CI.Standard.E4.Flex}"
portal_ocpus="${PORTAL_CONTAINER_OCPUS:-1}"
portal_memory_gbs="${PORTAL_CONTAINER_MEMORY_GBS:-4}"
portal_image_uri="${OCIR_REGION_KEY}.ocir.io/${OCIR_NAMESPACE}/enterprise-ai-demo/portal-rm:${IMAGE_TAG}"
rollout_id="$(date +%Y%m%d%H%M%S)-${BUILD_RUN_ID:-manual}"
rollout_id="${rollout_id//[^A-Za-z0-9-]/-}"
portal_display_name="enterprise-ai-demo-portal-${RESOURCE_SUFFIX}-${rollout_id}"
portal_display_prefix="enterprise-ai-demo-portal-${RESOURCE_SUFFIX}"
new_container_id=""
new_backend_name=""
old_backend_names=()

write_container_inputs() {
  local shape_file="$1"
  local vnics_file="$2"
  local containers_file="$3"

  python3 - "$shape_file" "$vnics_file" "$containers_file" <<'PY'
import json
import os
import sys

shape_file, vnics_file, containers_file = sys.argv[1:4]

def env_value(name, default=""):
    return os.environ.get(name, default).strip()

env = {
    "HOST": "0.0.0.0",
    "PORT": os.environ.get("PORTAL_CONTAINER_PORT", "5173"),
    "OCI_DEVOPS_HOSTED_IMAGE_BUILD_RUN_ID": os.environ.get("BUILD_RUN_ID", ""),
    "OCI_GENAI_API_KEY": os.environ.get("OCI_GENAI_API_KEY", ""),
    "OCI_GENAI_CODE_INTERPRETER_CONTAINER": env_value("PORTAL_CODE_INTERPRETER_CONTAINER_ID"),
    "OCI_GENAI_PROJECT_ID": os.environ.get("OCI_GENAI_PROJECT_ID", ""),
    "OCI_GENAI_REGION": os.environ["OCI_REGION"],
    "OCI_GENAI_VECTOR_STORE_ID": env_value("PORTAL_VECTOR_STORE_ID"),
    "OCI_HOSTED_APP_IDCS_AUDIENCE": os.environ.get("IDCS_AUDIENCE", ""),
    "OCI_HOSTED_APP_IDCS_CLIENT_ID": os.environ.get("OCI_HOSTED_APP_IDCS_CLIENT_ID", ""),
    "OCI_HOSTED_APP_IDCS_CLIENT_SECRET": os.environ.get("OCI_HOSTED_APP_IDCS_CLIENT_SECRET", ""),
    "OCI_HOSTED_APP_IDCS_DOMAIN_URL": os.environ.get("IDCS_DOMAIN_URL", ""),
    "OCI_HOSTED_APP_IDCS_SCOPE": os.environ.get("IDCS_SCOPE", ""),
    "OCI_HOSTED_APP_IDCS_TOKEN_URL": (os.environ.get("IDCS_DOMAIN_URL", "").rstrip("/") + "/oauth2/v1/token") if os.environ.get("IDCS_DOMAIN_URL") else "",
    "OCI_HOSTED_AGENT_DEPLOYMENT_ID": "",
    "OCI_HOSTED_AGENT_URL": "",
    "OCI_HOSTED_LANGFUSE_DEPLOYMENT_ID": "",
    "OCI_HOSTED_LANGFUSE_URL": "",
    "OCI_HOSTED_LANGGRAPH_DEPLOYMENT_ID": "",
    "OCI_HOSTED_LANGGRAPH_URL": "",
    "OCI_HOSTED_LLAMAINDEX_DEPLOYMENT_ID": "",
    "OCI_HOSTED_LLAMAINDEX_URL": "",
    "OCI_HOSTED_N8N_DEPLOYMENT_ID": "",
    "OCI_HOSTED_N8N_URL": "",
    "OCI_HOSTED_OPENCLAW_DEPLOYMENT_ID": "",
    "OCI_HOSTED_OPENCLAW_URL": "",
    "OCI_PORTAL_PASSWORD": os.environ["PORTAL_AUTH_PASSWORD"],
    "OCI_PORTAL_RUNTIME_CONFIG_NAMESPACE": os.environ.get("PORTAL_RUNTIME_CONFIG_NAMESPACE", ""),
    "OCI_PORTAL_RUNTIME_CONFIG_BUCKET": os.environ.get("PORTAL_RUNTIME_CONFIG_BUCKET", ""),
    "OCI_PORTAL_RUNTIME_CONFIG_OBJECT": os.environ.get("PORTAL_RUNTIME_CONFIG_OBJECT", "portal-runtime-config.json"),
    "OCI_PORTAL_RUN_HISTORY_NAMESPACE": os.environ.get("PORTAL_RUN_HISTORY_NAMESPACE", ""),
    "OCI_PORTAL_RUN_HISTORY_BUCKET": os.environ.get("PORTAL_RUN_HISTORY_BUCKET", ""),
    "OCI_PORTAL_RUN_HISTORY_OBJECT": os.environ.get("PORTAL_RUN_HISTORY_OBJECT", "portal-demo-run-summary.json"),
    "OCI_RESOURCE_SUFFIX": os.environ["RESOURCE_SUFFIX"],
}
env = {k: str(v) for k, v in env.items() if str(v).strip()}
shape = {"ocpus": float(os.environ.get("PORTAL_CONTAINER_OCPUS", "1")), "memoryInGBs": float(os.environ.get("PORTAL_CONTAINER_MEMORY_GBS", "4"))}
vnics = [{
    "displayName": os.environ["PORTAL_DISPLAY_NAME"] + "-vnic",
    "hostnameLabel": "portal",
    "isPublicIpAssigned": False,
    "nsgIds": [os.environ["PORTAL_NETWORK_SECURITY_GROUP_ID"]],
    "subnetId": os.environ["PORTAL_PRIVATE_SUBNET_ID"],
    "skipSourceDestCheck": False,
}]
containers = [{
    "displayName": "portal",
    "imageUrl": os.environ["PORTAL_IMAGE_URI"],
    "environmentVariables": env,
}]
for path, data in [(shape_file, shape), (vnics_file, vnics), (containers_file, containers)]:
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle)
PY
}

parse_container_id() {
  python3 - "$1" <<'PY'
import json
import sys

payload = json.load(open(sys.argv[1], encoding="utf-8"))
data = payload.get("data") or {}
resources = data.get("resources") or []
for resource in resources:
    entity = str(resource.get("entity-type") or resource.get("entityType") or "").upper()
    identifier = resource.get("identifier") or resource.get("id") or ""
    if identifier and "CONTAINER" in entity:
        print(identifier)
        raise SystemExit
print(data.get("id") or data.get("container-instance-id") or data.get("containerInstanceId") or "")
PY
}

container_private_ip() {
  python3 - "$1" <<'PY'
import json
import sys

payload = json.load(open(sys.argv[1], encoding="utf-8"))
vnics = (payload.get("data") or {}).get("vnics") or []
if not vnics:
    print("|")
    raise SystemExit
vnic = vnics[0]
private_ip = vnic.get("private-ip") or vnic.get("privateIp") or ""
vnic_id = vnic.get("vnic-id") or vnic.get("vnicId") or vnic.get("id") or ""
print(f"{private_ip}|{vnic_id}")
PY
}

print_container_failure_details() {
  local get_file="$1"
  echo "Portal container instance ${new_container_id} did not become ACTIVE." >&2
  python3 - "$get_file" <<'PY' >&2
import json
import sys

data = (json.load(open(sys.argv[1], encoding="utf-8")).get("data") or {})
print(f"Container instance state: {data.get('lifecycle-state', '')}")
print(f"Container instance details: {data.get('lifecycle-details', '')}")
for container in data.get("containers") or []:
    display_name = container.get("display-name") or container.get("name") or ""
    container_id = container.get("container-id") or container.get("id") or ""
    print(f"Container: {display_name} {container_id}".strip())
PY
  python3 - "$get_file" <<'PY' |
import json
import sys

data = (json.load(open(sys.argv[1], encoding="utf-8")).get("data") or {})
for container in data.get("containers") or []:
    container_id = container.get("container-id") or container.get("id") or ""
    if container_id:
        print(container_id)
PY
    while IFS= read -r container_id; do
      [ -z "$container_id" ] && continue
      oci container-instances container get \
        --container-id "$container_id" \
        --auth resource_principal \
        --region "$OCI_REGION" \
        --query 'data.{name:"display-name",state:"lifecycle-state",details:"lifecycle-details",exitCode:"exit-code",restartAttempts:"container-restart-attempt-count",image:"image-url",health:"health-checks"}' \
        --output json >&2 || true
    done
}

delete_new_container_instance() {
  [ -z "$new_container_id" ] && return 0
  oci container-instances container-instance delete \
    --container-instance-id "$new_container_id" \
    --force \
    --auth resource_principal \
    --region "$OCI_REGION" \
    --wait-for-state SUCCEEDED || true
}

vnic_private_ip() {
  local vnic_id="$1"
  oci network vnic get \
    --vnic-id "$vnic_id" \
    --auth resource_principal \
    --region "$OCI_REGION" \
    --output json |
    python3 -c 'import json, sys; print((json.load(sys.stdin).get("data") or {}).get("private-ip", ""))'
}

list_current_backends() {
  oci lb backend list \
    --load-balancer-id "$PORTAL_LOAD_BALANCER_ID" \
    --backend-set-name "$PORTAL_BACKEND_SET_NAME" \
    --auth resource_principal \
    --region "$OCI_REGION" \
    --all \
    --output json |
    python3 -c 'import json, sys
payload = json.load(sys.stdin)
for item in (payload.get("data") or []):
    name = item.get("name") or ""
    if name:
        print(name)'
}

backend_health() {
  local backend_name="$1"
  oci lb backend-health get \
    --load-balancer-id "$PORTAL_LOAD_BALANCER_ID" \
    --backend-set-name "$PORTAL_BACKEND_SET_NAME" \
    --backend-name "$backend_name" \
    --auth resource_principal \
    --region "$OCI_REGION" \
    --output json |
    python3 -c 'import json, sys; print((json.load(sys.stdin).get("data") or {}).get("status", ""))'
}

wait_for_container_active() {
  local get_file="$1"
  local state=""
  for _ in $(seq 1 "${PORTAL_CONTAINER_ACTIVE_POLL_ATTEMPTS:-160}"); do
    oci container-instances container-instance get \
      --container-instance-id "$new_container_id" \
      --auth resource_principal \
      --region "$OCI_REGION" \
      --output json > "$get_file"
    state="$(python3 -c 'import json, sys; print((json.load(open(sys.argv[1])).get("data") or {}).get("lifecycle-state", ""))' "$get_file")"
    [ "$state" = "ACTIVE" ] && return 0
    if [ "$state" = "FAILED" ]; then
      print_container_failure_details "$get_file"
      return 1
    fi
    sleep 15
  done
  echo "Timed out waiting for portal container instance ${new_container_id} to become ACTIVE." >&2
  print_container_failure_details "$get_file"
  return 1
}

create_active_container_instance() {
  local ad_file="/tmp/portal-ads-${rollout_id}.txt"
  local availability_domain=""

  oci iam availability-domain list \
    --compartment-id "$COMPARTMENT_ID" \
    --auth resource_principal \
    --region "$OCI_REGION" \
    --query 'data[].name' \
    --output json |
    python3 -c 'import json, sys
payload = json.load(sys.stdin)
if isinstance(payload, list):
    for item in payload:
        if item:
            print(item)
' > "$ad_file"

  while IFS= read -r availability_domain; do
    [ -z "$availability_domain" ] && continue
    new_container_id=""
    echo "Creating portal container instance in ${availability_domain}."
    if ! oci container-instances container-instance create \
      --compartment-id "$COMPARTMENT_ID" \
      --availability-domain "$availability_domain" \
      --shape "$portal_shape" \
      --shape-config "file://${shape_file}" \
      --vnics "file://${vnics_file}" \
      --containers "file://${containers_file}" \
      --display-name "$portal_display_name" \
      --freeform-tags "{\"enterprise-ai-demo\":\"true\",\"demo\":\"portal\",\"managed-by\":\"resource-manager-devops\",\"resource-suffix\":\"${RESOURCE_SUFFIX}\"}" \
      --auth resource_principal \
      --region "$OCI_REGION" \
      --output json > "$create_file"; then
      echo "Portal container instance create failed in ${availability_domain}." >&2
      continue
    fi

    new_container_id="$(parse_container_id "$create_file")"
    if [ -z "$new_container_id" ]; then
      echo "Portal container instance create in ${availability_domain} did not return an id." >&2
      continue
    fi

    if wait_for_container_active "$get_file"; then
      return 0
    fi

    echo "Portal container instance ${new_container_id} failed in ${availability_domain}; retrying another availability domain if available." >&2
    delete_new_container_instance
    new_container_id=""
  done < "$ad_file"

  echo "No portal container instance became ACTIVE in any availability domain." >&2
  return 1
}

smoke_direct() {
  local backend_name="$1"
  local status=""
  for _ in $(seq 1 30); do
    status="$(backend_health "$backend_name" || true)"
    if [ "$status" = "OK" ]; then
      return 0
    fi
    echo "Waiting for new portal backend ${backend_name} to become healthy; current status=${status:-unknown}."
    sleep 10
  done
  echo "New portal backend ${backend_name} did not become healthy." >&2
  return 1
}

smoke_public() {
  local netrc_file="/tmp/portal-smoke-${rollout_id}.netrc"
  printf 'machine %s login oci password %s\n' "$(python3 -c 'from urllib.parse import urlparse; import os; print(urlparse(os.environ["PORTAL_PUBLIC_URL"]).hostname)')" "$PORTAL_AUTH_PASSWORD" > "$netrc_file"
  chmod 600 "$netrc_file"

  curl --noproxy '*' --fail --silent --show-error --max-time 30 --netrc-file "$netrc_file" "${PORTAL_PUBLIC_URL%/}/login" >/dev/null
  curl --noproxy '*' --fail --silent --show-error --max-time 30 --netrc-file "$netrc_file" "${PORTAL_PUBLIC_URL%/}/api/admin/demo-runs" >/dev/null
  curl --noproxy '*' --fail --silent --show-error --max-time 30 --netrc-file "$netrc_file" "${PORTAL_PUBLIC_URL%/}/api/features/responses-api/state" >/dev/null
}

mark_backend() {
  local backend_name="$1"
  local backup="$2"
  local drain="$3"
  local offline="$4"
  oci lb backend update \
    --load-balancer-id "$PORTAL_LOAD_BALANCER_ID" \
    --backend-set-name "$PORTAL_BACKEND_SET_NAME" \
    --backend-name "$backend_name" \
    --weight 1 \
    --backup "$backup" \
    --drain "$drain" \
    --offline "$offline" \
    --auth resource_principal \
    --region "$OCI_REGION" \
    --wait-for-state SUCCEEDED
}

mark_existing_backends_drain() {
  local backend_name
  for backend_name in "${old_backend_names[@]}"; do
    [ -z "$backend_name" ] && continue
    echo "Draining old portal backend ${backend_name}."
    mark_backend "$backend_name" false true false || true
  done
}

restore_existing_backends() {
  local backend_name
  for backend_name in "${old_backend_names[@]}"; do
    [ -z "$backend_name" ] && continue
    echo "Restoring old portal backend ${backend_name}."
    mark_backend "$backend_name" false false false || true
  done
}

delete_old_backends() {
  local backend_name
  for backend_name in "${old_backend_names[@]}"; do
    [ -z "$backend_name" ] && continue
    echo "Deleting old portal backend ${backend_name}."
    oci lb backend delete \
      --load-balancer-id "$PORTAL_LOAD_BALANCER_ID" \
      --backend-set-name "$PORTAL_BACKEND_SET_NAME" \
      --backend-name "$backend_name" \
      --force \
      --auth resource_principal \
      --region "$OCI_REGION" \
      --wait-for-state SUCCEEDED || true
  done
}

delete_old_portal_instances() {
  oci container-instances container-instance list \
    --compartment-id "$COMPARTMENT_ID" \
    --lifecycle-state ACTIVE \
    --auth resource_principal \
    --region "$OCI_REGION" \
    --all \
    --output json |
    python3 -c 'import json, sys
new_id = sys.argv[1]
payload = json.load(sys.stdin)
for item in (payload.get("data") or {}).get("items", []):
    identifier = item.get("id") or ""
    display_name = item.get("display-name") or item.get("displayName") or ""
    if identifier and identifier != new_id and display_name.startswith(sys.argv[2]):
        print(identifier)
' "$new_container_id" "$portal_display_prefix" |
    while IFS= read -r old_container_id; do
      [ -z "$old_container_id" ] && continue
      echo "Deleting old portal container instance ${old_container_id}."
      oci container-instances container-instance delete \
        --container-instance-id "$old_container_id" \
        --force \
        --auth resource_principal \
        --region "$OCI_REGION" \
        --wait-for-state SUCCEEDED || true
    done
}

rollback_new_backend() {
  local exit_code=$?
  echo "Portal rollout failed; preserving existing backend and cleaning up new resources." >&2
  restore_existing_backends
  if [ -n "$new_backend_name" ]; then
    oci lb backend delete \
      --load-balancer-id "$PORTAL_LOAD_BALANCER_ID" \
      --backend-set-name "$PORTAL_BACKEND_SET_NAME" \
      --backend-name "$new_backend_name" \
      --force \
      --auth resource_principal \
      --region "$OCI_REGION" \
      --wait-for-state SUCCEEDED || true
  fi
  if [ -n "$new_container_id" ]; then
    delete_new_container_instance
  fi
  exit "$exit_code"
}

trap rollback_new_backend ERR

export PORTAL_DISPLAY_NAME="$portal_display_name"
export PORTAL_IMAGE_URI="$portal_image_uri"

shape_file="/tmp/portal-shape-${rollout_id}.json"
vnics_file="/tmp/portal-vnics-${rollout_id}.json"
containers_file="/tmp/portal-containers-${rollout_id}.json"
create_file="/tmp/portal-create-${rollout_id}.json"
get_file="/tmp/portal-get-${rollout_id}.json"

mapfile -t old_backend_names < <(list_current_backends || true)
write_container_inputs "$shape_file" "$vnics_file" "$containers_file"

create_active_container_instance
private_ip_payload="$(container_private_ip "$get_file")"
new_private_ip="${private_ip_payload%%|*}"
new_vnic_id="${private_ip_payload#*|}"
if [ -z "$new_private_ip" ] && [ -n "$new_vnic_id" ] && [ "$new_vnic_id" != "$private_ip_payload" ]; then
  new_private_ip="$(vnic_private_ip "$new_vnic_id")"
fi
if [ -z "$new_private_ip" ]; then
  echo "Portal container instance ${new_container_id} did not expose a private IP." >&2
  exit 1
fi
new_backend_name="${new_private_ip}:${portal_port}"

oci lb backend create \
  --load-balancer-id "$PORTAL_LOAD_BALANCER_ID" \
  --backend-set-name "$PORTAL_BACKEND_SET_NAME" \
  --ip-address "$new_private_ip" \
  --port "$portal_port" \
  --weight 1 \
  --backup true \
  --drain false \
  --offline false \
  --auth resource_principal \
  --region "$OCI_REGION" \
  --wait-for-state SUCCEEDED

smoke_direct "$new_backend_name"
mark_backend "$new_backend_name" false false false
mark_existing_backends_drain
smoke_public
delete_old_backends
delete_old_portal_instances

trap - ERR
printf 'PORTAL_CONTAINER_INSTANCE_ID=%s\n' "$new_container_id"
printf 'PORTAL_BACKEND_NAME=%s\n' "$new_backend_name"
