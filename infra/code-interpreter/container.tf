resource "terraform_data" "code_interpreter_container" {
  triggers_replace = [
    "resource-manager-generated-runtime-files-20260605",
    var.resource_suffix,
    var.oci_genai_project_id
  ]

  input = {
    display_name         = local.container_display_name
    generated_file       = "${path.module}/.terraform/generated/container.json"
    memory_limit         = var.container_memory_limit
    openai_base_url      = local.openai_base_url
    shared_api_key_file  = "${path.module}/${var.shared_generated_dir}/api_key.json"
    shared_generated_dir = var.shared_generated_dir
    shared_project_file  = "${path.module}/${var.shared_generated_dir}/project.json"
  }

  provisioner "local-exec" {
    environment = {
      OCI_GENAI_API_KEY    = var.oci_genai_api_key
      OCI_GENAI_PROJECT_ID = var.oci_genai_project_id
    }

    command = <<-EOT
      set -euo pipefail
      mkdir -p '${path.module}/.terraform/generated'
      api_key="$${OCI_GENAI_API_KEY:-}"
      if [ -z "$api_key" ]; then
        api_key="$(python3 -c 'import json, pathlib, sys; data=json.loads(pathlib.Path(sys.argv[1]).read_text()); keys=data.get("data", data).get("keys", []); print((keys[0] if keys else {}).get("key", ""))' '${self.input.shared_api_key_file}')"
      fi
      project_id="$${OCI_GENAI_PROJECT_ID:-}"
      if [ -z "$project_id" ]; then
        project_id="$(python3 -c 'import json, pathlib, sys; data=json.loads(pathlib.Path(sys.argv[1]).read_text()).get("data", {}); print(data.get("id", ""))' '${self.input.shared_project_file}')"
      fi
      if [ -z "$api_key" ]; then
        echo "Missing shared OCI Generative AI API key. Apply infra/responses-api first." >&2
        exit 1
      fi
      if [ -z "$project_id" ]; then
        echo "Missing shared OCI Generative AI project ID. Apply infra/responses-api first." >&2
        exit 1
      fi
      python_bin="../../env/bin/python"
      if [ ! -x "$python_bin" ]; then
        python_bin="python3"
      fi
      if [ "$python_bin" = "python3" ]; then
        "$python_bin" -m pip install --user --quiet openai
      fi
      container_json="$("$python_bin" - <<PY
import json
from openai import OpenAI

client = OpenAI(
    base_url="${self.input.openai_base_url}",
    api_key="$api_key",
    project="$project_id",
)

def dump(value):
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if hasattr(value, "model_dump_json"):
        return json.loads(value.model_dump_json())
    return dict(value)

def existing_container():
    try:
        listed = client.containers.list(limit=100)
    except Exception:
        return None
    items = getattr(listed, "data", None) or (listed.get("data", []) if isinstance(listed, dict) else [])
    for item in items:
        payload = dump(item)
        status = str(payload.get("status") or payload.get("state") or "").lower()
        if status in {"deleted", "deleting", "expired", "failed"}:
            continue
        if payload.get("name") == "${self.input.display_name}":
            return payload
    return None

payload = existing_container()
if not payload:
    container = client.containers.create(
        name="${self.input.display_name}",
        memory_limit="${self.input.memory_limit}",
    )
    payload = dump(container)
if hasattr(payload, "model_dump"):
    print(json.dumps(payload.model_dump(mode="json")))
else:
    print(json.dumps(payload))
PY
      )"
      printf '%s\n' "$container_json" > '${path.module}/.terraform/generated/container.json'
      printf '%s\n' "$container_json"
      echo "Export OCI_GENAI_CODE_INTERPRETER_CONTAINER from .terraform/generated/container.json before running the portal demo."
    EOT
  }

  provisioner "local-exec" {
    when    = destroy
    command = <<-EOT
      set -euo pipefail
      generated_file='${self.input.generated_file}'
      if [ ! -f "$generated_file" ]; then
        echo "No generated Code Interpreter container metadata found; skipping remote delete."
        exit 0
      fi
      container_id="$(python3 -c 'import json, pathlib, sys; data=json.loads(pathlib.Path(sys.argv[1]).read_text()); print(data.get("id", ""))' "$generated_file")"
      if [ -z "$container_id" ]; then
        echo "Generated Code Interpreter container metadata has no id; skipping remote delete."
        exit 0
      fi
      api_key="$${OCI_GENAI_API_KEY:-}"
      if [ -z "$api_key" ]; then
        api_key="$(python3 -c 'import json, pathlib, sys; data=json.loads(pathlib.Path(sys.argv[1]).read_text()); keys=data.get("data", data).get("keys", []); print((keys[0] if keys else {}).get("key", ""))' '${self.input.shared_api_key_file}')"
      fi
      project_id="$${OCI_GENAI_PROJECT_ID:-}"
      if [ -z "$project_id" ]; then
        project_id="$(python3 -c 'import json, pathlib, sys; data=json.loads(pathlib.Path(sys.argv[1]).read_text()).get("data", {}); print(data.get("id", ""))' '${self.input.shared_project_file}')"
      fi
      if [ -z "$api_key" ] || [ -z "$project_id" ]; then
        echo "Missing shared OCI Generative AI project/API key; skipping remote container delete." >&2
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
from openai import OpenAI

client = OpenAI(
    base_url="${self.input.openai_base_url}",
    api_key="$api_key",
    project="$project_id",
)
client.containers.delete("$container_id")
print("Deleted Code Interpreter container $container_id")
PY
      rm -f "$generated_file"
    EOT
  }
}
