# n8n Hosted Deployment Demo Design

## Goal

Add a portal demo card that provisions and opens a real n8n instance hosted as an OCI Generative AI Hosted Application / Hosted Deployment. The demo should show that a workflow automation UI can be packaged as another managed hosted deployment and launched from the Enterprise AI Demo Portal.

## Scope

The first version is an ephemeral n8n deployment:

- Use a real n8n container, not a mock UI.
- Enable n8n basic authentication.
- Do not add external database, block volume, object storage, or workflow persistence.
- Expect workflows and settings to reset when the hosted deployment is recreated.
- Open the live n8n URL in a new browser tab from the demo card.
- Reuse the existing `infra/hosted-agentic-applications` provisioning path.

Out of scope for this version:

- Persistent n8n storage.
- Preloaded workflow import.
- n8n OAuth provider setup.
- Portal-side embedding of the n8n UI.
- Exposing sensitive IDCS or n8n credentials in frontend state.

## Configuration

The hosted deployment uses the existing IDCS inbound auth settings:

- `OCI_HOSTED_APP_IDCS_DOMAIN_URL`
- `OCI_HOSTED_APP_IDCS_AUDIENCE`
- `OCI_HOSTED_APP_IDCS_SCOPE`

The IDCS client secret must remain runtime-only. It must not be committed, stored in Terraform state, written to generated metadata, or rendered in the portal.

n8n basic auth credentials should be provided through environment variables at provisioning time. The password should be treated like a secret and should not be committed or displayed in logs. If no explicit username is provided, use a non-secret default username suitable for a local demo.

## Architecture

Add a new app image under `apps/hosted-n8n`. The image should be based on the official n8n container image with only the minimal environment needed for an ephemeral single-container demo.

Extend `infra/hosted-agentic-applications` with a third hosted app/deployment resource set:

- OCIR repository for the n8n image.
- Container build and push step.
- OCI hosted application.
- OCI hosted deployment.
- Generated metadata JSON for portal runtime discovery.

The portal backend reads the generated n8n metadata alongside the existing hosted agent and LangGraph metadata. It exposes only non-secret runtime fields to the frontend, such as deployment id, lifecycle status, image URI, and hosted URL when available.

## Portal UX

Add a new card named `n8n Hosted Workflow Automation`.

The card appears with the same provisioning actions as other demos. Its run action is different from prompt-based demos:

- If the n8n hosted URL is available, open it in a new tab.
- If the URL is missing, show a run notice telling the user to provision hosted application infrastructure first.
- Do not open the shared Responses API workbench for this card.

The card should also have a resource flow diagram and technical detail copy that explains:

- Portal provisions a hosted application.
- OCI runs the n8n container as a hosted deployment.
- User opens the hosted n8n URL in a new tab.
- Basic auth protects n8n access.

## Data Flow

1. Startup or explicit provisioning applies `infra/hosted-agentic-applications`.
2. Terraform builds and pushes the hosted n8n container image.
3. Terraform creates or refreshes the n8n hosted app and deployment.
4. Terraform writes generated n8n metadata to `.terraform/generated`.
5. `server.mjs` reads generated metadata into infrastructure state.
6. `src/main.js` renders the card and launch action.
7. User clicks Run Demo.
8. The portal opens the n8n hosted URL in a new tab, or shows a clear missing-infra notice.

## Error Handling

If provisioning has not run, the card should remain visible but launch should show a clear notice instead of failing silently.

If the generated metadata exists but has no URL, the portal should show the deployment status and tell the user to refresh infrastructure state.

If build or deployment fails, existing infrastructure status rendering should surface failed components. The n8n-specific components should have clear names so they are easy to identify in the Resources panel.

## Testing

Add focused tests for:

- The new feature card exists with valid metadata.
- The hosted Terraform module includes n8n repository, image build, hosted app, hosted deployment, and generated metadata contracts.
- `server.mjs` reads and exposes n8n hosted deployment metadata without secrets.
- `src/main.js` treats the n8n card as an external launch demo rather than a Responses API workbench demo.
- Build and existing unit tests continue to pass.

## Security Notes

The supplied IDCS client secret is sensitive and must remain outside tracked files. The portal should not display or serialize it.

The first version can show non-sensitive launch guidance, but should avoid rendering the n8n basic auth password unless the user explicitly asks for a local-only display. Prefer documenting the configured environment variables instead.
