# Enterprise AI Demo Resource Manager Stack

[![Deploy to Oracle Cloud](https://oci-resourcemanager-plugin.plugins.oci.oraclecloud.com/latest/deploy-to-oracle-cloud.svg)](https://cloud.oracle.com/resourcemanager/stacks/create?zipUrl=https://github.com/RahulMR42/oci_enterprise_ai_demo/releases/latest/download/enterprise-ai-demo-rm-stack.zip&zipUrlVariables=%7B%22region%22%3A%22us-chicago-1%22%2C%22ocir_region_key%22%3A%22ord%22%2C%22portal_repository_name%22%3A%22enterprise-ai-demo%2Fportal-rm%22%2C%22portal_image_tag%22%3A%22latest%22%2C%22provision_demo_infra%22%3Afalse%2C%22enabled_demo_modules%22%3A%5B%22responses-api%22%5D%2C%22require_demo_infra%22%3Afalse%2C%22enable_demo_policies%22%3Atrue%7D)

Resource Manager is the primary one-click Terraform deployment path for the Enterprise AI Demo Portal. Resource Manager owns Terraform state for this stack.

This stack deploys a prebuilt private portal image to OCI Container Instances. It can create a small public demo network, or it can use an existing subnet supplied by the stack user. It also creates same-compartment IAM policies for private OCIR reads and for the demo services that the portal provisions progressively.

Resource Manager owns state for this path. Do not add a local backend or Object Storage backend to this stack package.

## Access Model

Private OCIR access is policy-based:

- The OCIR repository stays private.
- The stack creates a dynamic group for resources in the selected compartment when `enable_demo_policies=true`.
- The stack policy grants that dynamic group `read repos` in the same compartment.
- The container instance does not receive OCIR usernames, auth tokens, Docker config JSON, or pull-secret variables.

## Image

Build and push the portal image before stack creation:

```bash
export OCIR_REGION_KEY=ord
export OCIR_NAMESPACE=<namespace>
export IMAGE_URI="$OCIR_REGION_KEY.ocir.io/$OCIR_NAMESPACE/enterprise-ai-demo/portal-rm:latest"

podman build --platform linux/amd64 -t "$IMAGE_URI" ../../..
podman push "$IMAGE_URI"
```

Keep the OCIR repository private. Use the resulting `IMAGE_URI` as `portal_image_uri` in Resource Manager only when you want to override the derived image URI.

Alternatively, leave `portal_image_uri` empty and let Terraform derive the image URI from `ocir_region_key`, `ocir_namespace`, `portal_repository_name`, and `portal_image_tag`. The default derived URI shape is:

```text
ord.ocir.io/<namespace>/enterprise-ai-demo/portal-rm:latest
```

Do not put OCIR auth tokens in stack variables or Terraform state. Private image access is handled through the stack-managed dynamic group and `read repos` policy.

## Deploy

Use the button above after the release asset `enterprise-ai-demo-rm-stack.zip` is published. The button opens OCI Resource Manager's Create Stack page with the stack zip selected and safe defaults prefilled. Review the variables, keep Run apply selected for one-click creation, and provide the required target values.

Required values:

- `compartment_id`
- `tenancy_id`
- `portal_password`

For local CLI deployment or pre-release testing, create a Resource Manager stack from this folder:

```text
infra/resource-manager/enterprise-ai-demo-stack
```

Set either `portal_image_uri` directly, or keep it empty and set `portal_repository_name`/`portal_image_tag` for the derived private OCIR URI. The `portal_image_uri` stack output shows the exact image URI used by the container instance.

For a quick demo, leave `existing_subnet_id` empty and keep `create_public_network=true`. For enterprise networks, set `existing_subnet_id` to a subnet that can assign a public IP or route traffic through your approved ingress path.

After apply, open the `portal_url` output and sign in with:

```text
username: oci
password: <portal_password>
```

Key outputs:

| Output | Meaning |
| --- | --- |
| `portal_url` | Browser URL for the deployed portal. |
| `portal_image_uri` | Exact private OCIR image URI used by the container instance. |
| `container_instance_id` | OCI Container Instance OCID. |
| `demo_dynamic_group_name` | Dynamic group name created when demo policies are enabled. |
| `demo_policy_name` | IAM policy name created when demo policies are enabled. |

## Demo Infrastructure

The first Resource Manager stack version focuses on deploying the portal reliably, then allowing demo infrastructure to be enabled progressively from Resource Manager-owned state. `provision_demo_infra` is disabled by default because several hosted-app demos require prebuilt private images or service limits in the target compartment.

When enabling startup provisioning, start with:

```text
enabled_demo_modules = ["responses-api"]
```

Broaden the list after confirming the target compartment has the required service limits and private images. With `enable_demo_policies=true`, the stack creates a dynamic group and same-compartment policies for Generative AI, Autonomous Database, Database Tools, Vault secret bundle reads, private OCIR repository reads, and Object Storage access.

## State

Resource Manager owns Terraform state for one-click stack deployments.

Object Storage backend is optional for non-Resource-Manager local or OCI DevOps runs only. A local backend pattern can be added outside this stack package when the deployment is not executed by Resource Manager.

## Security Notes

- Restrict `allowed_ingress_cidr` for non-demo deployments.
- Do not place OCI user API keys, private keys, IDCS client secrets, OCIR auth tokens, or Docker registry credentials in Terraform variables.
- Use a prebuilt private OCIR image. Resource Manager should not build Docker images during apply.

## Release Package

The Deploy to Oracle Cloud button needs a zip whose root contains the Terraform files in this directory. Do not link the button to a full repository branch archive unless Resource Manager is configured with the correct working directory.

GitHub Actions publishes the release asset automatically when a release is published. The workflow is:

```text
.github/workflows/publish-resource-manager-stack.yml
```

It attaches this asset name to the release:

```text
enterprise-ai-demo-rm-stack.zip
```

For local verification, create the same package from this directory:

```bash
cd infra/resource-manager/enterprise-ai-demo-stack
zip -qr /tmp/enterprise-ai-demo-rm-stack.zip .
```

The button currently points to:

```text
https://github.com/RahulMR42/oci_enterprise_ai_demo/releases/latest/download/enterprise-ai-demo-rm-stack.zip
```
