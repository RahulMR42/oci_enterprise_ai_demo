resource "terraform_data" "generative_ai_api_key" {
  input = {
    api_key_display_name = "${var.api_key_display_name}-${local.resource_suffix}"
    api_key_expiry       = var.api_key_expiry
    compartment_id       = var.compartment_id
    profile              = var.profile
    region               = var.region
    resource_suffix      = local.resource_suffix
  }

  provisioner "local-exec" {
    command = <<-EOT
      mkdir -p '${path.module}/.terraform/generated'
      api_key_json="$(oci generative-ai api-key create \
        --compartment-id '${self.input.compartment_id}' \
        --display-name '${self.input.api_key_display_name}' \
        --key-details '[{"keyName":"${self.input.api_key_display_name}","timeExpiry":"${self.input.api_key_expiry}"}]' \
        --profile '${self.input.profile}' \
        --region '${self.input.region}' \
        --output json)"
      printf '%s\n' "$api_key_json" > '${path.module}/.terraform/generated/api_key.json'
      printf '%s\n' "$api_key_json"
    EOT
  }
}
