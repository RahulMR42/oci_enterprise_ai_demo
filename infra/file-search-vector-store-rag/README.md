# File Search & Vector Store RAG demo infrastructure

This demo uses the shared OCI Generative AI project and API key created by `infra/responses-api`.

Terraform now owns the Vector Store creation contract through the OCI OpenAI-compatible `/vector_stores` endpoint. The local-exec provisioner stores the create response at `.terraform/generated/vector_store.json`.

The module also bundles Oracle PDFs under `assets/pdfs`. During provisioning, Terraform uploads those local PDFs through the OCI OpenAI-compatible Files API, attaches them to the vector store, waits for ingestion to complete, and writes the upload metadata to `.terraform/generated/vector_store_files.json`. Provisioning does not download documents at runtime.

```bash
terraform -chdir=infra/file-search-vector-store-rag apply \
  -var='compartment_id=<compartment-ocid>' \
  -var='region=us-chicago-1'
```

The live runtime requires `OCI_GENAI_VECTOR_STORE_ID`. Startup exports the vector store ID from `.terraform/generated/vector_store.json`; the File Search workbench also reads the provisioned ID from the infrastructure state.

To refresh the seed set for offline environments, replace the PDFs in `assets/pdfs` before running Terraform. File hashes are part of the Terraform input, so changed PDFs trigger re-upload on apply.
