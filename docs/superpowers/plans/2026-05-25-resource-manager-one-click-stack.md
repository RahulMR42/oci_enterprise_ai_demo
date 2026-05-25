# Resource Manager One-Click Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Resource Manager-first one-click deployment package for the Enterprise AI Demo Portal.

**Architecture:** Add a root portal Docker image and a new `infra/resource-manager/enterprise-ai-demo-stack` Terraform package. The stack deploys the prebuilt image to OCI Container Instances, creates networking when no subnet is supplied, exposes Resource Manager form inputs through `schema.yaml`, and documents Resource Manager as the primary state owner.

**Tech Stack:** Node.js, Python runtime dependencies, Docker/Podman, Terraform OCI provider, OCI Resource Manager schema YAML, Node test runner.

---

## File Structure

- Create `Dockerfile`: root portal image for Resource Manager deployments.
- Create `.dockerignore`: keeps local state, dependencies, logs, and Terraform outputs out of the build context.
- Create `infra/resource-manager/enterprise-ai-demo-stack/versions.tf`: Terraform and provider constraints.
- Create `infra/resource-manager/enterprise-ai-demo-stack/variables.tf`: Resource Manager input contract and validation.
- Create `infra/resource-manager/enterprise-ai-demo-stack/locals.tf`: derived names, tags, network mode, and environment variables.
- Create `infra/resource-manager/enterprise-ai-demo-stack/network.tf`: optional public VCN/subnet for one-click demos.
- Create `infra/resource-manager/enterprise-ai-demo-stack/container_instance.tf`: OCI Container Instance running the portal image.
- Create `infra/resource-manager/enterprise-ai-demo-stack/outputs.tf`: portal URL and deployment metadata.
- Create `infra/resource-manager/enterprise-ai-demo-stack/schema.yaml`: Resource Manager UI form.
- Create `infra/resource-manager/enterprise-ai-demo-stack/README.md`: build image, create stack, apply, and optional state notes.
- Modify `tests/terraformInfra.test.js`: add contract coverage for the new Dockerfile and Resource Manager stack.
- Modify `README.md`: add a short pointer to the Resource Manager deployment path.

## Task 1: Add Failing Tests For The Resource Manager Contract

**Files:**
- Modify: `tests/terraformInfra.test.js`

- [ ] **Step 1: Add test coverage**

Append this test to `tests/terraformInfra.test.js`:

```js
test("resource manager stack deploys portal to OCI Container Instances", () => {
  const dockerfile = read("Dockerfile");
  const dockerignore = read(".dockerignore");
  const stackFiles = [
    "infra/resource-manager/enterprise-ai-demo-stack/versions.tf",
    "infra/resource-manager/enterprise-ai-demo-stack/variables.tf",
    "infra/resource-manager/enterprise-ai-demo-stack/locals.tf",
    "infra/resource-manager/enterprise-ai-demo-stack/network.tf",
    "infra/resource-manager/enterprise-ai-demo-stack/container_instance.tf",
    "infra/resource-manager/enterprise-ai-demo-stack/outputs.tf",
    "infra/resource-manager/enterprise-ai-demo-stack/schema.yaml",
    "infra/resource-manager/enterprise-ai-demo-stack/README.md"
  ].map(read);
  const terraform = stackFiles.join("\n");

  assert.match(dockerfile, /FROM node:22-alpine/);
  assert.match(dockerfile, /apk add --no-cache python3 py3-pip/);
  assert.match(dockerfile, /ENV HOST=0\.0\.0\.0/);
  assert.match(dockerfile, /CMD \["npm", "start"\]/);
  assert.match(dockerignore, /\.terraform/);
  assert.match(dockerignore, /\.oci-portal-password/);

  assert.match(terraform, /resource "oci_container_instances_container_instance" "portal"/);
  assert.match(terraform, /data "oci_identity_availability_domains" "portal"/);
  assert.match(terraform, /resource "oci_core_vcn" "portal"/);
  assert.match(terraform, /count\s+=\s+local\.create_network \? 1 : 0/);
  assert.match(terraform, /subnet_id\s+=\s+local\.subnet_id/);
  assert.match(terraform, /is_public_ip_assigned\s+=\s+true/);
  assert.match(terraform, /image_url\s+=\s+var\.portal_image_uri/);
  assert.match(terraform, /OCI_PORTAL_PASSWORD\s+=\s+var\.portal_password/);
  assert.match(terraform, /PROVISION_INFRA\s+=\s+var\.provision_demo_infra \? "true" : "false"/);
  assert.match(terraform, /output "portal_url"/);
  assert.match(terraform, /schemaVersion:/);
  assert.match(terraform, /portal_image_uri/);
  assert.match(terraform, /Resource Manager owns Terraform state/);
  assert.match(terraform, /Object Storage backend is optional/);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
node --test tests/terraformInfra.test.js
```

Expected: FAIL because `Dockerfile`, `.dockerignore`, and the Resource Manager stack files do not exist yet.

- [ ] **Step 3: Commit the failing test**

