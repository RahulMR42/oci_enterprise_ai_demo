# Agentic Control Tower Demo Design

## Goal

Add one new runnable demo card, **Agentic Control Tower**, that demonstrates a complex agentic workflow using real open-source tooling. The first implementation will use LlamaIndex as the OSS orchestration layer and will fit the existing portal pattern: a catalog card, one Python demo script, server-side run routing, structured trace output, wiring documentation, and tests.

## User Requirements

- Use real open-source tooling, starting with LlamaIndex.
- Avoid conflicts with the existing demo package set.
- Add this as a new demo card in the current portal, not as a separate app shell.
- Reuse environment-provided hosted application IDCS credentials.
- Keep credentials server-side and avoid exposing IDCS client secrets in browser code.

## Architecture

The card will be registered in `src/data/aiFeatures.js` with a new feature id:

`agentic-control-tower`

The server will map that id in `server.mjs` to:

`backend/demos/agentic_control_tower.py`

The Python demo will use LlamaIndex workflow primitives where available. It will fail gracefully with a clear configuration/dependency error if LlamaIndex is not installed. The dependency will be added to `requirements.txt` with a narrow package selection, favoring `llama-index-core` first to minimize transitive package churn.

The existing OCI Responses API configuration remains the model backend for final synthesis/evaluation. The workflow itself will be local and deterministic enough to test without live OCI credentials.

## IDCS Credential Reuse

The demo will not create a new IDCS app or ask for separate credentials. `server.mjs` reads hosted application IDCS configuration from environment variables such as `OCI_HOSTED_APP_IDCS_CLIENT_ID` and `OCI_HOSTED_APP_IDCS_CLIENT_SECRET`.

For the first version, the Agentic Control Tower run will include a server-side IDCS credential posture check in its output:

- whether environment-provided IDCS launch metadata is present,
- which domain/audience/scope are configured,
- whether the confidential client is available,
- and whether the credential path is sourced from the environment.

Secrets will be redacted. The browser will only receive status and non-sensitive metadata. The demo will not exchange or print the IDCS client secret from Python.

## Workflow

The LlamaIndex workflow will model a control tower with these stages:

1. **Intake**: normalize the user prompt into an enterprise incident or operations request.
2. **Planner**: produce a multi-step action plan with required evidence, tools, and risk level.
3. **Tool execution**: call local deterministic tools:
   - `incident_lookup`
   - `policy_search`
   - `sql_metric_summary`
   - `approval_request`
   - `audit_event`
4. **Evidence review**: check whether tool outputs support the proposed action.
5. **Risk and approval**: mark high-risk actions as requiring human approval.
6. **Memory note**: prepare a compact durable-memory update candidate.
7. **Final synthesis**: call OCI Responses API, when configured, to summarize the plan, evidence, approval state, and next action.

If live OCI configuration is missing, the demo returns a structured local result with the LlamaIndex workflow trace and a clear message that live synthesis was skipped.

## UI Behavior

The card will behave like existing runnable cards:

- visible in the catalog with category/capability search,
- opens the existing demo dialog,
- uses the shared prompt/model/temperature controls,
- returns structured output, logs, trace timeline, and technical flow,
- has an optional wiring SVG under `docs/wiring/agentic-control-tower.svg`.

The card text should emphasize “OSS agent workflow + OCI synthesis + governed credential posture.”

## Error Handling

The Python script will return structured JSON for:

- missing LlamaIndex dependency,
- invalid prompt payload,
- missing OCI API configuration,
- missing IDCS generated metadata,
- and live OCI call failures.

Dependency and configuration failures should still show the workflow intent and IDCS posture where possible.

## Testing

Add focused tests for:

- the Python demo returning structured output without live OCI credentials,
- dependency-missing behavior if LlamaIndex cannot be imported,
- feature metadata registration,
- server demo script mapping,
- and IDCS metadata redaction/status shape.

Existing `npm run build` and `npm test` remain the validation commands.

## Out of Scope

- Creating a new Terraform-hosted application for this card.
- Browser-based hosted UI launch for the control tower.
- Persisting new secrets.
- Exposing IDCS client secret or OCI API key in the browser.
- Adding CrewAI, LangGraph, or multiple OSS frameworks in the first version.
