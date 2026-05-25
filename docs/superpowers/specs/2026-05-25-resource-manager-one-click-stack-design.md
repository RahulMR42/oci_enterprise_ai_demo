# Resource Manager One-Click Stack Design

## Goal

Provide a primary OCI Resource Manager deployment path for the Enterprise AI Demo Portal so a user can create a stack, fill in tenancy-specific inputs, and deploy the portal plus selected OCI demo infrastructure from Terraform.

## Context

The repository already contains:

- A Node portal entry point in `server.mjs`.
- Static portal assets in `index.html` and `src/`.
- Python demo backends in `backend/demos/`.
- Existing Terraform modules under `infra/` for shared Generative AI resources, vector store, code interpreter, NL2SQL, shared security, and hosted agentic applications.
- Multiple hosted app Dockerfiles under `apps/`.

The current local workflow uses `bash.sh` to run the portal and optionally apply selected Terraform modules. That is useful for development but does not give a one-click OCI deployment surface.

## Primary Deployment Approach

The primary deployment unit will be a new OCI Resource Manager stack package under:

```text
infra/resource-manager/enterprise-ai-demo-stack/
```

The stack will deploy the portal as an OCI Container Instance using a prebuilt OCIR image. Resource Manager will own the Terraform state for this primary path. Object Storage remote state will be documented only for optional local or OCI DevOps Terraform execution, not for the Resource Manager stack itself.

## Image Strategy

Resource Manager should not build Docker images during apply. The stack will require a portal image URI as input, with helper documentation for building and pushing the image to OCIR before creating the stack.

The implementation will add a root-level portal `Dockerfile` that packages:

- `server.mjs`
- `index.html`
- `src/`
- `backend/demos/`
- `requirements.txt`
- `package.json` and `package-lock.json`

The container will run `npm start`, bind to `0.0.0.0`, and use `PORT=5173` by default. Portal credentials will be supplied through Resource Manager variables and passed as container environment variables.

## Terraform Stack Contents

The Resource Manager stack will create:

- Optional VCN, internet gateway, route table, security list, and public subnet when an existing subnet is not supplied.
- OCI Container Instance for the portal.
- Portal container environment variables for region, profile-independent OCI auth mode, compartment, selected demo provisioning flags, and portal password.
- Optional Object Storage bucket for demo artifacts or future runtime metadata if required by selected demos.
- Outputs for the portal public IP, URL, compartment, subnet, image URI, and enabled demo set.

The stack will accept an existing subnet OCID to support enterprise networks. When that value is set, the stack will not create a VCN.

## Existing Demo Infrastructure Wiring

The first stack version will focus on deploying the portal container reliably. Existing demo Terraform modules will be wired as selectable child modules only where they are already safe for unattended Terraform execution.

Initial selectable modules:

- `infra/responses-api`
- `infra/file-search-vector-store-rag`
- `infra/code-interpreter`
- `infra/shared-demo-security`

Hosted application demos under `infra/hosted-agentic-applications` require local image build/push behavior and IDCS details. They will remain optional and disabled by default until the image build path is externalized.

## Resource Manager Schema

The stack will include `schema.yaml` to provide a guided Resource Manager form. Inputs will be grouped into:

- Target tenancy and compartment
- Network mode
- Portal image and runtime settings
- Portal authentication
- Demo infrastructure toggles
- Advanced OCI settings

Sensitive values such as the portal password will be marked sensitive in Terraform and schema metadata.

## OCI Auth Model

The portal container should not depend on a local OCI CLI profile. The Resource Manager path will prefer instance principal or resource principal style runtime access where supported by the called OCI SDK/CLI paths.

Where existing demo code currently assumes local config files, the first stack version will expose that limitation clearly and keep live demo provisioning optional. The design avoids embedding user API keys, private keys, or local OCI config content in Terraform state.

## Optional OCI DevOps Path

OCI DevOps is secondary. A later helper can define a build pipeline that:

1. Checks out this repository.
2. Builds the root portal Docker image.
3. Pushes it to OCIR.
4. Emits the image URI for Resource Manager stack input.

Terraform deployment remains Resource Manager-first. DevOps does not own the primary Terraform apply flow.

## State Strategy

Resource Manager owns state for one-click stack deployments.

For local or DevOps Terraform runs, documentation may include an optional Object Storage backend pattern:

```hcl
backend "s3" {
  bucket = "<bucket>"
  key    = "enterprise-ai-demo/terraform.tfstate"
  region = "<oci-region>"
}
```

This is not part of the Resource Manager primary path because Resource Manager already manages stack state.

## Error Handling

The stack will fail early when required values are missing:

- `compartment_id`
- `portal_image_uri`
- Either `existing_subnet_id` or permission to create networking
- `portal_password` unless explicitly allowing generated runtime password behavior

Terraform validations will catch malformed OCIDs and empty image references where possible.

Runtime outputs will include enough information to diagnose deployment:

- Container instance OCID
- Container lifecycle state
- Public IP or URL
- Enabled demo modules

## Testing

Verification will include:

- `terraform fmt -check` on the new stack.
- `terraform validate` where provider initialization is available.
- `npm run build` for the portal packaging baseline.
- Existing `npm test` as a regression signal, with current unrelated baseline failures documented until fixed separately.

## Out of Scope

This design does not:

- Make Resource Manager build Docker images.
- Store user API keys, OCI private keys, or IDCS client secrets in Terraform state.
- Convert every existing demo module to fully managed production deployment in the first pass.
- Replace the local development flow in `bash.sh`.