Run:

```bash
git add tests/terraformInfra.test.js
git commit -m "test: cover resource manager stack contract"
```

## Task 2: Add Portal Container Packaging

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Add the portal Dockerfile**

Create `Dockerfile`:

```dockerfile
FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 py3-pip

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY requirements.txt ./
RUN python3 -m venv /app/env \
  && /app/env/bin/python -m pip install --no-cache-dir -r requirements.txt

COPY index.html server.mjs bash.sh ./
COPY src ./src
COPY backend ./backend
COPY docs/wiring ./docs/wiring

ENV HOST=0.0.0.0
ENV PORT=5173
ENV PYTHONUNBUFFERED=1

EXPOSE 5173

CMD ["npm", "start"]
```

- [ ] **Step 2: Add Docker ignore rules**

Create `.dockerignore`:

```text
.git
.worktrees
node_modules
dist
env
logs
backend/data
.terraform
**/.terraform
*.tfstate
*.tfstate.*
*.tfvars
*.auto.tfvars
.DS_Store
*.log
__pycache__
*.pyc
.oci-portal-password
.resource_suffix
.n8n-hosted-password
```

- [ ] **Step 3: Run the focused test and verify partial progress**

Run:

```bash
node --test tests/terraformInfra.test.js
```

Expected: FAIL because Terraform stack files still do not exist, while Dockerfile assertions pass.

- [ ] **Step 4: Commit container packaging**

Run:

```bash
git add Dockerfile .dockerignore
git commit -m "feat: add portal container image"
```

## Task 3: Add Resource Manager Terraform Stack

**Files:**
- Create: `infra/resource-manager/enterprise-ai-demo-stack/versions.tf`
- Create: `infra/resource-manager/enterprise-ai-demo-stack/variables.tf`
- Create: `infra/resource-manager/enterprise-ai-demo-stack/locals.tf`
- Create: `infra/resource-manager/enterprise-ai-demo-stack/network.tf`
- Create: `infra/resource-manager/enterprise-ai-demo-stack/container_instance.tf`
- Create: `infra/resource-manager/enterprise-ai-demo-stack/outputs.tf`

- [ ] **Step 1: Add provider constraints**

Create `infra/resource-manager/enterprise-ai-demo-stack/versions.tf`:

```hcl
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 6.0.0"
    }
  }
}
```

- [ ] **Step 2: Add variables**

Create `infra/resource-manager/enterprise-ai-demo-stack/variables.tf` with inputs for `compartment_id`, `region`, `portal_image_uri`, `portal_password`, `existing_subnet_id`, `create_public_network`, `ssh_public_key`, container shape/OCPU/memory, resource suffix, provision toggles, and network CIDRs. Include validations for non-empty OCIDs and image URI.

- [ ] **Step 3: Add locals**

Create `infra/resource-manager/enterprise-ai-demo-stack/locals.tf` with:

```hcl
locals {
  normalized_suffix = replace(var.resource_suffix, "-", "")
  name_suffix       = substr(local.normalized_suffix, 0, 8)
  display_prefix    = "enterprise-ai-demo-${local.name_suffix}"
  create_network    = var.existing_subnet_id == "" && var.create_public_network
  subnet_id         = var.existing_subnet_id != "" ? var.existing_subnet_id : oci_core_subnet.portal[0].id

  freeform_tags = {
    "enterprise-ai-demo" = "true"
    "deployment"         = "resource-manager"
  }

  portal_environment = {
    HOST                         = "0.0.0.0"
    PORT                         = tostring(var.portal_port)
    OCI_PORTAL_PASSWORD          = var.portal_password
    OCI_GENAI_COMPARTMENT_ID     = var.compartment_id
    OCI_GENAI_REGION             = var.region
    PROVISION_INFRA              = var.provision_demo_infra ? "true" : "false"
    PROVISION_DEMOS              = join(",", var.enabled_demo_modules)
    REQUIRE_DEMO_INFRA           = var.require_demo_infra ? "true" : "false"
    LOG_CAPTURE_ENABLED          = "false"
    OCI_RESOURCE_MANAGER_PRIMARY = "true"
  }
}
```

- [ ] **Step 4: Add optional public network**

Create `infra/resource-manager/enterprise-ai-demo-stack/network.tf` with availability domains, optional VCN, internet gateway, route table, security list allowing TCP `portal_port`, and public subnet.

- [ ] **Step 5: Add Container Instance**

Create `infra/resource-manager/enterprise-ai-demo-stack/container_instance.tf` using:

