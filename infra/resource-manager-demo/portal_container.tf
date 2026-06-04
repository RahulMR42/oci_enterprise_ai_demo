data "oci_identity_availability_domains" "portal" {
  compartment_id = var.tenancy_id
}

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

resource "random_password" "portal_auth" {
  count = var.portal_container_enabled && var.portal_auth_password == "" ? 1 : 0

  length           = 24
  min_lower        = 4
  min_numeric      = 4
  min_special      = 2
  min_upper        = 4
  override_special = "-_"

  keepers = {
    resource_suffix = var.resource_suffix
  }
}

resource "oci_core_vcn" "portal" {
  count = var.portal_container_enabled ? 1 : 0

  compartment_id = var.compartment_id
  cidr_blocks    = [var.portal_vcn_cidr]
  display_name   = "enterprise-ai-demo-portal-${var.resource_suffix}-vcn"
  dns_label      = "portal${replace(var.resource_suffix, "-", "")}"
  freeform_tags  = local.portal_tags
}

resource "oci_core_internet_gateway" "portal" {
  count = var.portal_container_enabled ? 1 : 0

  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.portal[0].id
  display_name   = "enterprise-ai-demo-portal-${var.resource_suffix}-igw"
  enabled        = true
  freeform_tags  = local.portal_tags
}

resource "oci_core_nat_gateway" "portal" {
  count = var.portal_container_enabled ? 1 : 0

  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.portal[0].id
  display_name   = "enterprise-ai-demo-portal-${var.resource_suffix}-nat"
  freeform_tags  = local.portal_tags
}

resource "oci_core_route_table" "portal_public" {
  count = var.portal_container_enabled ? 1 : 0

  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.portal[0].id
  display_name   = "enterprise-ai-demo-portal-${var.resource_suffix}-public-routes"
  freeform_tags  = local.portal_tags

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.portal[0].id
  }
}

resource "oci_core_route_table" "portal_private" {
  count = var.portal_container_enabled ? 1 : 0

  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.portal[0].id
  display_name   = "enterprise-ai-demo-portal-${var.resource_suffix}-private-routes"
  freeform_tags  = local.portal_tags

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_nat_gateway.portal[0].id
  }
}

resource "oci_core_subnet" "portal_public" {
  count = var.portal_container_enabled ? 1 : 0

  compartment_id             = var.compartment_id
  vcn_id                     = oci_core_vcn.portal[0].id
  cidr_block                 = var.portal_subnet_cidr
  display_name               = "enterprise-ai-demo-portal-${var.resource_suffix}-public-subnet"
  dns_label                  = "portal"
  prohibit_internet_ingress  = false
  prohibit_public_ip_on_vnic = false
  route_table_id             = oci_core_route_table.portal_public[0].id
  freeform_tags              = local.portal_tags
}

resource "oci_core_subnet" "portal_private" {
  count = var.portal_container_enabled ? 1 : 0

  compartment_id             = var.compartment_id
  vcn_id                     = oci_core_vcn.portal[0].id
  cidr_block                 = var.portal_private_subnet_cidr
  display_name               = "enterprise-ai-demo-portal-${var.resource_suffix}-private-subnet"
  dns_label                  = "portalp"
  prohibit_internet_ingress  = true
  prohibit_public_ip_on_vnic = true
  route_table_id             = oci_core_route_table.portal_private[0].id
  freeform_tags              = local.portal_tags
}

resource "oci_core_network_security_group" "portal" {
  count = var.portal_container_enabled ? 1 : 0

  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.portal[0].id
  display_name   = "enterprise-ai-demo-portal-${var.resource_suffix}-nsg"
  freeform_tags  = local.portal_tags
}

resource "oci_core_network_security_group" "portal_lb" {
  count = var.portal_container_enabled ? 1 : 0

  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.portal[0].id
  display_name   = "enterprise-ai-demo-portal-${var.resource_suffix}-lb-nsg"
  freeform_tags  = local.portal_tags
}

resource "oci_core_network_security_group_security_rule" "portal_ingress" {
  count = var.portal_container_enabled ? 1 : 0

  network_security_group_id = oci_core_network_security_group.portal[0].id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = var.portal_subnet_cidr
  source_type               = "CIDR_BLOCK"
  description               = "Allow the portal load balancer to reach the demo portal container."

  tcp_options {
    destination_port_range {
      min = var.portal_container_port
      max = var.portal_container_port
    }
  }
}

resource "oci_core_network_security_group_security_rule" "portal_egress" {
  count = var.portal_container_enabled ? 1 : 0

  network_security_group_id = oci_core_network_security_group.portal[0].id
  direction                 = "EGRESS"
  protocol                  = "all"
  destination               = "0.0.0.0/0"
  destination_type          = "CIDR_BLOCK"
  description               = "Allow the demo portal to reach OCI APIs and external dependencies."
}

resource "oci_core_network_security_group_security_rule" "portal_lb_ingress" {
  count = var.portal_container_enabled ? 1 : 0

  network_security_group_id = oci_core_network_security_group.portal_lb[0].id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = "0.0.0.0/0"
  source_type               = "CIDR_BLOCK"
  description               = "Allow public HTTP access to the portal load balancer."

  tcp_options {
    destination_port_range {
      min = 80
      max = 80
    }
  }
}

