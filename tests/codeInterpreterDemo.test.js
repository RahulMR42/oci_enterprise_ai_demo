import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("code interpreter demo returns structured config error before live call", () => {
  const result = spawnSync(
    "python3",
    ["backend/demos/code_interpreter.py"],
    {
      input: JSON.stringify({
        prompt: "Use Python to calculate the mean of 12, 18, 24, 30, and 42.",
        model: "openai.gpt-oss-120b"
      }),
      encoding: "utf8"
    }
  );

  assert.equal(result.status, 1);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.feature, "Code Interpreter");
  assert.equal(payload.mode, "code-interpreter");
  assert.equal(payload.request.model, "openai.gpt-oss-120b");
  assert.equal(payload.request.tool.type, "code_interpreter");
  assert.equal(payload.request.tool.container.type, "auto");
  assert.ok(payload.error.includes("OCI_GENAI_API_KEY"));
  assert.ok(!payload.output);
  assert.ok(Array.isArray(payload.trace));
  assert.ok(payload.trace.includes("Prepared Code Interpreter tool definition"));
});

test("code interpreter demo creates replacement container when explicit container expires", () => {
  const script = `
import code_interpreter

calls = []
created = []

class FakeResponse:
    output_text = "Computed with a recreated container."

    def model_dump(self, mode="json"):
        return {"output_text": self.output_text}

class FakeContainer:
    id = "container-recreated-456"

    def model_dump(self, mode="json"):
        return {"id": self.id, "name": "runtime-code-interpreter", "memory_limit": "1g"}

class FakeContainers:
    def create(self, **kwargs):
        created.append(kwargs)
        return FakeContainer()

class FakeClient:
    containers = FakeContainers()

def fake_validate_config(config):
    return None

def fake_create_client(config):
    return FakeClient()

def fake_call(**kwargs):
    calls.append(kwargs["tools"][0]["container"])
    if len(calls) == 1:
        raise RuntimeError("Internal Server Error")
    return FakeResponse()

code_interpreter.validate_config = fake_validate_config
code_interpreter.create_client = fake_create_client
code_interpreter.call_oci_responses_api_with_tools = fake_call

result = code_interpreter.run_demo({
    "prompt": "Calculate 2 + 2 using Python.",
    "model": "openai.gpt-oss-120b",
    "codeInterpreterContainer": "container-expired-123",
    "apiKey": "configured",
    "project": "configured"
})

import json
print(json.dumps({"result": result, "calls": calls, "created": created}))
`;

  const result = spawnSync("python3", ["-c", script], {
    env: {
      ...process.env,
      PYTHONPATH: "backend/demos",
      OCI_GENAI_API_KEY: "configured",
      OCI_GENAI_PROJECT_ID: "configured"
    },
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.result.output, "Computed with a recreated container.");
  assert.equal(payload.calls[0], "container-expired-123");
  assert.equal(payload.calls[1], "container-recreated-456");
  assert.equal(payload.created[0].memory_limit, "1g");
  assert.equal(payload.result.recreatedCodeInterpreterContainer.id, "container-recreated-456");
  assert.equal(payload.result.request.tool.container, "container-recreated-456");
  assert.equal(payload.result.notices[0].type, "container-recreated");
  assert.match(payload.result.notices[0].message, /replacement container container-recreated-456/);
  assert.ok(payload.result.trace.includes("Code Interpreter container recovery triggered; created replacement container container-recreated-456"));
});

test("code interpreter demo can create a fresh container before the live call", () => {
  const script = `
import code_interpreter

calls = []
created = []

class FakeResponse:
    output_text = "Computed with a fresh container."

    def model_dump(self, mode="json"):
        return {"output_text": self.output_text}

class FakeContainer:
    id = "container-fresh-789"

    def model_dump(self, mode="json"):
        return {"id": self.id, "name": "runtime-code-interpreter", "memory_limit": "1g"}

class FakeContainers:
    def create(self, **kwargs):
        created.append(kwargs)
        return FakeContainer()

class FakeClient:
    containers = FakeContainers()

def fake_validate_config(config):
    return None

def fake_create_client(config):
    return FakeClient()

def fake_call(**kwargs):
    calls.append(kwargs["tools"][0]["container"])
    return FakeResponse()

code_interpreter.validate_config = fake_validate_config
code_interpreter.create_client = fake_create_client
code_interpreter.call_oci_responses_api_with_tools = fake_call

result = code_interpreter.run_demo({
    "prompt": "Calculate 2 + 2 using Python.",
    "model": "openai.gpt-oss-120b",
    "codeInterpreterContainer": "container-expired-123",
    "createNewCodeInterpreterContainer": True
})

import json
print(json.dumps({"result": result, "calls": calls, "created": created}))
`;

  const result = spawnSync("python3", ["-c", script], {
    env: {
      ...process.env,
      PYTHONPATH: "backend/demos",
      OCI_GENAI_API_KEY: "configured",
      OCI_GENAI_PROJECT_ID: "configured"
    },
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.calls, ["container-fresh-789"]);
  assert.equal(payload.created[0].memory_limit, "1g");
  assert.equal(payload.result.recreatedCodeInterpreterContainer.id, "container-fresh-789");
  assert.equal(payload.result.request.tool.container, "container-fresh-789");
  assert.equal(payload.result.notices[0].type, "container-created");
  assert.ok(payload.result.trace.includes("Code Interpreter container created for this run; using replacement container container-fresh-789"));
});
