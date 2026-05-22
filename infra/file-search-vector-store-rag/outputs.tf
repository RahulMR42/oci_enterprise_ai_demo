output "deployment_requirement" {
  description = "Infrastructure ownership rule for the File Search & Vector Store RAG demo."
  value       = "Uses shared Responses API project/API key infrastructure and creates a File Search vector store through the OCI OpenAI-compatible Vector Stores API."
}

output "shared_infrastructure_module" {
  description = "Shared Terraform module used for OCI Generative AI project/API key provisioning."
  value       = "../responses-api"
}

output "runtime_vector_store_env_var" {
  description = "Environment variable consumed by backend/demos/file_search_vector_store_rag.py."
  value       = "OCI_GENAI_VECTOR_STORE_ID"
}

output "vector_store_generated_file" {
  description = "Generated Vector Store API response file. Copy its id to OCI_GENAI_VECTOR_STORE_ID."
  value       = "${path.module}/.terraform/generated/vector_store.json"
}

output "seed_documents_generated_file" {
  description = "Generated File Search seed document upload and vector-store attachment metadata."
  value       = "${path.module}/.terraform/generated/vector_store_files.json"
}

output "seed_document_names" {
  description = "Bundled Oracle PDFs uploaded into the File Search vector store during provisioning."
  value       = local.seed_pdf_files
}
