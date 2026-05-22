# n8n Hosted Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real ephemeral n8n hosted deployment demo card that launches the hosted n8n UI in a new tab.

**Architecture:** Reuse `infra/hosted-agentic-applications` as the hosted deployment module and add a third hosted app/deployment resource set for n8n. The backend reads generated n8n metadata into infrastructure state, and the frontend treats the n8n card as an external URL launch instead of a Responses API workbench run.

**Tech Stack:** Node.js server, browser JavaScript, Terraform `terraform_data` local-exec, OCI CLI, OCIR, OCI Generative AI Hosted Applications, official n8n container image.

---

### Task 1: Regression Tests

**Files:**
- Modify: `tests/features.test.js`
- Modify: `tests/terraformInfra.test.js`
- Modify: `tests/provisioning.test.js`

- [ ] **Step 1: Write failing feature and contract tests**

Add assertions that `aiFeatures` includes `n8n-hosted-workflow-automation`, Terraform contains n8n hosted app contracts, and `server.mjs` exposes n8n hosted URL state without secret names or secret values.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/features.test.js tests/terraformInfra.test.js tests/provisioning.test.js`

Expected: FAIL because the n8n card, Terraform contract, and state fields do not exist yet.

### Task 2: Hosted n8n Image and Terraform

**Files:**
- Create: `apps/hosted-n8n/Dockerfile`
- Modify: `infra/hosted-agentic-applications/variables.tf`
- Modify: `infra/hosted-agentic-applications/locals.tf`
- Create: `infra/hosted-agentic-applications/n8n_hosted_application.tf`
- Modify: `infra/hosted-agentic-applications/outputs.tf`
- Modify: `infra/hosted-agentic-applications/README.md`

- [ ] **Step 1: Add the image**

Create `apps/hosted-n8n/Dockerfile` from the official n8n image and expose port `5678`.

- [ ] **Step 2: Add Terraform variables and locals**

Add variables for n8n repository name, app source dir, hosted app display name, hosted deployment display name, basic auth user, and basic auth password. Mark the password variable as sensitive.

- [ ] **Step 3: Add n8n hosted app local-exec resource**

Follow the existing hosted agent and LangGraph pattern: create/reuse OCIR repo, build/push image, create hosted application, create hosted deployment, poll deployment, write `n8n_hosted_application.json`, `n8n_hosted_deployment.json`, `n8n_ocir_repository.json`, and `n8n_hosted_deployment.json` runtime metadata.

- [ ] **Step 4: Add outputs and README notes**

Expose the n8n generated metadata path and document non-secret environment variables. Do not include credential values.

### Task 3: Server Runtime State

**Files:**
- Modify: `server.mjs`
- Modify: `tests/provisioning.test.js`

- [ ] **Step 1: Read generated n8n metadata**

Update hosted Terraform refresh input merging, `demoRuntimeComponents()`, and infrastructure state values to include `n8nHostedUrl`, `n8nHostedDeploymentId`, and non-secret n8n components.

- [ ] **Step 2: Verify tests**

Run: `npm test -- tests/provisioning.test.js tests/terraformInfra.test.js`

Expected: PASS.

### Task 4: Frontend Card and Launch Behavior

**Files:**
- Modify: `src/data/aiFeatures.js`
- Modify: `src/main.js`
- Modify: `tests/features.test.js`
- Modify: `tests/terraformInfra.test.js`

- [ ] **Step 1: Add the card metadata**

Add `n8n-hosted-workflow-automation` with card copy, docs URL, hosted app Terraform path, and capabilities.

- [ ] **Step 2: Add launch behavior**

Add external launch demo handling so `Run Demo` opens `infraState.n8nHostedUrl` in a new tab when present, otherwise shows the existing run notice dialog with a provision-first message.

- [ ] **Step 3: Add diagrams and technical details**

Add a flow diagram and technical flow for the n8n hosted deployment path.

- [ ] **Step 4: Verify tests**

Run: `npm test -- tests/features.test.js tests/terraformInfra.test.js`

Expected: PASS.

### Task 5: Final Verification

**Files:**
- All modified files.

- [ ] **Step 1: Run the full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run build checks**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Inspect git diff**

Run: `git diff --stat` and `git diff --check`

Expected: no whitespace errors; diff is scoped to the n8n feature plus the existing approved spec and plan.
