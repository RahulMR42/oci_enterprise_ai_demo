import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("conversation store demo returns structured config error before live call", () => {
  const result = spawnSync(
    "python3",
    ["backend/demos/conversation_store.py"],
    {
      input: JSON.stringify({
        sessionId: "test-session",
        prompt: "Remember this customer prefers concise updates.",
        model: "openai.gpt-oss-120b"
      }),
      encoding: "utf8"
    }
  );

  assert.equal(result.status, 1);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.feature, "Conversation Store");
  assert.equal(payload.mode, "conversation-store");
  assert.ok(payload.error.includes("OCI_GENAI_API_KEY"));
  assert.ok(Array.isArray(payload.trace));
});
