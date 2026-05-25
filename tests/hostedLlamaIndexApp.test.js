import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

const port = 18080;
const baseUrl = `http://127.0.0.1:${port}`;

function waitForHealth() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`${baseUrl}/health`);
        if (response.ok) {
          clearInterval(timer);
          resolve(await response.json());
        }
      } catch {
        if (Date.now() - started > 10000) {
          clearInterval(timer);
          reject(new Error("hosted LlamaIndex app did not become healthy"));
        }
      }
    }, 250);
  });
}

test("hosted LlamaIndex app serves health and workflow responses", async () => {
  const child = spawn("python3", ["apps/hosted-llamaindex-control-tower/app.py"], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  test.after(() => child.kill("SIGTERM"));

  const health = await waitForHealth();
  assert.equal(health.runtime, "llamaindex");
  assert.equal(health.status, "healthy");
  assert.ok(health.graphSteps.includes("plan"));

  const response = await fetch(`${baseUrl}/agent/control-tower/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "test-control-tower",
      prompt: "Coordinate checkout delay triage with approval and audit."
    })
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.hosted, true);
  assert.equal(payload.runtime, "llamaindex");
  assert.equal(payload.status, "completed");
  assert.ok(Array.isArray(payload.workflow.plan.steps));
  assert.ok(Array.isArray(payload.workflow.toolResults));
  assert.equal(payload.workflow.evidenceReview.requiresApproval, true);
});
