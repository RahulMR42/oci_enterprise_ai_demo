resource "terraform_data" "generative_ai_project" {
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
      project_json="$(oci generative-ai generative-ai-project create \
        --compartment-id '${self.input.compartment_id}' \
        --display-name '${self.input.project_display_name}' \
        --profile '${self.input.profile}' \
        --region '${self.input.region}' \
        --output json)"
      printf '%s\n' "$project_json" > '${path.module}/.terraform/generated/project.json'
      printf '%s\n' "$project_json"
    EOT
  }
}
