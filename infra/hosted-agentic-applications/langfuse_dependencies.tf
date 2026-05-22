data "oci_identity_availability_domains" "langfuse" {
  compartment_id = var.compartment_id
}

data "oci_core_services" "all" {}

data "oci_objectstorage_namespace" "langfuse" {
  compartment_id = var.compartment_id
}

resource "oci_core_vcn" "langfuse" {
  compartment_id = var.compartment_id
  cidr_blocks    = [var.langfuse_vcn_cidr]
  display_name   = local.langfuse_vcn_display_name
  dns_label      = "lf${var.resource_suffix}"
  freeform_tags  = local.langfuse_tags
}

resource "oci_core_nat_gateway" "langfuse" {
  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.langfuse.id
  display_name   = "${local.langfuse_application_display_name}-nat"
  freeform_tags  = local.langfuse_tags
}

resource "oci_core_service_gateway" "langfuse" {
  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.langfuse.id
  display_name   = "${local.langfuse_application_display_name}-service-gateway"
  freeform_tags  = local.langfuse_tags

  services {
    service_id = local.langfuse_oracle_services_network.id
  }
}

resource "oci_core_route_table" "langfuse_private" {
  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.langfuse.id
  display_name   = "${local.langfuse_application_display_name}-private-routes"
  freeform_tags  = local.langfuse_tags

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_nat_gateway.langfuse.id
  }

  route_rules {
    destination       = local.langfuse_oracle_services_network.cidr_block
    destination_type  = "SERVICE_CIDR_BLOCK"
    network_entity_id = oci_core_service_gateway.langfuse.id
  }
}

resource "oci_core_subnet" "langfuse_private" {
  compartment_id             = var.compartment_id
  vcn_id                     = oci_core_vcn.langfuse.id
  cidr_block                 = var.langfuse_subnet_cidr
  display_name               = "${local.langfuse_application_display_name}-private-subnet"
  dns_label                  = "lfdeps"
  prohibit_internet_ingress  = true
  prohibit_public_ip_on_vnic = true
  route_table_id             = oci_core_route_table.langfuse_private.id
  freeform_tags              = local.langfuse_tags
}

resource "oci_core_network_security_group" "langfuse_hosted_app" {
  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.langfuse.id
  display_name   = "${local.langfuse_application_display_name}-hosted-app-nsg"
  freeform_tags  = local.langfuse_tags
}

resource "oci_core_network_security_group" "langfuse_dependencies" {
  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.langfuse.id
  display_name   = "${local.langfuse_application_display_name}-dependencies-nsg"
  freeform_tags  = local.langfuse_tags
}

resource "oci_core_network_security_group_security_rule" "langfuse_app_egress_private" {
  network_security_group_id = oci_core_network_security_group.langfuse_hosted_app.id
  direction                 = "EGRESS"
  protocol                  = "6"
  destination               = var.langfuse_subnet_cidr
  destination_type          = "CIDR_BLOCK"
  description               = "Allow Langfuse hosted app egress to private dependencies."
}

resource "oci_core_network_security_group_security_rule" "langfuse_app_egress_object_storage" {
  network_security_group_id = oci_core_network_security_group.langfuse_hosted_app.id
  direction                 = "EGRESS"
  protocol                  = "6"
  destination               = local.langfuse_oracle_services_network.cidr_block
  destination_type          = "SERVICE_CIDR_BLOCK"
  description               = "Allow Langfuse hosted app egress to OCI Object Storage through the service gateway."
}

resource "oci_core_network_security_group_security_rule" "langfuse_dependencies_ingress" {
  for_each = toset(["5432", "6379", "8123", "9000"])

  network_security_group_id = oci_core_network_security_group.langfuse_dependencies.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = var.langfuse_subnet_cidr
  source_type               = "CIDR_BLOCK"
  description               = "Allow Langfuse hosted app private subnet traffic to dependency port ${each.value}."

  tcp_options {
    destination_port_range {
      min = tonumber(each.value)
      max = tonumber(each.value)
    }
  }
}

resource "oci_core_network_security_group_security_rule" "langfuse_dependencies_ingress_from_hosted_app_nsg" {
  for_each = toset(["5432", "6379", "8123", "9000"])

  network_security_group_id = oci_core_network_security_group.langfuse_dependencies.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = oci_core_network_security_group.langfuse_hosted_app.id
  source_type               = "NETWORK_SECURITY_GROUP"
  description               = "Allow Langfuse hosted app NSG traffic to dependency port ${each.value}."

  tcp_options {
    destination_port_range {
      min = tonumber(each.value)
      max = tonumber(each.value)
    }
  }
}

resource "oci_core_network_security_group_security_rule" "langfuse_dependencies_egress" {
  network_security_group_id = oci_core_network_security_group.langfuse_dependencies.id
  direction                 = "EGRESS"
  protocol                  = "all"
  destination               = "0.0.0.0/0"
  destination_type          = "CIDR_BLOCK"
  description               = "Allow dependency containers to pull public images and reach OCI services."
}

