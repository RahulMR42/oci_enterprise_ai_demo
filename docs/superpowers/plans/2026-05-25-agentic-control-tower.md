# Agentic Control Tower Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a runnable **Agentic Control Tower** demo card backed by real LlamaIndex workflow code, OCI Responses API synthesis, and server-side IDCS credential posture reporting from the existing Terraform-created hosted app launch client.

**Architecture:** Follow the portal's existing card/demo pattern: metadata in `src/data/aiFeatures.js`, route mapping in `server.mjs`, runnable Python in `backend/demos/agentic_control_tower.py`, trace snippets in `src/main.js`, generated wiring SVG, and focused tests. The demo reads non-secret IDCS posture from environment variables injected by `server.mjs`; secrets are represented only as boolean flags and source labels.

**Tech Stack:** Node.js test runner, vanilla portal UI, Python 3, `llama-index-core`, OCI OpenAI-compatible Responses API helper in `backend/demos/common_oci.py`, environment-provided hosted application IDCS settings.

---

## File Structure

- Modify `requirements.txt`: add `llama-index-core`.
- Modify `server.mjs`: add demo script mapping; export redacted IDCS posture helper; inject IDCS posture env into demo child process; add trace snippet.
- Create `backend/demos/agentic_control_tower.py`: LlamaIndex workflow demo with deterministic local tools and optional live OCI synthesis.
- Modify `src/data/aiFeatures.js`: add new card metadata.
- Modify `src/main.js`: add feature description panels, flow diagram, technical flow, and code snippet references.
- Modify `tests/features.test.js`: update feature count/list and card assertions.
- Modify `tests/finalLiveDemos.test.js`: include the Python script in structured missing-config tests.
- Modify `tests/provisioning.test.js`: test IDCS posture redaction/export shape.
- Create `tests/agenticControlTowerDemo.test.js`: direct Python demo tests for LlamaIndex/local output behavior.
- Create `docs/wiring/agentic-control-tower.svg`: static wiring diagram, or run the existing generator after metadata is added.

---

### Task 1: Add Failing Metadata And Routing Tests

**Files:**
- Modify: `tests/features.test.js`
- Modify: `tests/finalLiveDemos.test.js`
- Modify: `tests/provisioning.test.js`

- [ ] **Step 1: Update feature metadata test expectations**

In `tests/features.test.js`, change:

```js
assert.equal(aiFeatures.length, 23);
```

to:

```js
assert.equal(aiFeatures.length, 24);
```

Add `"agentic-control-tower"` after `"openclaw-hosted-agent-gateway"` in the expected `featureIds` array.

Add this test block:

```js
test("Agentic Control Tower demo describes LlamaIndex and IDCS posture", () => {
  const feature = aiFeatures.find((item) => item.id === "agentic-control-tower");

  assert.ok(feature);
  assert.equal(feature.title, "Agentic Control Tower");
  assert.equal(feature.sdkModule, "backend/demos/agentic_control_tower.py");
  assert.match(feature.summary, /LlamaIndex/);
  assert.match(feature.details, /IDCS credential posture/);
  assert.match(feature.provisioningDetails, /Terraform-generated IDCS launch client/);
  assert.deepEqual(feature.capabilities, ["LlamaIndex workflow", "Tool critique loop", "IDCS credential posture"]);
});
```

- [ ] **Step 2: Update final demo structured-output test**

In `tests/finalLiveDemos.test.js`, add this object to the `demos` array:

```js
{
  script: "backend/demos/agentic_control_tower.py",
  feature: "Agentic Control Tower",
  mode: "agentic-control-tower",
  prompt: "Coordinate checkout delay triage with evidence, approval, and audit.",
  trace: "Loaded LlamaIndex agentic control tower workflow"
}
```

- [ ] **Step 3: Add IDCS posture test**

In the import list in `tests/provisioning.test.js`, add:

```js
idcsDemoCredentialPosture
```

Add this test:

