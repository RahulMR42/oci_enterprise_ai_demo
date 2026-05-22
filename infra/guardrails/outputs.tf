output "deployment_requirement" {
  description = "Infrastructure ownership rule for the Guardrails demo."
  value       = "No standalone OCI resources are required today. Any future policy, logging, secret, or networking dependency for this demo must be managed by this Terraform module."
}

output "shared_infrastructure_module" {
  description = "Shared Terraform module used for OCI Generative AI project/API key provisioning."
  value       = "../responses-api"
}