resource "oci_psql_db_system" "langfuse" {
  compartment_id              = var.compartment_id
  display_name                = local.langfuse_postgres_display_name
  db_version                  = var.langfuse_postgres_db_version
  shape                       = var.langfuse_postgres_shape
  instance_count              = 1
  instance_ocpu_count         = var.langfuse_postgres_ocpus
  instance_memory_size_in_gbs = var.langfuse_postgres_memory_gbs
  system_type                 = "OCI_OPTIMIZED_STORAGE"
  freeform_tags               = local.langfuse_tags

  credentials {
    username = var.langfuse_postgres_username

    password_details {
      password_type = "PLAIN_TEXT"
      password      = local.langfuse_postgres_password
    }
  }

  network_details {
    subnet_id                      = oci_core_subnet.langfuse_private.id
    nsg_ids                        = [oci_core_network_security_group.langfuse_dependencies.id]
    primary_db_endpoint_private_ip = local.langfuse_postgres_private_ip
    is_reader_endpoint_enabled     = false
  }

  storage_details {
    availability_domain   = data.oci_identity_availability_domains.langfuse.availability_domains[0].name
    is_regionally_durable = false
    system_type           = "OCI_OPTIMIZED_STORAGE"
  }
}

data "oci_psql_db_system_connection_detail" "langfuse" {
  db_system_id = oci_psql_db_system.langfuse.id
}

resource "oci_container_instances_container_instance" "langfuse_clickhouse" {
  availability_domain = data.oci_identity_availability_domains.langfuse.availability_domains[0].name
  compartment_id      = var.compartment_id
  display_name        = local.langfuse_clickhouse_display_name
  shape               = var.langfuse_dependency_container_shape
  freeform_tags       = local.langfuse_tags

  shape_config {
    ocpus = var.langfuse_clickhouse_ocpus
  }

  vnics {
    display_name           = "${local.langfuse_clickhouse_display_name}-vnic"
    hostname_label         = "lfclickhouse"
    is_public_ip_assigned  = false
    nsg_ids                = [oci_core_network_security_group.langfuse_dependencies.id]
    private_ip             = local.langfuse_clickhouse_private_ip
    subnet_id              = oci_core_subnet.langfuse_private.id
    skip_source_dest_check = false
  }

  containers {
    display_name = "clickhouse"
    image_url    = var.langfuse_clickhouse_image

    environment_variables = {
      CLICKHOUSE_DB       = "default"
      CLICKHOUSE_USER     = var.langfuse_clickhouse_user != "" ? var.langfuse_clickhouse_user : "clickhouse"
      CLICKHOUSE_PASSWORD = local.langfuse_clickhouse_password
    }

    resource_config {
      memory_limit_in_gbs = var.langfuse_clickhouse_memory_gbs
      vcpus_limit         = var.langfuse_clickhouse_ocpus
    }

    volume_mounts {
      mount_path   = "/etc/clickhouse-server/config.d"
      volume_name  = "clickhouse-listen-config"
      is_read_only = true
    }
  }

  volumes {
    name        = "clickhouse-listen-config"
    volume_type = "CONFIGFILE"

    configs {
      file_name = "listen.xml"
      data = base64encode(<<-EOT
        <clickhouse>
          <listen_host>0.0.0.0</listen_host>
        </clickhouse>
      EOT
      )
    }
  }
}

resource "oci_container_instances_container_instance" "langfuse_redis" {
  availability_domain = data.oci_identity_availability_domains.langfuse.availability_domains[0].name
  compartment_id      = var.compartment_id
  display_name        = local.langfuse_redis_display_name
  shape               = var.langfuse_dependency_container_shape
  freeform_tags       = local.langfuse_tags

  shape_config {
    ocpus = var.langfuse_redis_ocpus
  }

  vnics {
    display_name           = "${local.langfuse_redis_display_name}-vnic"
    hostname_label         = "lfredis"
    is_public_ip_assigned  = false
    nsg_ids                = [oci_core_network_security_group.langfuse_dependencies.id]
    private_ip             = local.langfuse_redis_private_ip
    subnet_id              = oci_core_subnet.langfuse_private.id
    skip_source_dest_check = false
  }

  containers {
    display_name = "redis"
    image_url    = var.langfuse_redis_image
    command      = ["redis-server"]
    arguments    = ["--requirepass", local.langfuse_redis_password, "--maxmemory-policy", "noeviction"]

    resource_config {
      memory_limit_in_gbs = var.langfuse_redis_memory_gbs
      vcpus_limit         = var.langfuse_redis_ocpus
    }
  }
}

resource "oci_objectstorage_bucket" "langfuse" {
  compartment_id = var.compartment_id
  namespace      = data.oci_objectstorage_namespace.langfuse.namespace
  name           = local.langfuse_bucket_name
  access_type    = "NoPublicAccess"
  storage_tier   = "Standard"
  freeform_tags  = local.langfuse_tags
}