```js
test("IDCS demo credential posture is redacted for Python demos", () => {
  const posture = idcsDemoCredentialPosture({
    domainUrl: "https://idcs.example.com",
    tokenUrl: "https://idcs.example.com/oauth2/v1/token",
    clientId: "enterprise-ai-demo-launch-ab12cd",
    clientSecret: "super-secret",
    audience: "https://genaisolutions.com/",
    scope: "read",
    source: "terraform-generated"
  });

  assert.deepEqual(posture, {
    configured: true,
    source: "terraform-generated",
    domainUrl: "https://idcs.example.com",
    tokenUrlConfigured: true,
    clientIdConfigured: true,
    clientSecretConfigured: true,
    audience: "https://genaisolutions.com/",
    scope: "read"
  });
  assert.equal(JSON.stringify(posture).includes("super-secret"), false);
});
```

- [ ] **Step 4: Run tests to confirm failure**

Run:

```bash
npm test
```

Expected: failure because `agentic-control-tower` metadata, script, and `idcsDemoCredentialPosture` do not exist yet.

- [ ] **Step 5: Commit failing tests**

```bash
git add tests/features.test.js tests/finalLiveDemos.test.js tests/provisioning.test.js
git commit -m "test: cover agentic control tower demo"
```

---

### Task 2: Add Server Mapping And IDCS Posture Export

**Files:**
- Modify: `server.mjs`

- [ ] **Step 1: Add demo route mapping**

In `server.mjs`, add this entry to `demoScripts`:

```js
"agentic-control-tower": "agentic_control_tower.py",
```

- [ ] **Step 2: Add redacted posture helper**

Near `idcsConfig()`, add:

```js
export function idcsDemoCredentialPosture(config = idcsConfig()) {
  const source = config.source || (config.clientId || config.clientSecret ? "env-or-generated" : "not-configured");
  return {
    configured: Boolean(config.domainUrl && config.tokenUrl && config.clientId && config.clientSecret),
    source,
    domainUrl: config.domainUrl || "",
    tokenUrlConfigured: Boolean(config.tokenUrl),
    clientIdConfigured: Boolean(config.clientId),
    clientSecretConfigured: Boolean(config.clientSecret),
    audience: config.audience || "",
    scope: config.scope || ""
  };
}
```

Update `idcsConfig()` so the returned object includes a stable `source` field:

```js
source: generated.clientId || generated.clientSecret ? "terraform-generated" : "environment"
```

- [ ] **Step 3: Inject posture into demo process env**

In `runFeatureDemo()`, before `spawn`, compute:

```js
const idcsPosture = idcsDemoCredentialPosture();
```

Add these variables to the `demoProcessEnv()` overrides:

```js
OCI_HOSTED_APP_IDCS_POSTURE: JSON.stringify(idcsPosture),
OCI_HOSTED_APP_IDCS_DOMAIN_URL: idcsPosture.domainUrl,
OCI_HOSTED_APP_IDCS_AUDIENCE: idcsPosture.audience,
OCI_HOSTED_APP_IDCS_SCOPE: idcsPosture.scope
```

Add `idcsConfigured: idcsPosture.configured` to `runtimeConfig`.

- [ ] **Step 4: Add code snippet for the card**

In `demoCallSnippet(featureId)`, add:

```js
"agentic-control-tower": `workflow = build_llamaindex_control_tower()
workflow_result = run_workflow(workflow, prompt, idcs_posture)
response = call_oci_responses_api(build_control_tower_prompt(workflow_result), temperature, model, config)`,
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --test tests/provisioning.test.js
```

Expected: PASS for the new IDCS posture helper test.

- [ ] **Step 6: Commit server changes**

```bash
git add server.mjs
git commit -m "feat: expose redacted IDCS posture to demos"
```

---

### Task 3: Add LlamaIndex Dependency

**Files:**
- Modify: `requirements.txt`

- [ ] **Step 1: Add dependency**

Append:

```txt
llama-index-core>=0.12.0,<0.13
```

- [ ] **Step 2: Install dependency in the local venv**

Run:

```bash
env/bin/python -m pip install -r requirements.txt
```

Expected: `llama-index-core` installs without replacing the existing OCI/OpenAI package set with incompatible versions.

- [ ] **Step 3: Verify import**

Run:

```bash
env/bin/python -c "from llama_index.core.workflow import Workflow; print(Workflow.__name__)"
```

Expected output includes:

```text
Workflow
```

- [ ] **Step 4: Commit dependency**

