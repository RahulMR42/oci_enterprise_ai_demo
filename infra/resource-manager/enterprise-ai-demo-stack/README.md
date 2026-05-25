# Enterprise AI Demo Resource Manager Stack

Resource Manager is the primary one-click Terraform deployment path for the Enterprise AI Demo Portal. Resource Manager owns Terraform state for this stack.

This stack deploys a prebuilt private portal image to OCI Container Instances. It can create a small public demo network, or it can use an existing subnet supplied by the stack user. It can also create same-compartment IAM policies for the demo services that the portal provisions progressively.

## Image

Build and push the portal image before stack creation:

```bash
export OCIR_REGION_KEY=ord
export OCIR_NAMESPACE=<namespace>
export IMAGE_URI="$OCIR_REGION_KEY.ocir.io/$OCIR_NAMESPACE/enterprise-ai-demo/portal:latest"

podman build --platform linux/amd64 -t "$IMAGE_URI" ../../..
podman push "$IMAGE_URI"
```

Keep the OCIR repository private. Use the resulting `IMAGE_URI` as `portal_image_uri` in Resource Manager.

If the container instance cannot pull from private OCIR with inherited authorization, store Docker registry credentials in OCI Vault and pass the secret OCID as `ocir_pull_secret_id`. Set `ocir_registry_endpoint` to the matching OCIR endpoint, such as `ord.ocir.io`. Do not put auth tokens directly in stack variables or Terraform state.

## Deploy

Create a Resource Manager stack from this folder:

```text
infra/resource-manager/enterprise-ai-demo-stack
```

Set these required inputs:

- `compartment_id`
- `tenancy_id`
- `portal_image_uri`
- `portal_password`

For a quick demo, leave `existing_subnet_id` empty and keep `create_public_network=true`. For enterprise networks, set `existing_subnet_id` to a subnet that can assign a public IP or route traffic through your approved ingress path.

After apply, open the `portal_url` output and sign in with:

```text
username: oci
password: <portal_password>
```

## Demo Infrastructure

The first Resource Manager stack version focuses on deploying the portal reliably, then allowing demo infrastructure to be enabled progressively from Resource Manager-owned state. `provision_demo_infra` is disabled by default because several hosted-app demos require prebuilt private images or service limits in the target compartment.

When enabling startup provisioning, start with:

```text
enabled_demo_modules = ["responses-api"]
```

Broaden the list after confirming the target compartment has the required service limits and private images. With `enable_demo_policies=true`, the stack creates a dynamic group and same-compartment policies for Generative AI, Autonomous Database, Database Tools, Vault secret reads, private OCIR repository reads, and Object Storage access.

## State

Resource Manager owns Terraform state for one-click stack deployments.

Object Storage backend is optional for non-Resource-Manager local or OCI DevOps runs only. A local backend pattern can be added outside this stack package when the deployment is not executed by Resource Manager.

## Security Notes

- Restrict `allowed_ingress_cidr` for non-demo deployments.
- Do not place OCI user API keys, private keys, IDCS client secrets, or OCIR auth tokens in Terraform variables.
- Use a prebuilt private OCIR image. Resource Manager should not build Docker images during apply.
