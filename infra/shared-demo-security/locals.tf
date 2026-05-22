locals {
  normalized_suffix  = replace(var.resource_suffix, "-", "")
  dynamic_group_name = "${var.dynamic_group_name_prefix}-${local.normalized_suffix}"
  policy_name        = "${var.policy_name_prefix}-${local.normalized_suffix}"
}