```bash
git add requirements.txt
git commit -m "feat: add LlamaIndex core dependency"
```

---

### Task 4: Implement Python Agentic Control Tower

**Files:**
- Create: `backend/demos/agentic_control_tower.py`
- Create: `tests/agenticControlTowerDemo.test.js`

- [ ] **Step 1: Add direct Python test**

Create `tests/agenticControlTowerDemo.test.js`:

```js
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("agentic control tower returns structured local workflow output without OCI config", () => {
  const result = spawnSync("python3", ["backend/demos/agentic_control_tower.py"], {
    input: JSON.stringify({
      prompt: "Coordinate checkout delay triage with evidence, approval, and audit.",
      model: "openai.gpt-oss-120b"
    }),
    encoding: "utf8",
    env: {
      ...process.env,
      OCI_GENAI_API_KEY: "",
      OCI_GENAI_PROJECT_ID: "",
      OCI_HOSTED_APP_IDCS_POSTURE: JSON.stringify({
        configured: true,
        source: "terraform-generated",
        domainUrl: "https://idcs.example.com",
        tokenUrlConfigured: true,
        clientIdConfigured: true,
        clientSecretConfigured: true,
        audience: "https://genaisolutions.com/",
        scope: "read"
      })
    }
  });

  assert.equal(result.status, 1);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.feature, "Agentic Control Tower");
  assert.equal(payload.mode, "agentic-control-tower");
  assert.equal(payload.request.model, "openai.gpt-oss-120b");
  assert.equal(payload.idcsCredentialPosture.configured, true);
  assert.equal(payload.idcsCredentialPosture.clientSecretConfigured, true);
  assert.equal(JSON.stringify(payload).includes("super-secret"), false);
  assert.ok(Array.isArray(payload.workflow.plan.steps));
  assert.ok(Array.isArray(payload.workflow.toolResults));
  assert.ok(payload.error.includes("OCI_GENAI_API_KEY"));
  assert.ok(payload.trace.includes("Loaded LlamaIndex agentic control tower workflow"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/agenticControlTowerDemo.test.js
```

Expected: FAIL because `backend/demos/agentic_control_tower.py` does not exist.

- [ ] **Step 3: Create Python implementation**

Create `backend/demos/agentic_control_tower.py` with:

