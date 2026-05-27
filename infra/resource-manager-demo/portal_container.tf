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

resource "oci_core_network_security_group" "portal" {
  count = var.portal_container_enabled ? 1 : 0

  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.portal[0].id
  display_name   = "enterprise-ai-demo-portal-${var.resource_suffix}-nsg"
  freeform_tags  = local.portal_tags
}

resource "oci_core_network_security_group_security_rule" "portal_ingress" {
  count = var.portal_container_enabled ? 1 : 0

  network_security_group_id = oci_core_network_security_group.portal[0].id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = "0.0.0.0/0"
  source_type               = "CIDR_BLOCK"
  description               = "Allow public HTTP access to the demo portal."

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

data "local_file" "file_search_vector_store" {
  count = var.portal_container_enabled && var.file_search_local_exec_enabled ? 1 : 0

  filename = "${path.module}/../file-search-vector-store-rag/.terraform/generated/vector_store.json"

  depends_on = [module.file_search_vector_store_rag]
}

data "local_file" "code_interpreter_container" {
  count = var.portal_container_enabled && var.code_interpreter_local_exec_enabled ? 1 : 0

  filename = "${path.module}/../code-interpreter/.terraform/generated/container.json"

  depends_on = [module.code_interpreter]
}

resource "oci_container_instances_container_instance" "portal" {
  count = var.portal_container_enabled ? 1 : 0

  availability_domain = data.oci_identity_availability_domains.portal.availability_domains[0].name
  compartment_id      = var.compartment_id
  display_name        = local.portal_display_name
  shape               = var.portal_container_shape
  freeform_tags       = local.portal_tags

  shape_config {
    ocpus         = var.portal_container_ocpus
    memory_in_gbs = var.portal_container_memory_gbs
  }

  vnics {
    display_name           = "${local.portal_display_name}-vnic"
    hostname_label         = "portal"
    is_public_ip_assigned  = true
    nsg_ids                = [oci_core_network_security_group.portal[0].id]
    subnet_id              = oci_core_subnet.portal_public[0].id
    skip_source_dest_check = false
  }

  containers {
    display_name = "portal"
    image_url    = local.portal_container_image_uri

    environment_variables = {
      HOST                                 = "0.0.0.0"
      OCI_GENAI_API_KEY                    = var.oci_genai_api_key
      OCI_GENAI_CODE_INTERPRETER_CONTAINER = local.portal_code_interpreter_container_id
      OCI_GENAI_PROJECT_ID                 = var.oci_genai_project_id
      OCI_GENAI_REGION                     = var.region
      OCI_GENAI_VECTOR_STORE_ID            = local.portal_vector_store_id
      OCI_HOSTED_APP_IDCS_AUDIENCE         = var.idcs_audience
      OCI_HOSTED_APP_IDCS_CLIENT_ID        = module.hosted_agentic_applications.n8n_idcs_launch_client_id
      OCI_HOSTED_APP_IDCS_CLIENT_SECRET    = module.hosted_agentic_applications.n8n_idcs_launch_client_secret
      OCI_HOSTED_APP_IDCS_DOMAIN_URL       = var.idcs_domain_url
      OCI_HOSTED_APP_IDCS_SCOPE            = var.idcs_scope
      OCI_HOSTED_APP_IDCS_TOKEN_URL        = "${trimsuffix(var.idcs_domain_url, "/")}/oauth2/v1/token"
      OCI_HOSTED_AGENT_DEPLOYMENT_ID       = local.hosted_deployment_exports.HOSTED_AGENT_DEPLOYMENT_ID
      OCI_HOSTED_AGENT_URL                 = local.hosted_deployment_exports.HOSTED_AGENT_URL
      OCI_HOSTED_LANGFUSE_DEPLOYMENT_ID    = local.hosted_deployment_exports.LANGFUSE_DEPLOYMENT_ID
      OCI_HOSTED_LANGFUSE_URL              = local.hosted_deployment_exports.LANGFUSE_URL
      OCI_HOSTED_LANGGRAPH_DEPLOYMENT_ID   = local.hosted_deployment_exports.LANGGRAPH_DEPLOYMENT_ID
      OCI_HOSTED_LANGGRAPH_URL             = local.hosted_deployment_exports.LANGGRAPH_URL
      OCI_HOSTED_LLAMAINDEX_DEPLOYMENT_ID  = local.hosted_deployment_exports.LLAMAINDEX_DEPLOYMENT_ID
      OCI_HOSTED_LLAMAINDEX_URL            = local.hosted_deployment_exports.LLAMAINDEX_URL
      OCI_HOSTED_OPENCLAW_DEPLOYMENT_ID    = local.hosted_deployment_exports.OPENCLAW_DEPLOYMENT_ID
      OCI_HOSTED_OPENCLAW_URL              = local.hosted_deployment_exports.OPENCLAW_URL
      PORT                                 = tostring(var.portal_container_port)
      OCI_PORTAL_PASSWORD                  = local.portal_auth_password
      OCI_RESOURCE_SUFFIX                  = var.resource_suffix
    }

    health_checks {
      health_check_type        = "HTTP"
      name                     = "portal-http"
      path                     = "/"
      port                     = var.portal_container_port
      initial_delay_in_seconds = 60
      interval_in_seconds      = 30
      timeout_in_seconds       = 5
      failure_threshold        = 5
      success_threshold        = 1
      failure_action           = "KILL"
    }

    resource_config {
      memory_limit_in_gbs = var.portal_container_memory_gbs
      vcpus_limit         = var.portal_container_ocpus
    }
  }

  depends_on = [
    oci_artifacts_container_repository.portal,
    module.shared_demo_security,
    module.file_search_vector_store_rag,
    module.code_interpreter,
    module.devops_hosted_image_build
  ]
}

data "oci_core_vnic" "portal" {
  count = var.portal_container_enabled ? 1 : 0

  vnic_id = oci_container_instances_container_instance.portal[0].vnics[0].vnic_id
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
    var.portal_container_image_tag
  )
  portal_auth_password = var.portal_auth_password != "" ? var.portal_auth_password : random_password.portal_auth[0].result
  portal_vector_store_id = (
    var.file_search_local_exec_enabled
    ? try(jsondecode(data.local_file.file_search_vector_store[0].content).id, "")
    : ""
  )
  portal_code_interpreter_container_id = (
    var.code_interpreter_local_exec_enabled
    ? try(jsondecode(data.local_file.code_interpreter_container[0].content).id, "")
    : ""
  )
  hosted_deployment_exports = merge({
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
  }, module.devops_hosted_image_build.hosted_deployment_exports)
}
