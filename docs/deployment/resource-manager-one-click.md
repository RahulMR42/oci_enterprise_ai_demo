# One-Click OCI Resource Manager Deployment

Use the GitHub release asset to open OCI Resource Manager with the stack package preselected.

[![Deploy to Oracle Cloud](https://oci-resourcemanager-plugin.plugins.oci.oraclecloud.com/latest/deploy-to-oracle-cloud.svg)](https://cloud.oracle.com/resourcemanager/stacks/create?zipUrl=https://github.com/RahulMR42/oci_enterprise_ai_demo/releases/latest/download/enterprise-ai-demo-resource-manager-stack.zip)

## What the Stack Creates

The Resource Manager root is `infra/resource-manager-demo`. It deploys the shared demo infrastructure, OCI DevOps pipeline, hosted app image repositories, hosted app deployments, and the stable public load balancer used by the portal.

The OCI DevOps pipeline created by the stack:

- clones the public GitHub branch into an OCI DevOps code repository,
- always builds and delivers the Enterprise AI portal image,
- builds and delivers only the hosted demo container images selected by `APP_DEPLOY` or the `OCI_HA_*_DEPLOY` switches,
- runs one managed hosted-deployment build stage per selected hosted app, each starting after its matching image delivery stage.
- rolls a replacement portal container instance behind the load balancer, waits for backend health, switches traffic, runs smoke tests, and deletes the old portal container instance after the new one is serving.

The stack package includes `infra/resource-manager-demo/schema.yaml`, so OCI Resource Manager renders grouped inputs for target tenancy/compartment, source branch, DevOps credentials, portal settings, OCI Generative AI runtime values, and hosted application auth. Terraform variable validation enforces OCID shapes, branch names, CIDR syntax, port and size ranges, and the Resource Manager-safe defaults.

The portal is exposed on the stack output `portal_url`. The load balancer IP remains stable across portal rollouts. The login user is `oci`; read the sensitive `portal_login_password` output from the Resource Manager job or stack outputs.

## Before You Click

Create or collect these values:

| Value | Why it is needed |
| --- | --- |
| Tenancy OCID | Creates the shared dynamic group and IAM policy. |
| Compartment OCID | Owns the demo resources. |
| Six-character resource suffix | Keeps names stable across reruns, for example `fd2ed9`. |
| OCI DevOps Git username | Resource Manager pushes the cloned GitHub source into the OCI DevOps repo. |
| OCI DevOps Git password/auth token | Used only for that OCI DevOps repo push. |
| OCIR username | DevOps build argument for image publishing. |
| OCIR auth token | DevOps build argument for image publishing. |
| OCI Generative AI project ID and API key | Injected into the portal so non-hosted demos can call OCI Responses API. |
| IDCS domain URL, audience, and scope | Used for hosted application inbound auth. |

Keep these defaults for Resource Manager:

| Variable | Value |
| --- | --- |
| `hosted_applications_local_exec_enabled` | `false` |
| `responses_api_local_exec_enabled` | `false` |
| `conversation_store_local_exec_enabled` | `true` |
| `file_search_local_exec_enabled` | `true` |
| `code_interpreter_local_exec_enabled` | `true` |
| `hosted_app_push_image` | `false` |
| `devops_hosted_image_build_enabled` | `true` |
| `devops_hosted_image_run_build` | `true` |
| `APP_DEPLOY` | empty |
| `OCI_HA_LANGFUSE_DEPLOY` | `false` |
| `OCI_HA_HOSTED_AGENT_DEPLOY` | `false` |
| `OCI_HA_LANGGRAPH_DEPLOY` | `false` |
| `OCI_HA_OPENCLAW_DEPLOY` | `false` |
| `OCI_HA_LLAMAINDEX_DEPLOY` | `false` |
| `devops_create_repository` | `true` |
| `devops_source_connection_type` | `DEVOPS_CODE_REPOSITORY` |
| `devops_source_repo_url` | `https://github.com/RahulMR42/oci_enterprise_ai_demo.git` |
| `devops_source_branch` | `oci-rms` |
| `devops_repository_branch` | `main` |
| `portal_container_enabled` | `true` |

## Deploy

1. Click **Deploy to Oracle Cloud**.
2. Sign in to OCI and choose the target region.
3. On the stack page, confirm Terraform version `1.5.x`.
4. Set the working directory to `infra/resource-manager-demo`.
5. Fill in the required variables.
6. Leave **Run apply** selected.
7. Create the stack.

The apply can run for more than 20 minutes because the DevOps build compiles images, publishes artifacts, creates hosted deployments, and rolls the portal container through the load balancer. The Terraform build-run resource waits up to 90 minutes.

OCI code links in the portal are generated from `devops_source_repo_url` and `devops_source_branch`. Keep `devops_source_branch=oci-rms` for this Resource Manager deployment path, and set `devops_source_repo_url` to the customer fork when the portal should open source actions against their repository. The portal shows source buttons on demand in each demo's OCI feature code panel instead of displaying raw repository URLs.

For iterative deployments, update both of these values before applying the same stack again:

- `devops_source_branch=oci-rms`
- `devops_source_revision=<commit SHA on oci-rms>`

Keeping the branch and revision current makes Resource Manager seed the exact source into the OCI DevOps repository and starts a new build run without creating a second Resource Manager stack.

Use the hosted app deployment switches to limit replacement scope during iterative runs. Leave `APP_DEPLOY` empty and enable only the required `OCI_HA_*_DEPLOY` switches, or set `APP_DEPLOY=all` when you intentionally want every DevOps-built hosted app built, delivered, and replaced. Langfuse is disabled by default; set `OCI_HA_LANGFUSE_DEPLOY=true` only when that hosted demo should be built and replaced. For first-time deployments, set each hosted app switch true when that app should be created. The portal container is rolled after each DevOps build run; the rollout keeps the old backend available until the new backend passes load balancer health and public smoke tests.

Keep `conversation_store_local_exec_enabled=true` on first-time deployments when the Conversation Store demo should use OCI-managed conversation state. This creates an OCI Conversations API object and injects the generated conversation ID into the portal runtime config.

Keep `file_search_local_exec_enabled=true` on first-time deployments when the File Search demo should work. This creates the OCI Vector Store, uploads the bundled seed documents, and injects the generated Vector Store ID into the portal runtime config.

Keep `code_interpreter_local_exec_enabled=true` on first-time deployments when the Code Interpreter demo should work. This creates the managed Code Interpreter container and injects the generated container ID into the portal runtime config.

## Validate

After apply finishes, check these outputs:

| Output | Expected value |
| --- | --- |
| `portal_url` | Public URL for the portal load balancer. |
| `portal_login_user` | `oci` |
| `portal_login_password` | Sensitive generated password. |
| `devops_hosted_image_build_run_id` | OCI DevOps build run OCID. |
| `devops_hosted_deployment_exports` | Hosted app URLs and deployment OCIDs. |
| `portal_public_ip` | Stable public IP attached to the portal load balancer. |

Open `portal_url`, log in, and run both normal demos and hosted deployment demos. If a hosted demo is unavailable, open the DevOps build run from `devops_hosted_image_build_run_id` and check the per-app stages:

- `deploy-hosted-agent`
- `deploy-langgraph-agent`
- `deploy-langfuse`
- `deploy-openclaw`
- `deploy-llamaindex-control-tower`
- `deploy-portal-container`

Each deploy stage deletes older hosted deployments and hosted applications with the same display name before creating the replacement, so reruns do not accumulate duplicate active hosted apps.

## Publish a New Release Asset

Run the GitHub workflow **Release Resource Manager Stack** from the Actions tab and provide a tag such as `v0.1.0`, or push a `v*` tag. The workflow publishes:

```text
enterprise-ai-demo-resource-manager-stack.zip
```

The README deploy button points to the latest release asset:

```text
https://github.com/RahulMR42/oci_enterprise_ai_demo/releases/latest/download/enterprise-ai-demo-resource-manager-stack.zip
```

Use an immutable tag URL for demos that must not drift:

```text
https://github.com/RahulMR42/oci_enterprise_ai_demo/releases/download/v0.1.0/enterprise-ai-demo-resource-manager-stack.zip
```
