# One-Click OCI Resource Manager Deployment

Use the GitHub release asset to open OCI Resource Manager with the stack package preselected.

[![Deploy to Oracle Cloud](https://oci-resourcemanager-plugin.plugins.oci.oraclecloud.com/latest/deploy-to-oracle-cloud.svg)](https://cloud.oracle.com/resourcemanager/stacks/create?zipUrl=https://github.com/RahulMR42/oci_enterprise_ai_demo/releases/latest/download/enterprise-ai-demo-resource-manager-stack.zip)

## What the Stack Creates

The Resource Manager root is `infra/resource-manager-demo`. It deploys the shared demo infrastructure, OCI DevOps pipeline, hosted app image repositories, hosted app deployments, and the portal OCI Generative AI hosted application path.

The OCI DevOps pipeline created by the stack:

- clones the public GitHub branch into an OCI DevOps code repository,
- always builds and delivers the Enterprise AI portal image,
- keeps the hosted image and deployment stages stable so Resource Manager updates do not delete OCI DevOps stages,
- runs hosted-deployment commands only when `APP_DEPLOY` or the matching `OCI_HA_*_DEPLOY` switch selects that hosted app; otherwise the stage logs that it was skipped,
- creates or updates the portal no-auth hosted application, promotes the latest portal image artifact, and runs smoke tests against the hosted invoke URL.

The stack package includes `infra/resource-manager-demo/schema.yaml`, so OCI Resource Manager renders grouped inputs for target tenancy/compartment, source branch, DevOps credentials, portal settings, OCI Generative AI runtime values, and hosted application auth. Terraform variable validation enforces OCID shapes, branch names, and the Resource Manager-safe defaults.

The portal is exposed on the stack output `portal_url`. The login user is `oci`; store the portal password in OCI Vault and provide its OCID through `portal_auth_password_secret_id`. The hosted application receives that password as a `VAULT` environment variable rather than plaintext.

## Before You Click

Create or collect these values:

| Value | Why it is needed |
| --- | --- |
| Tenancy OCID | Creates the shared dynamic group and IAM policy. |
| Compartment OCID | Owns the demo resources. |
| Six-character resource suffix | Keeps names stable across reruns, for example `fd2ed9`. |
| OCI DevOps Git username | Resource Manager pushes the cloned GitHub source into the OCI DevOps repo. |
| OCI DevOps Git password/auth token | Used only for that OCI DevOps repo push. |
| Portal password Vault secret OCID | Injected into the hosted application as a `VAULT` environment variable for portal login. |
| OCI Generative AI project ID and optional API key secret OCID | Used by the portal so non-hosted demos can call OCI Responses API. |
| IDCS domain URL, audience, and scope | Used for hosted application inbound auth. |

Keep these defaults for Resource Manager:

| Variable | Value |
| --- | --- |
| `hosted_applications_local_exec_enabled` | `false` |
| `responses_api_local_exec_enabled` | `false` |
| `conversation_store_local_exec_enabled` | `false` |
| `file_search_local_exec_enabled` | `false` |
| `code_interpreter_local_exec_enabled` | `false` |
| `hosted_app_push_image` | `false` |
| `devops_hosted_image_build_enabled` | `true` |
| `devops_hosted_image_run_build` | `true` |
| `APP_DEPLOY` | empty |
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

The apply can run for more than 20 minutes because the DevOps build compiles images, publishes artifacts, creates hosted deployments, and creates or updates the portal hosted application. The Terraform build-run resource waits up to 90 minutes.

OCI code links in the portal are generated from `devops_source_repo_url` and `devops_source_branch`. Keep `devops_source_branch=oci-rms` for this Resource Manager deployment path, and set `devops_source_repo_url` to the customer fork when the portal should open source actions against their repository. The portal shows source buttons on demand in each demo's OCI feature code panel instead of displaying raw repository URLs.

For iterative deployments, update both of these values before applying the same stack again:

- `devops_source_branch=oci-rms`
- `devops_source_revision=<commit SHA on oci-rms>`

Keeping the branch and revision current makes Resource Manager seed the exact source into the OCI DevOps repository and starts a new build run without creating a second Resource Manager stack.

Use the hosted app deployment switches to limit replacement scope during iterative runs. Leave `APP_DEPLOY` empty and enable only the required `OCI_HA_*_DEPLOY` switches, or set `APP_DEPLOY=all` when you intentionally want every DevOps-built hosted app built, delivered, and replaced. For first-time deployments, set each hosted app switch true when that app should be created. The portal hosted application stage runs after each DevOps build run and updates the existing portal app when the display name is already present.

Keep `conversation_store_local_exec_enabled=false`, `file_search_local_exec_enabled=false`, and `code_interpreter_local_exec_enabled=false` for Resource Manager deployments. The OCI DevOps build pipeline includes a `provision-generated-runtime` stage that uses resource principal auth to create or reuse the Conversation Store conversation, File Search Vector Store and bundled PDFs, and Code Interpreter container before the portal hosted application stage starts.

## Validate

After apply finishes, check these outputs:

| Output | Expected value |
| --- | --- |
| `portal_url` | Invoke URL for the portal hosted application. |
| `portal_login_user` | `oci` |
| `portal_login_password_secret_id` | Vault secret OCID containing the portal password. |
| `devops_hosted_image_build_run_id` | OCI DevOps build run OCID. |
| `devops_hosted_deployment_exports` | Hosted app URLs and deployment OCIDs. |

Open `portal_url`, log in, and run both normal demos and hosted deployment demos. If a hosted demo is unavailable, open the DevOps build run from `devops_hosted_image_build_run_id` and check the per-app stages:

- `deploy-hosted-agent`
- `deploy-langgraph-agent`
- `deploy-openclaw`
- `deploy-llamaindex-control-tower`
- `deploy-portal-hosted-application`

Non-portal hosted deploy stages clean up older duplicate hosted deployments and applications with the same display name. The portal deploy stage reuses the existing active portal hosted application when present and updates its environment and active image artifact.

## Destroy Stack Resources

Use a destroy job to clean OCI resources created by a Resource Manager stack. The destroy job runs Terraform against the stack state so OCI resources are deleted in dependency order while the Resource Manager stack record, variables, and job history remain available.

```bash
env/bin/oci resource-manager job create-destroy-job \
  --stack-id <stack_ocid> \
  --display-name "enterprise-ai-demo-destroy-<suffix>"
```

Poll the destroy job until it finishes:

```bash
env/bin/oci resource-manager job get --job-id <destroy_job_ocid>
```

Do not delete the Resource Manager stack record when you need to retain RMS history or reuse the same stack shell. The stack uses the six-character `resource_suffix` in display names and freeform tags. If cleanup leaves resources behind because a provider delete operation failed, use that suffix and the `enterprise-ai-demo=true` tag to find and remove stragglers in the same compartment.

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
