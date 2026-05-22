import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("responses api python demo returns structured output", () => {
  const result = spawnSync(
    "python3",
    ["backend/demos/responses_api.py"],
    {
      input: JSON.stringify({
        prompt: "Summarize this support note: database latency increased after deployment.",
        model: "openai.gpt-oss-120b"
      }),
      encoding: "utf8"
    }
  );

  assert.equal(result.status, 1);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.feature, "OCI Responses API");
  assert.equal(payload.mode, "oci-responses-api");
  assert.equal(payload.request.model, "openai.gpt-oss-120b");
  assert.ok(payload.request.baseUrl.includes("inference.generativeai.us-chicago-1.oci.oraclecloud.com/openai/v1"));
  assert.ok(payload.error.includes("OCI_GENAI_API_KEY"));
  assert.ok(!payload.output);
  assert.ok(Array.isArray(payload.trace));
  assert.ok(payload.trace.includes("Validated request for OCI Responses API"));
});
