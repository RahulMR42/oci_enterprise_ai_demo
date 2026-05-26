# Enterprise AI Demo Resource Manager Stack

This Terraform root is the OCI Resource Manager entry point for the demo. Package the repository as a Terraform configuration zip and set the stack working directory to `infra/resource-manager-demo`. The working directory `infra/resource-manager-demo` must be used for plan and apply jobs.

The stack wires every Terraform-based deployment module:

- `infra/responses-api`
- `infra/shared-demo-security`
- `infra/file-search-vector-store-rag`
- `infra/code-interpreter`
- `infra/nl2sql-sql-search`
- `infra/hosted-agentic-applications`

OCI Resource Manager should use prebuilt image repository URIs when its worker environment cannot build and push containers. Set `hosted_app_push_image=false` and provide prebuilt image variables for hosted UI images that cannot be built inside Resource Manager.

The local portal remains a Node.js development portal. It reads generated Terraform runtime metadata from the module `.terraform/generated` directories; after Resource Manager apply, refresh those generated files locally before starting the portal.
