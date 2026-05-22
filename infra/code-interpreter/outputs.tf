output "deployment_requirement" {
  description = "Infrastructure ownership rule for the Code Interpreter demo."
  value       = "Uses shared Responses API project/API key infrastructure and creates a reusable Code Interpreter container through the OCI OpenAI-compatible Containers API."
}

output "shared_infrastructure_module" {
  description = "Shared Terraform module used for OCI Generative AI project/API key provisioning."
  value       = "../responses-api"
}

output "runtime_container_env_var" {
  description = "Optional environment variable consumed by backend/demos/code_interpreter.py."
  value       = "OCI_GENAI_CODE_INTERPRETER_CONTAINER"
}

output "container_generated_file" {
  description = "Generated Container API response file. Copy its id to OCI_GENAI_CODE_INTERPRETER_CONTAINER."
  value       = "${path.module}/.terraform/generated/container.json"
}
