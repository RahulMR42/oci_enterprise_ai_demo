resource "terraform_data" "conversation_store" {
  triggers_replace = [
    "resource-manager-generated-runtime-files-20260605",
    var.resource_suffix,
    var.oci_genai_project_id
  ]

  input = {
    generated_file      = "${path.module}/.terraform/generated/conversation.json"
    openai_base_url     = "https://inference.generativeai.${var.region}.oci.oraclecloud.com/openai/v1"
    shared_api_key_file = "${path.module}/${var.shared_generated_dir}/api_key.json"
    shared_project_file = "${path.module}/${var.shared_generated_dir}/project.json"
    topic               = var.conversation_metadata_topic
    resource_suffix     = var.resource_suffix
  }

  provisioner "local-exec" {
    environment = {
      OCI_GENAI_API_KEY    = var.oci_genai_api_key
      OCI_GENAI_PROJECT_ID = var.oci_genai_project_id
    }

    command = <<-EOT
      set -euo pipefail
      mkdir -p '${path.module}/.terraform/generated'
      python_bin="../../env/bin/python"
      if [ ! -x "$python_bin" ]; then
        python_bin="python3"
      fi
      if [ "$python_bin" = "python3" ]; then
        "$python_bin" -m pip install --user --quiet openai
      fi
      "$python_bin" - <<PY
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from openai import OpenAI

api_key = os.getenv("OCI_GENAI_API_KEY") or json.loads(Path("${self.input.shared_api_key_file}").read_text()).get("data", {}).get("keys", [{}])[0].get("key", "")
project_id = os.getenv("OCI_GENAI_PROJECT_ID") or json.loads(Path("${self.input.shared_project_file}").read_text()).get("data", {}).get("id", "")
if not api_key:
    raise SystemExit("Missing shared OCI Generative AI API key. Apply infra/responses-api first.")
if not project_id:
    raise SystemExit("Missing shared OCI Generative AI project ID. Apply infra/responses-api first.")

client = OpenAI(
    base_url="${self.input.openai_base_url}",
    api_key=api_key,
    project=project_id,
)

def dump(value):
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if hasattr(value, "model_dump_json"):
        return json.loads(value.model_dump_json())
    return dict(value)

def existing_conversation():
    try:
        listed = client.conversations.list(limit=100)
    except Exception:
        return None
    items = getattr(listed, "data", None) or (listed.get("data", []) if isinstance(listed, dict) else [])
    for item in items:
        payload = dump(item)
        metadata = payload.get("metadata") or {}
        status = str(payload.get("status") or payload.get("state") or "").lower()
        if status in {"deleted", "deleting", "expired", "failed"}:
            continue
        if metadata.get("demo") == "conversation-store" and metadata.get("resource_suffix") == "${self.input.resource_suffix}":
            return payload
    return None

payload = existing_conversation()
if not payload:
    conversation = client.conversations.create(
        metadata={
        "topic": "${self.input.topic}",
        "managed_by": "terraform",
        "demo": "conversation-store",
        "resource_suffix": "${self.input.resource_suffix}",
        }
    )
    payload = dump(conversation)
payload["createdAt"] = datetime.now(timezone.utc).isoformat()
payload["environmentVariable"] = "OCI_GENAI_CONVERSATION_ID"
Path("${self.input.generated_file}").write_text(json.dumps(payload, indent=2))
print(json.dumps(payload))
PY
      echo "Export OCI_GENAI_CONVERSATION_ID from .terraform/generated/conversation.json before running the portal demo."
    EOT
  }

  provisioner "local-exec" {
    when    = destroy
    command = <<-EOT
      set -euo pipefail
      generated_file='${self.input.generated_file}'
      if [ ! -f "$generated_file" ]; then
        echo "No generated OCI conversation metadata found; skipping remote delete."
        exit 0
      fi
      conversation_id="$(python3 -c 'import json, pathlib, sys; data=json.loads(pathlib.Path(sys.argv[1]).read_text()); print(data.get("id", ""))' "$generated_file")"
      if [ -z "$conversation_id" ]; then
        echo "Generated OCI conversation metadata has no id; skipping remote delete."
        exit 0
      fi
      python_bin="../../env/bin/python"
      if [ ! -x "$python_bin" ]; then
        python_bin="python3"
      fi
      if [ "$python_bin" = "python3" ]; then
        "$python_bin" -m pip install --user --quiet openai
      fi
      "$python_bin" - <<PY
import json
import os
from pathlib import Path
from openai import OpenAI

api_key = os.getenv("OCI_GENAI_API_KEY") or json.loads(Path("${self.input.shared_api_key_file}").read_text()).get("data", {}).get("keys", [{}])[0].get("key", "")
project_id = os.getenv("OCI_GENAI_PROJECT_ID") or json.loads(Path("${self.input.shared_project_file}").read_text()).get("data", {}).get("id", "")
if not api_key or not project_id:
    print("Missing shared OCI Generative AI project/API key; skipping conversation remote delete.")
    Path("${self.input.generated_file}").unlink(missing_ok=True)
    raise SystemExit(0)

client = OpenAI(
    base_url="${self.input.openai_base_url}",
    api_key=api_key,
    project=project_id,
)
client.conversations.delete("$conversation_id")
print("Deleted OCI conversation $conversation_id")
Path("${self.input.generated_file}").unlink(missing_ok=True)
PY
    EOT
  }
}
