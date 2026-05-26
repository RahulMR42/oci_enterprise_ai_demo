# One-Click OCI Resource Manager Deployment

Use the GitHub release asset to open OCI Resource Manager with the stack package preselected.

[![Deploy to Oracle Cloud](https://oci-resourcemanager-plugin.plugins.oci.oraclecloud.com/latest/deploy-to-oracle-cloud.svg)](https://cloud.oracle.com/resourcemanager/stacks/create?zipUrl=https://github.com/RahulMR42/oci_enterprise_ai_demo/releases/latest/download/enterprise-ai-demo-resource-manager-stack.zip)

## What the Stack Creates

The Resource Manager root is `infra/resource-manager-demo`. It deploys the shared demo infrastructure, OCI DevOps pipeline, hosted app image repositories, hosted app deployments, and the public portal container instance.

The OCI DevOps pipeline created by the stack:

- clones the public GitHub branch into an OCI DevOps code repository,
- builds the hosted demo container images and the Enterprise AI portal image,
- uploads each image through parallel OCI DevOps `DELIVER_ARTIFACT` stages,
- runs one managed build stage to create hosted deployments.

The portal container instance is exposed on the stack output `portal_url`. The login user is `oci`; read the sensitive `portal_login_password` output from the Resource Manager job or stack outputs.

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
| `file_search_local_exec_enabled` | `false` |
| `code_interpreter_local_exec_enabled` | `false` |
| `hosted_app_push_image` | `false` |
| `devops_hosted_image_build_enabled` | `true` |
| `devops_hosted_image_run_build` | `true` |
| `devops_create_repository` | `true` |
| `devops_source_connection_type` | `DEVOPS_CODE_REPOSITORY` |
| `devops_source_repo_url` | `https://github.com/RahulMR42/oci_enterprise_ai_demo.git` |
| `devops_source_branch` | `oci-rms` or the release branch you want Resource Manager to clone |
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

The apply can run for more than 20 minutes because the DevOps build compiles images, publishes artifacts, and creates hosted deployments. The Terraform build-run resource waits up to 90 minutes.

## Validate

After apply finishes, check these outputs:

| Output | Expected value |
| --- | --- |
| `portal_url` | Public URL for the portal container instance. |
| `portal_login_user` | `oci` |
| `portal_login_password` | Sensitive generated password. |
| `devops_hosted_image_build_run_id` | OCI DevOps build run OCID. |
| `devops_hosted_deployment_exports` | Hosted app URLs and deployment OCIDs. |
| `portal_public_ip` | Public IP attached to the portal container instance. |

Open `portal_url`, log in, and run both normal demos and hosted deployment demos. If a hosted demo is unavailable, open the DevOps build run from `devops_hosted_image_build_run_id` and check the final `deploy-hosted-applications` stage.

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
