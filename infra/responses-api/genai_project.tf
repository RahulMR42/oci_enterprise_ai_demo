resource "terraform_data" "generative_ai_project" {
  triggers_replace = [timestamp()]

  input = {
    compartment_id       = var.compartment_id
    profile              = var.profile
    project_display_name = local.project_display_name
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
      project_json="$(oci generative-ai generative-ai-project create \
        --compartment-id '${self.input.compartment_id}' \
        --display-name '${self.input.project_display_name}' \
        $oci_auth_args \
        --region '${self.input.region}' \
        --output json)"
      printf '%s\n' "$project_json" > '${path.module}/.terraform/generated/project.json'
      printf '%s\n' "$project_json"
    EOT
  }
}