```python
#!/usr/bin/env python3
import asyncio
import json
from datetime import datetime, timezone

from common_oci import (
    OCI_RESPONSES_MODEL,
    call_oci_responses_api,
    config_from_env,
    read_payload,
    response_output_text,
    response_to_json,
    validate_config,
)

DOCS_URL = "https://docs.llamaindex.ai/en/stable/module_guides/workflow/"


def load_llamaindex_workflow():
    try:
        from llama_index.core.workflow import Event, StartEvent, StopEvent, Workflow, step
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Missing Python dependency 'llama-index-core'. Install it with "
            "`env/bin/python -m pip install -r requirements.txt` before running this demo."
        ) from exc
    return Event, StartEvent, StopEvent, Workflow, step


def idcs_posture_from_env():
    import os

    raw = os.getenv("OCI_HOSTED_APP_IDCS_POSTURE", "{}")
    try:
        posture = json.loads(raw)
    except json.JSONDecodeError:
        posture = {}
    return {
        "configured": bool(posture.get("configured")),
        "source": str(posture.get("source") or "not-configured"),
        "domainUrl": str(posture.get("domainUrl") or ""),
        "tokenUrlConfigured": bool(posture.get("tokenUrlConfigured")),
        "clientIdConfigured": bool(posture.get("clientIdConfigured")),
        "clientSecretConfigured": bool(posture.get("clientSecretConfigured")),
        "audience": str(posture.get("audience") or ""),
        "scope": str(posture.get("scope") or ""),
    }


def incident_lookup(prompt):
    return {
        "tool": "incident_lookup",
        "status": "degraded-checkout-confirmation",
        "severity": "high" if "checkout" in prompt.lower() else "medium",
        "affectedCustomers": 42,
    }


def policy_search(prompt):
    return {
        "tool": "policy_search",
        "policy": "Customer-impacting actions require approval when severity is high.",
        "evidence": ["approval-required-for-high-severity", "customer-update-within-30-minutes"],
    }


def sql_metric_summary(prompt):
    return {
        "tool": "sql_metric_summary",
        "metric": "confirmation_delay_minutes_p95",
        "value": 18,
        "trend": "up",
    }


def approval_request(risk_level):
    return {
        "tool": "approval_request",
        "approvalRequired": risk_level == "high",
        "approver": "operations-manager" if risk_level == "high" else "",
    }


def audit_event(plan):
    return {
        "tool": "audit_event",
        "eventType": "agentic-control-tower-plan",
        "recorded": True,
        "stepCount": len(plan["steps"]),
    }


def build_plan(prompt):
    risk_level = "high" if any(term in prompt.lower() for term in ["refund", "checkout", "customer"]) else "medium"
    return {
        "goal": "Coordinate a governed enterprise agent workflow with evidence and approval.",
        "riskLevel": risk_level,
        "steps": [
            "Classify incident intent",
            "Gather incident and policy evidence",
            "Summarize operational metrics",
            "Check approval requirement",
            "Record audit event",
            "Synthesize final response",
        ],
    }


async def run_llamaindex_control_tower(prompt, idcs_posture):
    Event, StartEvent, StopEvent, Workflow, step = load_llamaindex_workflow()

    class PlanEvent(Event):
        plan: dict

    class ToolEvent(Event):
        plan: dict
        tool_results: list

    class ReviewEvent(Event):
        plan: dict
        tool_results: list
        evidence_review: dict

    class ControlTowerWorkflow(Workflow):
        @step
        async def plan(self, ev: StartEvent) -> PlanEvent:
            return PlanEvent(plan=build_plan(ev.prompt))

        @step
        async def execute_tools(self, ev: PlanEvent) -> ToolEvent:
            results = [
                incident_lookup(prompt),
                policy_search(prompt),
                sql_metric_summary(prompt),
                approval_request(ev.plan["riskLevel"]),
                audit_event(ev.plan),
            ]
            return ToolEvent(plan=ev.plan, tool_results=results)

        @step
        async def review(self, ev: ToolEvent) -> ReviewEvent:
            evidence_review = {
                "sufficient": all(result.get("tool") for result in ev.tool_results),
                "requiresApproval": any(result.get("approvalRequired") for result in ev.tool_results),
                "idcsConfigured": idcs_posture["configured"],
            }
            return ReviewEvent(plan=ev.plan, tool_results=ev.tool_results, evidence_review=evidence_review)

        @step
        async def finish(self, ev: ReviewEvent) -> StopEvent:
            return StopEvent(
                result={
                    "plan": ev.plan,
                    "toolResults": ev.tool_results,
                    "evidenceReview": ev.evidence_review,
                    "memoryNote": {
                        "subject": "operations-control-tower",
                        "fact": f"Latest risk level is {ev.plan['riskLevel']} with approval={ev.evidence_review['requiresApproval']}",
                    },
                }
            )

    workflow = ControlTowerWorkflow(timeout=10, verbose=False)
    return await workflow.run(prompt=prompt)


def build_control_tower_prompt(prompt, workflow, idcs_posture):
    return (
        "You are an enterprise agent control tower. Summarize the workflow, evidence, approval state, "
        "IDCS credential posture, and next action. Do not invent evidence.\n\n"
        f"User request: {prompt}\n\n"
        f"Workflow: {json.dumps(workflow, sort_keys=True)}\n\n"
        f"IDCS posture: {json.dumps(idcs_posture, sort_keys=True)}"
    )


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Agentic Control Tower demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    idcs_posture = idcs_posture_from_env()
    workflow = asyncio.run(run_llamaindex_control_tower(prompt, idcs_posture))
    trace = [
        "Loaded LlamaIndex agentic control tower workflow",
        "Planned governed multi-tool incident workflow",
        "Executed local enterprise tools",
        "Reviewed evidence and approval posture",
        "Checked hosted app IDCS credential posture",
    ]
    result = {
        "feature": "Agentic Control Tower",
        "mode": "agentic-control-tower",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
        },
        "idcsCredentialPosture": idcs_posture,
        "workflow": workflow,
        "trace": trace,
    }

    validate_config(config)
    response = call_oci_responses_api(
        build_control_tower_prompt(prompt, workflow, idcs_posture),
        temperature,
        model,
        config,
    )
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [*trace, "Called OCI Responses API for final control tower synthesis"]
    return result


def main():
    payload = read_payload()
    try:
        print(json.dumps(run_demo(payload)))
        return 0
    except Exception as exc:
        config = config_from_env()
        model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
        idcs_posture = idcs_posture_from_env()
        workflow = {}
        trace = ["Live OCI Responses API call was not completed"]
        try:
            workflow = asyncio.run(run_llamaindex_control_tower(str(payload.get("prompt", "")).strip() or "enterprise incident", idcs_posture))
            trace = [
                "Loaded LlamaIndex agentic control tower workflow",
                "Planned governed multi-tool incident workflow",
                "Executed local enterprise tools",
                "Reviewed evidence and approval posture",
                "Checked hosted app IDCS credential posture",
                "Live OCI Responses API call was not completed",
            ]
        except Exception as workflow_exc:
            trace = ["LlamaIndex agentic control tower workflow was not completed"]
            workflow = {"error": str(workflow_exc)}
        print(
            json.dumps(
                {
                    "feature": "Agentic Control Tower",
                    "mode": "agentic-control-tower",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                    },
                    "idcsCredentialPosture": idcs_posture,
                    "workflow": workflow,
                    "error": str(exc),
                    "trace": trace,
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run focused Python tests**

Run:

```bash
node --test tests/agenticControlTowerDemo.test.js tests/finalLiveDemos.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Python demo**

