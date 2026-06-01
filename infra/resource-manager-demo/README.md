# Enterprise AI Demo Resource Manager Stack

This Terraform root is the OCI Resource Manager entry point for the full demo. Package the repository as a Terraform configuration zip and set the stack working directory to `infra/resource-manager-demo`. The working directory `infra/resource-manager-demo` must be used for plan and apply jobs.

The stack owns the shared demo infrastructure, OCI DevOps build pipeline, hosted application deployment flow, and stable portal load balancer/networking. Hosted application create/deploy operations and portal container rollouts run from OCI DevOps with resource principal auth. Resource Manager should not depend on local OCI credentials for those operations.

The stack includes `schema.yaml` for OCI Resource Manager input grouping and Terraform `validation` blocks for OCIDs, branch names, CIDRs, ports, shape sizing, connection type, and Resource Manager-safe branch defaults. The default source branch is `oci-rms`; set `devops_source_revision` to the exact commit SHA you want the DevOps build to consume.

## What the stack deploys

The aggregate stack wires every Terraform-based deployment module used by the portal:

- `infra/responses-api`
- `infra/shared-demo-security`: shared dynamic group and demo policies, including repository pull access for OCI-managed runtimes.
- `infra/file-search-vector-store-rag`: File Search vector store and seed document registration.
- `infra/code-interpreter`: managed Code Interpreter container.
- `infra/nl2sql-sql-search`: Autonomous Database, Database Tools connections, KMS, and secrets for SQL Search.
- `infra/hosted-agentic-applications`: OCIR repositories, hosted application metadata, and Langfuse dependencies: VCN, private subnet, NSGs, PostgreSQL, ClickHouse container instance, Redis container instance, and Object Storage.
- `infra/devops-hosted-image-build`: OCI DevOps project, source repository seeding from GitHub, selected image build stages, selected image artifact delivery stages, matching hosted deployment build stages, and the rolling portal container rollout stage.
- `infra/conversation-store` and `infra/guardrails`: no-op Terraform roots kept in the aggregate stack so the local-only demos are represented in the same deployment map.
- `infra/resource-manager-demo/portal_container.tf`: Enterprise AI portal image repository, public load balancer, VCN/subnets, NSGs, Object Storage runtime config, and run history object.

## Image and hosted deployment flow

Resource Manager starts an OCI DevOps build run instead of building images locally. The build run clones the selected GitHub branch, pushes it into an OCI DevOps repository, always builds and delivers the portal image, and only builds, delivers, and deploys hosted app images selected by Resource Manager inputs. Leave `APP_DEPLOY` empty and enable the specific `OCI_HA_*_DEPLOY` booleans you need, or set `APP_DEPLOY=all` to deploy every DevOps-built hosted app. Each selected hosted app deploy stage depends only on its matching image delivery stage, so selected deployments can run in parallel as soon as their artifacts are available.

By default, `OCI_HA_LANGFUSE_DEPLOY=true` and the other `OCI_HA_*_DEPLOY` switches are false. This deploys the Langfuse hosted app and its portal metadata while avoiding unrelated hosted app replacements. Every DevOps build run rolls a replacement Enterprise AI portal container behind the load balancer after selected hosted deployments complete.

Before creating a hosted app replacement, the deployment script deletes older hosted deployments and hosted applications with the same display names. This intentionally uses delete-then-create semantics on reruns to avoid duplicate hosted apps for the same demo name.

The DevOps pipeline currently publishes images for:

- hosted agent
- LangGraph hosted agent
- Langfuse hosted observability
- OpenClaw hosted gateway
- LlamaIndex control tower
- Enterprise AI portal

The n8n demo code remains in the repository for local/demo compatibility, but the Resource Manager DevOps image pipeline does not publish an n8n image.

## Portal deployment

Set `portal_container_enabled=true` to deploy the portal behind an OCI public load balancer. Terraform creates the load balancer in the public subnet and keeps its public IP stable. OCI DevOps creates each replacement portal container instance in the private subnet, adds it to the load balancer backend set as a backup backend, waits for load balancer health to pass, switches traffic, runs public smoke tests against `/login`, `/api/admin/demo-runs`, and `/api/features/responses-api/state`, then drains and deletes old portal backends and container instances.

Launch proxy routes such as Langfuse use the load balancer host seen by the portal request. The portal container receives the Resource Manager-created demo IDs, hosted deployment URLs, hosted deployment IDs, region, project ID, API key, Object Storage runtime config location, and portal password through DevOps build arguments and container environment variables.

If `portal_container_repository_id` is empty, the stack creates `portal_container_repository_name`. If a repository already exists, pass its OCID through `portal_container_repository_id` so the stack adopts the repository for image delivery without trying to recreate it.

Useful outputs for login and validation:

- `portal_url`
- `portal_public_ip`
- `portal_login_user`
- `portal_login_password`
- `portal_container_image_uri`
- `portal_container_repository_id`
- `devops_hosted_image_build_run_id`
- `devops_hosted_deployment_exports`
- `devops_hosted_image_repository_uris`

Langfuse dependency outputs expose the private PostgreSQL endpoint, ClickHouse URL, Redis endpoint, Object Storage bucket, and hosted app networking configuration used by the deployment. Sensitive connection strings remain sensitive Terraform outputs.
