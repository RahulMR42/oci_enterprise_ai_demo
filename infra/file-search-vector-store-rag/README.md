# File Search & Vector Store RAG Infrastructure

This demo uses the shared OCI Generative AI project and API key from `infra/responses-api`.

Terraform owns the Vector Store creation contract through the OCI OpenAI-compatible `/vector_stores` endpoint and stores the create response at `.terraform/generated/vector_store.json`.

The module bundles Oracle PDFs under `assets/pdfs`. During provisioning, Terraform uploads them through the OCI OpenAI-compatible Files API, attaches them to the vector store, waits for ingestion, and writes upload metadata to `.terraform/generated/vector_store_files.json`. Provisioning does not download documents at runtime.

```bash
terraform -chdir=infra/file-search-vector-store-rag apply \
  -var='compartment_id=<compartment-ocid>' \
  -var='region=us-chicago-1'
```

The runtime requires `OCI_GENAI_VECTOR_STORE_ID`. Startup exports the vector store ID from `.terraform/generated/vector_store.json`; the File Search workbench also reads the provisioned ID from infrastructure state.

To refresh the seed set for offline environments, replace the PDFs in `assets/pdfs` before running Terraform. File hashes are part of the Terraform input, so changed PDFs trigger re-upload on apply.