resource "oci_core_network_security_group_security_rule" "portal_lb_egress" {
  count = var.portal_container_enabled ? 1 : 0

  network_security_group_id = oci_core_network_security_group.portal_lb[0].id
  direction                 = "EGRESS"
  protocol                  = "6"
  destination               = var.portal_private_subnet_cidr
  destination_type          = "CIDR_BLOCK"
  description               = "Allow the portal load balancer to reach the portal container backend."

  tcp_options {
    destination_port_range {
      min = var.portal_container_port
      max = var.portal_container_port
    }
  }
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

resource "oci_load_balancer_load_balancer" "portal" {
  count = var.portal_container_enabled ? 1 : 0

  compartment_id             = var.compartment_id
  display_name               = "enterprise-ai-demo-portal-${var.resource_suffix}-lb"
  shape                      = "flexible"
  subnet_ids                 = [oci_core_subnet.portal_public[0].id]
  is_private                 = false
  network_security_group_ids = [oci_core_network_security_group.portal_lb[0].id]
  freeform_tags              = local.portal_tags

  shape_details {
    minimum_bandwidth_in_mbps = 10
    maximum_bandwidth_in_mbps = 10
  }
}

resource "oci_load_balancer_backend_set" "portal" {
  count = var.portal_container_enabled ? 1 : 0

  load_balancer_id = oci_load_balancer_load_balancer.portal[0].id
  name             = "portal-backend"
  policy           = "ROUND_ROBIN"

  health_checker {
    protocol          = "HTTP"
    port              = var.portal_container_port
    url_path          = "/login"
    return_code       = 200
    interval_ms       = 10000
    retries           = 3
    timeout_in_millis = 3000
  }
}

resource "oci_load_balancer_listener" "portal_http" {
  count = var.portal_container_enabled ? 1 : 0

  load_balancer_id         = oci_load_balancer_load_balancer.portal[0].id
  name                     = "portal-http"
  default_backend_set_name = oci_load_balancer_backend_set.portal[0].name
  port                     = 80
  protocol                 = "HTTP"
}

locals {
  portal_display_name = "enterprise-ai-demo-portal-${var.resource_suffix}"
  portal_url          = var.portal_container_enabled ? "http://${oci_load_balancer_load_balancer.portal[0].ip_address_details[0].ip_address}" : ""
  portal_tags = {
    "enterprise-ai-demo" = "true"
    "demo"               = "portal"
  }
  portal_container_image_uri = var.portal_container_image_uri != "" ? var.portal_container_image_uri : format(
    "%s.ocir.io/%s/%s:%s",
    var.hosted_app_ocir_region_key,
    data.oci_objectstorage_namespace.portal.namespace,
    var.portal_container_repository_name,
    var.portal_container_image_tag
  )
  portal_auth_password                      = var.portal_auth_password != "" ? var.portal_auth_password : random_password.portal_auth[0].result
  conversation_store_generated_file         = "${path.module}/../conversation-store/.terraform/generated/conversation.json"
  file_search_vector_store_generated_file   = "${path.module}/../file-search-vector-store-rag/.terraform/generated/vector_store.json"
  code_interpreter_container_generated_file = "${path.module}/../code-interpreter/.terraform/generated/container.json"
  portal_conversation_id = (
    var.conversation_store_local_exec_enabled
    ? try(data.external.conversation_store[0].result.id, "")
    : ""
  )
  portal_vector_store_id = (
    var.file_search_local_exec_enabled
    ? try(data.external.file_search_vector_store[0].result.id, "")
    : ""
  )
  portal_code_interpreter_container_id = (
    var.code_interpreter_local_exec_enabled
    ? try(data.external.code_interpreter_container[0].result.id, "")
    : ""
  )
  default_hosted_deployment_exports = {
    HOSTED_AGENT_DEPLOYMENT_ID = ""
    HOSTED_AGENT_URL           = ""
    LANGFUSE_DEPLOYMENT_ID     = ""
    LANGFUSE_URL               = ""
    LANGGRAPH_DEPLOYMENT_ID    = ""
    LANGGRAPH_URL              = ""
    LLAMAINDEX_DEPLOYMENT_ID   = ""
    LLAMAINDEX_URL             = ""
    OPENCLAW_DEPLOYMENT_ID     = ""
    OPENCLAW_URL               = ""
  }
  existing_hosted_deployment_exports = {
    for key, value in try(jsondecode(var.existing_hosted_deployment_exports_json), {}) :
    key => tostring(value)
    if contains(keys(local.default_hosted_deployment_exports), key)
  }
  current_hosted_deployment_exports = module.devops_hosted_image_build.hosted_deployment_exports
  non_empty_current_hosted_deployment_exports = {
    for key, value in local.current_hosted_deployment_exports :
    key => tostring(value)
    if tostring(value) != ""
  }
  stale_hosted_deployment_export_keys = var.deploy_only_app ? [] : [
    for key, value in local.current_hosted_deployment_exports :
    key if tostring(value) == "" && contains(keys(local.existing_hosted_deployment_exports), key)
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
  portal_runtime_config = {
    resourceSuffix               = var.resource_suffix
    region                       = var.region
    sourceRevision               = var.devops_source_revision
    codeSourceRepoUrl            = var.devops_source_repo_url
    codeSourceBranch             = var.devops_source_branch
    projectId                    = var.oci_genai_project_id
    conversationId               = local.portal_conversation_id
    vectorStoreId                = local.portal_vector_store_id
    codeInterpreterContainerId   = local.portal_code_interpreter_container_id
    hosted                       = local.hosted_deployment_exports
    runHistoryObjectNamespace    = data.oci_objectstorage_namespace.portal.namespace
    runHistoryObjectBucket       = var.portal_container_enabled ? oci_objectstorage_bucket.portal_config[0].name : ""
    runHistoryObjectName         = "portal-demo-run-summary.json"
    runtimeConfigObjectNamespace = data.oci_objectstorage_namespace.portal.namespace
    runtimeConfigObjectBucket    = var.portal_container_enabled ? oci_objectstorage_bucket.portal_config[0].name : ""
    runtimeConfigObjectName      = "portal-runtime-config.json"
  }
}
