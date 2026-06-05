output "deployment_requirement" {
  description = "Infrastructure ownership rule for the Conversation Store demo."
  value       = "Creates an OCI Conversations API object through the shared Responses API project/API key and writes its id for OCI_GENAI_CONVERSATION_ID."
}

output "shared_infrastructure_module" {
  description = "Shared Terraform module used for OCI Generative AI project/API key provisioning."
  value       = "../responses-api"
}

output "conversation_id_environment_variable" {
  description = "Environment variable consumed by backend/demos/conversation_store.py."
  value       = "OCI_GENAI_CONVERSATION_ID"
}

output "conversation_generated_file" {
  description = "Generated OCI Conversations API metadata."
  value       = "${path.module}/.terraform/generated/conversation.json"
}