```bash
git add backend/demos/agentic_control_tower.py tests/agenticControlTowerDemo.test.js
git commit -m "feat: add LlamaIndex agentic control tower demo"
```

---

### Task 5: Register Card Metadata And UI Flow Content

**Files:**
- Modify: `src/data/aiFeatures.js`
- Modify: `src/main.js`

- [ ] **Step 1: Add card metadata**

In `src/data/aiFeatures.js`, insert after `openclaw-hosted-agent-gateway`:

```js
{
  id: "agentic-control-tower",
  title: "Agentic Control Tower",
  serviceArea: "OCI Generative AI Agents",
  summary: "Run a LlamaIndex control workflow that plans tools, reviews evidence, gates approval, and reports IDCS posture.",
  details:
    "Runs a real LlamaIndex workflow with deterministic enterprise tools, evidence review, approval gating, memory note generation, and OCI Responses API synthesis. The result includes server-side IDCS credential posture from the Terraform-generated hosted app launch client without exposing secrets.",
  provisioningDetails:
    "Uses the shared OCI Generative AI project/API key and reuses the Terraform-generated IDCS launch client metadata from the hosted-agentic-applications module. No new Terraform resource is required for the first local workflow version.",
  status: "Live OSS Agent",
  accent: "green",
  terraformPath: "infra/hosted-agentic-applications",
  sdkModule: "backend/demos/agentic_control_tower.py",
  sampleUseCase: "Coordinate incident triage across planning, tools, evidence review, approval, audit, and final response.",
  demoHref: "#demo-agentic-control-tower",
  docsHref: "https://docs.llamaindex.ai/en/stable/module_guides/workflow/",
  actions: ["Provision Infra", "Run Demo", "Delete Infra"],
  capabilities: ["LlamaIndex workflow", "Tool critique loop", "IDCS credential posture"]
}
```

- [ ] **Step 2: Add UI value proposition content**

In `src/main.js`, add `"agentic-control-tower"` to the same objects that contain `"agentic-rag-planner"` and hosted-agent entries:

```js
"agentic-control-tower": {
  services: [
    "Real LlamaIndex workflow for multi-step agent orchestration.",
    "OCI Responses API for final synthesis when live configuration is present."
  ],
  security: [
    "IDCS credential posture is loaded server-side from Terraform-generated metadata.",
    "Client secret and API key values are redacted before browser output."
  ],
  result: [
    "Shows planning, tool execution, evidence review, approval, memory, and audit in one agent run.",
    "Useful for enterprise control tower and incident command workflows."
  ]
}
```

- [ ] **Step 3: Add flow diagram text**

