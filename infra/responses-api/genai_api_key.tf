resource "terraform_data" "generative_ai_api_key" {
  triggers_replace = [timestamp()]

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

      oci_auth_args="--auth resource_principal"
      if [ -n '${self.input.profile}' ]; then
        oci_auth_args="--profile '${self.input.profile}'"
      else
        python3 -m pip install --user --quiet --upgrade oci-cli
        export PATH="$HOME/.local/bin:$PATH"
      fi
      api_key_json="$(oci generative-ai api-key create \
        --compartment-id '${self.input.compartment_id}' \
        --display-name '${self.input.api_key_display_name}' \
        --key-details '[{"keyName":"${self.input.api_key_display_name}","timeExpiry":"${self.input.api_key_expiry}"}]' \
        $oci_auth_args \
        --region '${self.input.region}' \
        --output json)"
      printf '%s\n' "$api_key_json" > '${path.module}/.terraform/generated/api_key.json'
      printf '%s\n' "$api_key_json"
    EOT
  }
}