```hcl
data "oci_identity_availability_domains" "portal" {
  compartment_id = var.compartment_id
}

resource "oci_container_instances_container_instance" "portal" {
  availability_domain = data.oci_identity_availability_domains.portal.availability_domains[0].name
  compartment_id      = var.compartment_id
  display_name        = "${local.display_prefix}-portal"
  shape               = var.container_shape
  freeform_tags       = local.freeform_tags

  shape_config {
    ocpus = var.container_ocpus
  }

  vnics {
    display_name           = "${local.display_prefix}-portal-vnic"
    hostname_label         = "portal"
    is_public_ip_assigned  = true
    subnet_id              = local.subnet_id
    skip_source_dest_check = false
  }

  containers {
    display_name          = "enterprise-ai-demo-portal"
    image_url             = var.portal_image_uri
    environment_variables = local.portal_environment

    resource_config {
      memory_limit_in_gbs = var.container_memory_gbs
      vcpus_limit         = var.container_ocpus
    }
  }
}
```

- [ ] **Step 6: Add outputs**

Create `infra/resource-manager/enterprise-ai-demo-stack/outputs.tf` with `portal_public_ip`, `portal_url`, `container_instance_id`, `subnet_id`, `portal_image_uri`, and `enabled_demo_modules`.

- [ ] **Step 7: Run focused test and Terraform formatting**

Run:

```bash
node --test tests/terraformInfra.test.js
terraform -chdir=infra/resource-manager/enterprise-ai-demo-stack fmt -check
```

Expected: test still FAILS until schema and README exist; Terraform fmt should PASS after formatting.

- [ ] **Step 8: Commit Terraform stack**

Run:

```bash
git add infra/resource-manager/enterprise-ai-demo-stack
git commit -m "feat: add resource manager terraform stack"
```

## Task 4: Add Resource Manager Schema And Documentation

**Files:**
- Create: `infra/resource-manager/enterprise-ai-demo-stack/schema.yaml`
- Create: `infra/resource-manager/enterprise-ai-demo-stack/README.md`
- Modify: `README.md`

- [ ] **Step 1: Add Resource Manager schema**

Create `schema.yaml` with `schemaVersion`, grouped variables for target compartment, image/runtime, network, demo toggles, and advanced settings. Mark `portal_password` as password/sensitive and default demo modules to `responses-api`.

- [ ] **Step 2: Add stack README**

Create `README.md` that explains:

```markdown
# Enterprise AI Demo Resource Manager Stack

Resource Manager is the primary one-click Terraform deployment path for the portal. Resource Manager owns Terraform state for this stack.

## Image

Build and push the portal image before stack creation:

```bash
export OCIR_REGION_KEY=ord
export OCIR_NAMESPACE=<namespace>
export IMAGE_URI="$OCIR_REGION_KEY.ocir.io/$OCIR_NAMESPACE/enterprise-ai-demo/portal:latest"
podman build --platform linux/amd64 -t "$IMAGE_URI" ../../..
podman push "$IMAGE_URI"
```

## Deploy

Create a Resource Manager stack from this folder, set `portal_image_uri`, `compartment_id`, and `portal_password`, then run Apply.

## State

Resource Manager owns Terraform state. Object Storage backend is optional for non-Resource-Manager local or DevOps runs only.
```

- [ ] **Step 3: Add root README pointer**

Add a short section to `README.md`:

```markdown
## One-Click OCI Deployment

Resource Manager is the primary one-click deployment path for the portal. See `infra/resource-manager/enterprise-ai-demo-stack/README.md` to build the portal image, create the stack, and deploy it to OCI Container Instances.
```

- [ ] **Step 4: Run focused test**

Run:

```bash
node --test tests/terraformInfra.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit schema and docs**

Run:

```bash
git add infra/resource-manager/enterprise-ai-demo-stack/schema.yaml infra/resource-manager/enterprise-ai-demo-stack/README.md README.md
git commit -m "docs: add resource manager stack guide"
```

## Task 5: Verify Full Change Set

**Files:**
- No new files.

- [ ] **Step 1: Run portal build check**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 2: Run focused Terraform infra tests**

Run:

```bash
node --test tests/terraformInfra.test.js
```

Expected: PASS.

- [ ] **Step 3: Run Terraform formatting**

Run:

```bash
terraform -chdir=infra/resource-manager/enterprise-ai-demo-stack fmt -check
```

Expected: PASS.

- [ ] **Step 4: Run Terraform init and validate if provider download is available**

Run:

```bash
terraform -chdir=infra/resource-manager/enterprise-ai-demo-stack init -backend=false
terraform -chdir=infra/resource-manager/enterprise-ai-demo-stack validate
```

Expected: PASS when the OCI provider can be downloaded or is already available.

- [ ] **Step 5: Run full Node test suite**

Run:

```bash
npm test
```

Expected: Existing unrelated baseline failures may remain:

- `agentic control tower returns structured local workflow output without OCI config`
- `final four python demos return structured output when OCI config is missing`
- `hosted LlamaIndex app serves health and workflow responses`

No new failures should appear in Resource Manager stack coverage.

## Self-Review

- Spec coverage: the plan covers the root Docker image, Resource Manager Terraform package, schema form, README instructions, Resource Manager-owned state, optional Object Storage backend wording, and tests.
- Placeholder scan: no task uses unspecified implementation placeholders.
- Type consistency: file names and Terraform local/variable names are consistent across tests, code snippets, and docs.

