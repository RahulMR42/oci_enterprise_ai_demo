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