In the `flowDiagrams` object, add:

```js
"agentic-control-tower": `flowchart LR
  Prompt[Operator prompt] --> Workflow[LlamaIndex workflow]
  Workflow --> Tools[Enterprise tool execution]
  Tools --> Review[Evidence and approval review]
  Review --> IDCS[IDCS posture check]
  IDCS --> OCI[OCI Responses synthesis]
  OCI --> Result[Control tower response]`,
```

- [ ] **Step 4: Add technical flow**

In `demoTechnicalFlows`, add:

```js
"agentic-control-tower": [
  defaultTechnicalFlow[0],
  {
    ...defaultTechnicalFlow[1],
    title: "LlamaIndex",
    subtitle: "Workflow planner",
    feature: "The Python demo uses LlamaIndex workflow steps to plan, execute tools, review evidence, and prepare memory.",
    auth: "The workflow receives only redacted IDCS posture and non-secret runtime values.",
    interaction: "The workflow produces a governed incident plan before model synthesis."
  },
  {
    ...defaultTechnicalFlow[2],
    title: "Tool Review",
    subtitle: "Evidence and approval",
    feature: "Local enterprise tools return incident, policy, metric, approval, and audit artifacts.",
    auth: "Tools are deterministic and constrained to the demo process.",
    interaction: "Evidence sufficiency and approval requirements are checked before final response."
  },
  {
    ...defaultTechnicalFlow[3],
    title: "OCI Synthesis",
    subtitle: "Responses API",
    feature: "OCI Responses API summarizes the workflow when live configuration is present.",
    auth: "The shared project/API key remains server-side.",
    interaction: "The final output combines plan, evidence, approval state, and IDCS posture."
  },
  defaultTechnicalFlow[4]
],
```

- [ ] **Step 5: Run metadata tests**

Run:

```bash
node --test tests/features.test.js
```

Expected: fails only because `docs/wiring/agentic-control-tower.svg` has not been generated yet.

- [ ] **Step 6: Commit UI metadata**

```bash
git add src/data/aiFeatures.js src/main.js
git commit -m "feat: register agentic control tower card"
```

---

### Task 6: Generate Wiring Diagram

**Files:**
- Create: `docs/wiring/agentic-control-tower.svg`

- [ ] **Step 1: Generate diagrams**

Run:

```bash
npm run generate:wiring-diagrams
```

Expected output includes:

```text
Generated 24 wiring diagrams
```

- [ ] **Step 2: Verify new SVG**

Run:

```bash
rg "Agentic Control Tower|OCI|agentic_control_tower.py" docs/wiring/agentic-control-tower.svg
```

Expected: all three terms are found.

- [ ] **Step 3: Run feature test**

Run:

```bash
node --test tests/features.test.js
```

Expected: PASS.

- [ ] **Step 4: Commit wiring diagram**

```bash
git add docs/wiring/agentic-control-tower.svg
git commit -m "docs: add agentic control tower wiring"
```

---

### Task 7: Full Verification

**Files:**
- No code edits unless verification exposes a defect.

- [ ] **Step 1: Run build**

Run:

```bash
npm run build
```

Expected: `node --check src/main.js` and `node --check server.mjs` both pass.

- [ ] **Step 2: Run full tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Smoke-test app response**

If the portal is still running on port `5173`, run:

```bash
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u no_proxy -u NO_PROXY curl --silent --show-error --max-time 5 --head http://127.0.0.1:5173/
```

Expected: `HTTP/1.1 302 Found` with `Location: /login`, or another valid portal response if already logged in.

- [ ] **Step 4: Check working tree**

Run:

```bash
git status --short
```

Expected: only pre-existing unrelated local changes remain, or the working tree is clean if those were handled separately.

---

## Self-Review

- Spec coverage: the plan adds a real LlamaIndex dependency, a new demo card, server run routing, server-side IDCS posture reuse from existing Terraform metadata, redaction, graceful missing-config behavior, wiring docs, and tests.
- Red-flag scan: no unresolved markers or unspecified "add tests" steps remain.
- Type consistency: feature id is consistently `agentic-control-tower`; Python script is consistently `agentic_control_tower.py`; IDCS output is consistently `idcsCredentialPosture`.