locals {
  langfuse_oracle_services_network = one([
    for service in data.oci_core_services.all.services : service
    if can(regex("^All .* Services In Oracle Services Network$", service.name))
  ])

  langfuse_tags = {
    "enterprise-ai-demo" = "true"
    "demo"               = "langfuse-hosted-observability"
  }

  langfuse_vcn_display_name        = "${local.langfuse_application_display_name}-vcn"
  langfuse_postgres_display_name   = "${local.langfuse_application_display_name}-postgres"
  langfuse_clickhouse_display_name = "${local.langfuse_application_display_name}-clickhouse"
  langfuse_redis_display_name      = "${local.langfuse_application_display_name}-redis"
  langfuse_bucket_name             = replace("${local.langfuse_application_display_name}-bucket", "_", "-")

  langfuse_postgres_private_ip   = cidrhost(var.langfuse_subnet_cidr, 20)
  langfuse_clickhouse_private_ip = cidrhost(var.langfuse_subnet_cidr, 30)
  langfuse_redis_private_ip      = cidrhost(var.langfuse_subnet_cidr, 31)

  langfuse_postgres_password   = var.langfuse_postgres_password != "" ? var.langfuse_postgres_password : "LfPg${var.resource_suffix}Demo2026"
  langfuse_clickhouse_password = var.langfuse_clickhouse_password != "" ? var.langfuse_clickhouse_password : substr(sha256("${var.resource_suffix}-langfuse-clickhouse"), 0, 32)
  langfuse_redis_password      = var.langfuse_redis_password != "" ? var.langfuse_redis_password : substr(sha256("${var.resource_suffix}-langfuse-redis"), 0, 32)

  langfuse_managed_database_url = format(
    "postgresql://%s:%s@%s:%s/postgres?sslmode=require",
    var.langfuse_postgres_username,
    local.langfuse_postgres_password,
    data.oci_psql_db_system_connection_detail.langfuse.primary_db_endpoint[0].fqdn,
    data.oci_psql_db_system_connection_detail.langfuse.primary_db_endpoint[0].port
  )
  langfuse_managed_clickhouse_url           = "http://${local.langfuse_clickhouse_private_ip}:8123"
  langfuse_managed_clickhouse_migration_url = "clickhouse://${local.langfuse_clickhouse_private_ip}:9000/default"
  langfuse_managed_redis_connection_string  = "redis://:${local.langfuse_redis_password}@${local.langfuse_redis_private_ip}:6379"
  langfuse_managed_object_storage_endpoint  = "https://objectstorage.${var.region}.oraclecloud.com"

  langfuse_effective_database_url             = var.langfuse_database_url != "" ? var.langfuse_database_url : local.langfuse_managed_database_url
  langfuse_effective_clickhouse_url           = var.langfuse_clickhouse_url != "" ? var.langfuse_clickhouse_url : local.langfuse_managed_clickhouse_url
  langfuse_effective_clickhouse_migration_url = var.langfuse_clickhouse_migration_url != "" ? var.langfuse_clickhouse_migration_url : local.langfuse_managed_clickhouse_migration_url
  langfuse_effective_clickhouse_user          = var.langfuse_clickhouse_user != "" ? var.langfuse_clickhouse_user : "clickhouse"
  langfuse_effective_clickhouse_password      = local.langfuse_clickhouse_password
  langfuse_effective_redis_connection_string  = var.langfuse_redis_connection_string != "" ? var.langfuse_redis_connection_string : local.langfuse_managed_redis_connection_string
  langfuse_effective_s3_event_upload_bucket   = var.langfuse_s3_event_upload_bucket != "" ? var.langfuse_s3_event_upload_bucket : oci_objectstorage_bucket.langfuse.name
  langfuse_effective_s3_media_upload_bucket   = var.langfuse_s3_media_upload_bucket != "" ? var.langfuse_s3_media_upload_bucket : oci_objectstorage_bucket.langfuse.name
  langfuse_effective_s3_upload_region         = var.langfuse_s3_upload_region != "" ? var.langfuse_s3_upload_region : var.region
  langfuse_effective_s3_upload_endpoint       = var.langfuse_s3_upload_endpoint != "" ? var.langfuse_s3_upload_endpoint : local.langfuse_managed_object_storage_endpoint
  langfuse_effective_nextauth_secret          = var.langfuse_nextauth_secret != "" ? var.langfuse_nextauth_secret : sha256("${var.resource_suffix}-langfuse-nextauth")
  langfuse_effective_salt                     = var.langfuse_salt != "" ? var.langfuse_salt : sha256("${var.resource_suffix}-langfuse-salt")
  langfuse_effective_encryption_key           = var.langfuse_encryption_key != "" ? var.langfuse_encryption_key : sha256("${var.resource_suffix}-langfuse-encryption")
  langfuse_hosted_networking_config_json = jsonencode({
    inboundNetworkingConfig = {
      endpointMode = "PUBLIC"
    }
    outboundNetworkingConfig = {
      networkMode    = "CUSTOM"
      customSubnetId = oci_core_subnet.langfuse_private.id
      nsgIds         = [oci_core_network_security_group.langfuse_hosted_app.id]
    }
  })
}
