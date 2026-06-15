import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const demos = [
  {
    script: "backend/demos/function_calling.py",
    feature: "Function Calling",
    mode: "function-calling",
    prompt: "Look up order ORD-1001 and draft a customer update.",
    trace: "Loaded local function catalog"
  },
  {
    script: "backend/demos/remote_mcp_calling.py",
    feature: "Remote MCP Calling",
    mode: "remote-mcp-calling",
    prompt: "Search the enterprise knowledge tool for checkout delays.",
    trace: "Loaded local MCP-compatible gateway"
  },
  {
    script: "backend/demos/nl2sql_sql_search.py",
    feature: "NL2SQL / SQL Search",
    mode: "nl2sql-sql-search",
    prompt: "Which premium customers have delayed orders?",
    trace: "Loaded SQL Search sample schema"
  },
  {
    script: "backend/demos/long_term_memory.py",
    feature: "Long-Term Memory",
    mode: "long-term-memory",
    prompt: "Remember that Acme Retail prefers concise updates.",
    trace: "Loaded durable subject-scoped memory store"
  }
];

test("next four python demos return structured output when OCI config is missing", () => {
  for (const demo of demos) {
    const result = spawnSync(
      "python3",
      [demo.script],
      {
        input: JSON.stringify({
          prompt: demo.prompt,
          model: "openai.gpt-oss-120b",
          sessionId: "test-subject"
        }),
        encoding: "utf8",
        env: {
          ...process.env,
          OCI_GENAI_API_KEY: "",
          OCI_GENAI_PROJECT_ID: ""
        }
      }
    );

    assert.equal(result.status, 1, demo.script);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.feature, demo.feature);
    assert.equal(payload.mode, demo.mode);
    assert.equal(payload.request.model, "openai.gpt-oss-120b");
    assert.ok(payload.error.includes("OCI_GENAI_API_KEY"));
    assert.ok(!payload.output);
    assert.ok(Array.isArray(payload.trace));
    assert.ok(payload.trace.includes(demo.trace));
  }
});

function loadStatefulDemoPaths(env) {
  const script = `
import json
import sys

sys.path.insert(0, "backend/demos")

import conversation_store
import governance_center
import long_term_memory
import nl2sql_sql_search

print(json.dumps({
    "conversation": str(conversation_store.STORE_PATH),
    "governance": str(governance_center.AUDIT_PATH),
    "longTermMemory": str(long_term_memory.STORE_PATH),
    "nl2sql": str(nl2sql_sql_search.DB_PATH),
}, sort_keys=True))
`;
  const result = spawnSync("python3", ["-c", script], {
    encoding: "utf8",
    env
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test("stateful python demos use writable runtime data paths", () => {
  const defaultPaths = loadStatefulDemoPaths({
    ...process.env,
    OCI_PORTAL_DEMO_DATA_DIR: "",
    OCI_DEMO_DATA_DIR: ""
  });

  for (const path of Object.values(defaultPaths)) {
    assert.ok(
      path.startsWith("/dev/shm/enterprise-ai-demo/backend-data/") ||
        path.startsWith("/tmp/enterprise-ai-demo/backend-data/"),
      path
    );
  }

  const demoDataDir = mkdtempSync(join(tmpdir(), "enterprise-ai-demo-data-"));
  try {
    const customPaths = loadStatefulDemoPaths({
      ...process.env,
      OCI_PORTAL_DEMO_DATA_DIR: demoDataDir
    });

    for (const path of Object.values(customPaths)) {
      assert.ok(path.startsWith(`${demoDataDir}/`), path);
    }
  } finally {
    rmSync(demoDataDir, { recursive: true, force: true });
  }
});

test("stateful python demos tolerate read-only configured data paths", () => {
  const script = `
import sys

sys.path.insert(0, "backend/demos")

import conversation_store
import governance_center
import long_term_memory
import nl2sql_sql_search

connection = nl2sql_sql_search._ensure_database()
if isinstance(connection, tuple):
    connection = connection[0]
connection.close()
long_term_memory._write_store({"subjects": {}})
conversation_store._write_store({"sessions": {}})
governance_center._write_audit({"events": []})
print("ok")
`;
  const result = spawnSync("python3", ["-c", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      OCI_PORTAL_DEMO_DATA_DIR: "/proc/enterprise-ai-demo"
    }
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.trim(), "ok");
});
