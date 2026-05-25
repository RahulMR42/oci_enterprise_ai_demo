# Hosted LlamaIndex Control Tower Design

## Goal

Turn the Agentic Control Tower from a local demo script into an actual OCI Generative AI Hosted Application backed by a real LlamaIndex container. The portal card should call the hosted backend through the existing server-side IDCS proxy path and render the hosted runtime response in the existing Run Demo dialog.

## Requirements

- Create a real hosted LlamaIndex backend app, not only a local Python demo.
- Use the existing `infra/hosted-agentic-applications` Terraform module pattern.
- Use OCI Hosted Application inbound IDCS auth with the same domain/audience/scope model as the existing hosted apps.
- Reuse the Terraform-created IDCS launch client credential path already consumed by `server.mjs`.
- Keep all IDCS client secrets and OCI credentials server-side.
- Keep the existing local `backend/demos/agentic_control_tower.py` as a fallback/diagnostic path unless the hosted metadata is active.

## Hosted App

Create `apps/hosted-llamaindex-control-tower/` with:

- `Dockerfile`
- `requirements.txt`
- `app.py`

The container listens on `PORT=8080` and exposes:

- `GET /`: minimal JSON or HTML status page for launch checks.
- `GET /health`: health payload with runtime, graph steps, and timestamp.
- `GET /.well-known/agent-card.json`: A2A-style card describing the hosted LlamaIndex agent.
- `POST /agent/control-tower/respond`: accepts `{ "prompt": "...", "id": "..." }`, runs a LlamaIndex workflow, and returns plan/tool/evidence/approval/audit output.

The hosted app uses deterministic local enterprise tools for the first version so it can run without external databases. It should report that it is the hosted runtime and include LlamaIndex workflow step names in the response.

## Terraform

Extend `infra/hosted-agentic-applications` with a new hosted app resource using the same style as `langgraph_hosted_application.tf`:

- New local repository name: `enterprise-ai-demo/hosted-llamaindex-control-tower-<suffix>`
- New app display name: `enterprise-ai-demo-llamaindex-control-tower-<suffix>`
- New deployment display name: `enterprise-ai-demo-llamaindex-control-tower-deployment-<suffix>`
- Build/push image with `container_cli`.
- Create OCI Generative AI Hosted Application with IDCS inbound auth.
- Create Hosted Deployment.
- Write generated metadata to:
  `infra/hosted-agentic-applications/.terraform/generated/llamaindex_control_tower.json`

Add outputs for the generated file, repository name, app display name, and deployment display name.

## Portal Integration

Update `server.mjs` to read `llamaindex_control_tower.json` and expose a local authenticated proxy:

- `readLlamaIndexControlTowerLaunchUrl()`
- `llamaIndexControlTowerProxyTargetUrl()`
- `proxyLlamaIndexControlTowerLaunch()`
- route prefix `/api/llamaindex/launch/`

The proxy obtains an IDCS token with the existing `getIdcsAccessToken()` helper, forwards requests to the hosted URL with `Authorization: Bearer <token>`, and logs launch/run attempts with `writeDemoLog()`.

Update `runFeatureDemo("agentic-control-tower")` behavior so that, when hosted metadata exists and the deployment is active, it calls:

`POST /api/llamaindex/launch/agent/control-tower/respond`

and returns the hosted response in the existing dialog. If the hosted app is not provisioned or active, the current local Python demo remains the fallback path.

## UI

The existing card remains **Agentic Control Tower**, but its copy should make the hosted runtime primary:

- status should signal hosted OSS agent when metadata is active,
- capabilities should mention hosted LlamaIndex runtime,
- technical flow should show portal -> IDCS proxy -> OCI hosted app -> LlamaIndex workflow -> response.

The card does not need a large custom hosted UI in this iteration. The root page and health endpoint are enough for launch diagnostics.

## Testing

Add tests for:

- Hosted app Python service returns health and workflow JSON locally.
- Terraform files include new repository/app/deployment/generated metadata wiring.
- Server reads LlamaIndex metadata and builds the proxy target URL.
- Server routes `/api/llamaindex/launch/`.
- Feature metadata describes hosted LlamaIndex runtime.
- Existing full build and test suite pass.

## Deployment

After implementation:

1. Build/test locally.
2. Run Terraform format/checks for `infra/hosted-agentic-applications`.
3. Apply the hosted app module with existing `PROVISION_DEMOS=hosted-agentic-applications` flow, preserving the existing IDCS variables.
4. Refresh portal resource state.
5. Confirm generated metadata exists and the hosted deployment is `ACTIVE`.
6. Call the portal proxy endpoint and verify it returns hosted LlamaIndex output.

## Out of Scope

- A full custom browser UI for the hosted LlamaIndex app.
- External database or vector-store dependencies inside the hosted app.
- New IDCS app/client creation beyond the existing launch client path.
- Removing the local fallback demo.
