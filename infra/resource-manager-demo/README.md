# Enterprise AI Demo Resource Manager Stack

This Terraform root is the OCI Resource Manager entry point for the demo. Package the repository as a Terraform configuration zip and set the stack working directory to `infra/resource-manager-demo`. The working directory `infra/resource-manager-demo` must be used for plan and apply jobs.

[![Deploy to Oracle Cloud](https://oci-resourcemanager-plugin.plugins.oci.oraclecloud.com/latest/deploy-to-oracle-cloud.svg)](https://cloud.oracle.com/resourcemanager/stacks/create?zipUrl=https://github.com/RahulMR42/oci_enterprise_ai_demo/releases/latest/download/enterprise-ai-demo-resource-manager-stack.zip)

The button uses the latest GitHub release asset `enterprise-ai-demo-resource-manager-stack.zip`. Release assets are published by `.github/workflows/release-resource-manager-stack.yml`.

The stack wires every Terraform-based deployment module:

- `infra/responses-api`
- `infra/shared-demo-security`
- `infra/file-search-vector-store-rag`
- `infra/code-interpreter`
- `infra/nl2sql-sql-search`
- `infra/hosted-agentic-applications`
- `infra/devops-hosted-image-build`

OCI Resource Manager should keep local container build/push disabled. Set `hosted_app_push_image=false`; the stack uses OCI DevOps to build the hosted app images, publish the OCIR artifacts, and deploy the hosted applications.

The stack also creates a public OCI Container Instance for the portal. After apply, use the `portal_url`, `portal_login_user`, and sensitive `portal_login_password` outputs to validate the portal and demos.

See `docs/deployment/resource-manager-one-click.md` for full deployment instructions.
