# Enterprise AI Demo Resource Manager Stack

This Terraform root is the OCI Resource Manager entry point for the full demo. Package the repository as a Terraform configuration zip and use the working directory `infra/resource-manager-demo`.

The stack owns shared demo infrastructure, the OCI DevOps build pipeline, hosted application deployment flow, and portal runtime configuration. Hosted application create/update operations run in OCI DevOps with resource principal auth, so Resource Manager does not need local OCI credentials for those operations.

`schema.yaml` groups Resource Manager inputs. Terraform validation covers OCIDs, branch names, CIDRs, ports, shape sizing, connection type, and Resource Manager-safe branch defaults. The default source branch is `oci-rms`; set `devops_source_revision` to the exact commit SHA the DevOps build should consume.

## What the stack deploys

The stack wires every Terraform deployment module used by the portal:

- `infra/responses-api`
- `infra/shared-demo-security`: shared dynamic group and demo policies, including repository pull access for OCI-managed runtimes.
- `infra/file-search-vector-store-rag`: File Search vector store and seed document registration.
- `infra/code-interpreter`: managed Code Interpreter container.
- `infra/nl2sql-sql-search`: Autonomous Database, Database Tools connections, KMS, and secrets for SQL Search.
- `infra/hosted-agentic-applications`: OCIR repositories, hosted application metadata, hosted deployment metadata, and IDCS launch-client metadata for hosted UI demos.
- `infra/devops-hosted-image-build`: OCI DevOps project, source repository seeding, selected image build/delivery stages, hosted deployment stages, and portal deployment.
- `infra/conversation-store`: OCI Conversations API object used by the Conversation Store demo.
- `infra/guardrails`: no-op Terraform root kept in the aggregate stack so the local policy demo is represented in the same deployment map.
- `infra/resource-manager-demo/portal_container.tf`: Enterprise AI portal image repository, Object Storage runtime config, run history object, and hosted deployment export retention.

## Image and hosted deployment flow

Resource Manager starts an OCI DevOps build run instead of building images locally. The build run clones the selected Git branch, pushes it into an OCI DevOps repository, always builds and delivers the portal image, and builds/deploys only the hosted app images selected by Resource Manager inputs.

By default, all `OCI_HA_*_DEPLOY` switches are false. Enable the hosted app that should be replaced, or set `APP_DEPLOY=all` to rebuild every hosted application. Selected hosted deployment stages run in parallel after their matching image artifacts are delivered. Every build run creates or updates the Enterprise AI portal after selected hosted deployments complete.

OCI code links in the portal are generated from `devops_source_repo_url` and `devops_source_branch`. Keep `devops_source_branch=oci-rms` for this Resource Manager deployment path, and set `devops_source_repo_url` to a customer fork when source actions should open that repository. The portal keeps the raw URL out of the page and exposes source buttons from each demo's OCI feature code panel.

Before replacing a non-portal hosted app, deployment scripts clean up older duplicate deployments and applications with the same display names. The portal deployment script uses create-or-update semantics: it reuses the active portal hosted application when the display name exists, otherwise it creates a new no-auth hosted application.

The DevOps pipeline currently publishes images for:

- hosted agent
- LangGraph hosted agent
- OpenClaw hosted gateway
- LlamaIndex control tower
- Enterprise AI portal

## Portal deployment

Set `portal_container_enabled=true` to build and deploy the portal as an OCI Generative AI hosted application. Terraform creates or adopts the portal OCIR repository and writes non-sensitive runtime metadata to Object Storage. OCI DevOps builds the portal image, creates or updates the no-auth hosted application, promotes the latest image artifact, and smoke-tests `/health`, `/api/admin/demo-runs`, and `/api/features/responses-api/state`.

Launch proxy routes use the hosted application invoke host seen by the portal request. The portal receives demo IDs, hosted URLs, hosted deployment IDs, region, project ID, Object Storage runtime config, and Vault secret references through DevOps build arguments and hosted application environment variables. Secret values such as the portal login password are passed as OCI hosted application `VAULT` variables, not plaintext.

The stack reuses the NL2SQL Autonomous Database for portal protected users and audit logs. OCI DevOps runs `bootstrap-portal-auth-schema` before portal deployment; it invokes `backend/portal_auth_store.py` with `{"action":"init_schema"}` so `PORTAL_PROTECTED_USERS`, `PORTAL_AUTH_SESSIONS`, and `PORTAL_AUDIT_EVENTS` exist before the portal receives traffic. For local-only runs, run the same `init_schema` command with `OCI_PORTAL_AUTH_DB_DSN`, `OCI_PORTAL_AUTH_DB_USER`, and either `OCI_PORTAL_AUTH_DB_PASSWORD` or `OCI_PORTAL_AUTH_DB_PASSWORD_SECRET_ID`.

If `portal_container_repository_id` is empty, the stack creates `portal_container_repository_name`. If a repository already exists, pass its OCID through `portal_container_repository_id` so the stack adopts the repository for image delivery without trying to recreate it.

Useful outputs for login and validation:

- `portal_url`
- `portal_login_user`
- `portal_login_password_secret_id`
- `portal_container_image_uri`
- `portal_container_repository_id`
- `devops_hosted_image_build_run_id`
- `devops_hosted_deployment_exports`
- `devops_hosted_image_repository_uris`

Sensitive runtime values stay in Vault, Object Storage runtime config, or Terraform sensitive outputs instead of plaintext portal configuration.
