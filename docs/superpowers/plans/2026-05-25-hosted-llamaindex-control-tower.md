# Hosted LlamaIndex Control Tower Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy Agentic Control Tower as an actual OCI Generative AI Hosted Application running a real LlamaIndex HTTP service.

**Architecture:** Add a new `apps/hosted-llamaindex-control-tower` Python container, extend `infra/hosted-agentic-applications` with OCIR/build/hosted-app/deployment metadata, and update the portal server to proxy `/api/llamaindex/launch/` through the existing IDCS token helper. The existing local Python demo remains as fallback when hosted metadata is missing or inactive.

**Tech Stack:** Python `http.server`, `llama-index-core`, OCI CLI/Terraform hosted application resources, Node server proxy, Node test runner, Podman for image build/push.

---

## Tasks

### Task 1: Hosted App Service

- [ ] Add `tests/hostedLlamaIndexApp.test.js` that starts `apps/hosted-llamaindex-control-tower/app.py`, asserts `GET /health` returns runtime `llamaindex`, and asserts `POST /agent/control-tower/respond` returns `hosted: true`, `workflow.plan.steps`, and `runtime: "llamaindex"`.
- [ ] Create `apps/hosted-llamaindex-control-tower/requirements.txt` containing `llama-index-core>=0.12.0,<0.13`.
- [ ] Create `apps/hosted-llamaindex-control-tower/Dockerfile` from `python:3.12-slim`, install requirements, expose `8080`, and run `app.py`.
- [ ] Create `apps/hosted-llamaindex-control-tower/app.py` with `GET /`, `GET /health`, `GET /.well-known/agent-card.json`, and `POST /agent/control-tower/respond`.
- [ ] Run `node --test tests/hostedLlamaIndexApp.test.js`.
- [ ] Commit hosted app service and test.

### Task 2: Terraform Hosted Deployment Wiring

- [ ] Add tests in `tests/terraformInfra.test.js` asserting `llamaindex_control_tower_hosted_application.tf`, new variables, locals, and outputs include `llamaindex_control_tower.json`, repository, hosted app, hosted deployment, and IDCS auth.
- [ ] Modify `infra/hosted-agentic-applications/locals.tf` with LlamaIndex repository/application/deployment local names.
- [ ] Modify `infra/hosted-agentic-applications/variables.tf` with repository name, app source dir, hosted application display name, hosted deployment display name, and optional image repository URI variables.
- [ ] Add `infra/hosted-agentic-applications/llamaindex_control_tower_hosted_application.tf` following the existing LangGraph hosted app local-exec pattern.
- [ ] Modify `infra/hosted-agentic-applications/outputs.tf` with generated file, repository name, app display name, and deployment display name outputs.
- [ ] Modify `bash.sh` hosted-app Terraform apply/destroy var lists to pass the optional LlamaIndex image repository URI.
- [ ] Run `node --test tests/terraformInfra.test.js`.
- [ ] Run `terraform -chdir=infra/hosted-agentic-applications fmt -check`.
- [ ] Commit Terraform wiring.

### Task 3: Portal Metadata And Proxy

- [ ] Add tests in `tests/provisioning.test.js` for `llamaIndexControlTowerProxyTargetUrl()` and route/source text for `/api/llamaindex/launch`.
- [ ] Modify `server.mjs` to read `llamaindex_control_tower.json`, include LlamaIndex runtime components, build target URLs, and proxy `/api/llamaindex/launch/` with IDCS bearer token.
- [ ] Add hosted run path for `agentic-control-tower`: if metadata has active deployment and URL, call the hosted endpoint; otherwise fallback to existing Python demo.
- [ ] Modify `src/data/aiFeatures.js` and `src/main.js` copy to say the primary runtime is hosted LlamaIndex.
- [ ] Run `node --test tests/provisioning.test.js tests/features.test.js`.
- [ ] Commit portal proxy and metadata changes.

### Task 4: Full Validation

- [ ] Run `npm run build`.
- [ ] Run `npm test`.
- [ ] Run `terraform -chdir=infra/hosted-agentic-applications fmt -check`.
- [ ] Restart the local portal on port `5173`.
- [ ] Confirm `curl --head http://127.0.0.1:5173/` returns a portal response.
- [ ] Commit any generated wiring update if feature metadata changed.

### Task 5: Deploy Hosted App

- [ ] Run Terraform apply for `infra/hosted-agentic-applications` using the existing environment, IDCS variables, OCIR settings, and `PROVISION_DEMOS=hosted-agentic-applications`.
- [ ] Confirm `infra/hosted-agentic-applications/.terraform/generated/llamaindex_control_tower.json` exists.
- [ ] Confirm generated metadata has hosted deployment lifecycle `ACTIVE`.
- [ ] Refresh portal state.
- [ ] Call `/api/llamaindex/launch/health` through the local portal proxy and confirm hosted response.
- [ ] Run the Agentic Control Tower card through `/api/features/agentic-control-tower/run` and confirm the payload indicates hosted LlamaIndex runtime.

## Self-Review

- Spec coverage: tasks cover hosted app, Terraform, portal proxy, hosted primary behavior, tests, and deployment.
- Red-flag scan: no unresolved markers or unspecified tests.
- Type consistency: feature id remains `agentic-control-tower`; hosted metadata file is `llamaindex_control_tower.json`; local proxy prefix is `/api/llamaindex/launch/`.
