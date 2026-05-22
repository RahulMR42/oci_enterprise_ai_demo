import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("file search vector store demo returns structured config error before live call", () => {
  const result = spawnSync(
    "python3",
    ["backend/demos/file_search_vector_store_rag.py"],
    {
      input: JSON.stringify({
        prompt: "What policy applies to delayed checkout confirmations?",
        model: "openai.gpt-oss-120b"
      }),
      encoding: "utf8"
    }
  );

  assert.equal(result.status, 1);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.feature, "File Search & Vector Store RAG");
  assert.equal(payload.mode, "file-search-vector-store-rag");
  assert.equal(payload.request.model, "openai.gpt-oss-120b");
  assert.equal(payload.request.tool.type, "file_search");
  assert.ok(payload.error.includes("OCI_GENAI_VECTOR_STORE_ID"));
  assert.ok(!payload.output);
  assert.ok(Array.isArray(payload.trace));
  assert.ok(payload.trace.includes("Prepared File Search tool definition"));
});
