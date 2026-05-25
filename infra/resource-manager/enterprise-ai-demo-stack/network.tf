resource "oci_core_vcn" "portal" {
  count = local.create_network ? 1 : 0

  compartment_id = var.compartment_id
  cidr_blocks    = [var.vcn_cidr]
  display_name   = "${local.display_prefix}-vcn"
  dns_label      = "eai${local.name_suffix}"
  freeform_tags  = local.freeform_tags
}

resource "oci_core_internet_gateway" "portal" {
  count = local.create_network ? 1 : 0

  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.portal[0].id
  display_name   = "${local.display_prefix}-igw"
  enabled        = true
  freeform_tags  = local.freeform_tags
}

resource "oci_core_route_table" "portal" {
  count = local.create_network ? 1 : 0

  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.portal[0].id
  display_name   = "${local.display_prefix}-public-routes"
  freeform_tags  = local.freeform_tags

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.portal[0].id
  }
}

resource "oci_core_security_list" "portal" {
  count = local.create_network ? 1 : 0

  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.portal[0].id
  display_name   = "${local.display_prefix}-security-list"
  freeform_tags  = local.freeform_tags

  ingress_security_rules {
    protocol = "6"
    source   = var.allowed_ingress_cidr

    tcp_options {
      min = var.portal_port
      max = var.portal_port
    }
  }

  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }
}

resource "oci_core_subnet" "portal" {
  count = local.create_network ? 1 : 0

  compartment_id             = var.compartment_id
  vcn_id                     = oci_core_vcn.portal[0].id
  cidr_block                 = var.subnet_cidr
  display_name               = "${local.display_prefix}-public-subnet"
  dns_label                  = "portal"
  prohibit_internet_ingress  = false
  prohibit_public_ip_on_vnic = false
  route_table_id             = oci_core_route_table.portal[0].id
  security_list_ids          = [oci_core_security_list.portal[0].id]
  freeform_tags              = local.freeform_tags
}
