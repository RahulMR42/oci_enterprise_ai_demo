resource "terraform_data" "file_search_vector_store" {
  input = {
    compartment_id         = var.compartment_id
    control_plane_base_url = local.control_plane_base_url
    display_name           = local.vector_store_display_name
    generated_file         = "${path.module}/.terraform/generated/vector_store.json"
    openai_base_url        = local.openai_base_url
    profile                = var.profile
    shared_api_key_file    = "${path.module}/${var.shared_generated_dir}/api_key.json"
    shared_generated_dir   = var.shared_generated_dir
    shared_project_file    = "${path.module}/${var.shared_generated_dir}/project.json"
  }

  provisioner "local-exec" {
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
      vector_store_json="$("$python_bin" - <<PY
import json
from pathlib import Path
from openai import OpenAI

api_key = json.loads(Path("${self.input.shared_api_key_file}").read_text()).get("data", {}).get("keys", [{}])[0].get("key", "")
project_id = json.loads(Path("${self.input.shared_project_file}").read_text()).get("data", {}).get("id", "")
if not api_key:
    raise SystemExit("Missing shared OCI Generative AI API key. Apply infra/responses-api first.")
if not project_id:
    raise SystemExit("Missing shared OCI Generative AI project ID. Apply infra/responses-api first.")

client = OpenAI(
    base_url="${self.input.openai_base_url}",
    api_key=api_key,
    project=project_id,
)
vector_store = client.vector_stores.create(
    name="${self.input.display_name}",
    expires_after={"anchor": "last_active_at", "days": 30},
    metadata={
        "compartment_id": "${self.input.compartment_id}",
        "managed_by": "terraform",
        "demo": "enterprise-ai-demo-file-search",
    },
)
if hasattr(vector_store, "model_dump"):
    print(json.dumps(vector_store.model_dump(mode="json")))
else:
    print(vector_store.model_dump_json())
PY
      )"
      printf '%s\n' "$vector_store_json" > '${path.module}/.terraform/generated/vector_store.json'
      printf '%s\n' "$vector_store_json"
      echo "Export OCI_GENAI_VECTOR_STORE_ID from .terraform/generated/vector_store.json before running the portal demo."
    EOT
  }

  provisioner "local-exec" {
    when    = destroy
    command = <<-EOT
      set -euo pipefail
      generated_file='${self.input.generated_file}'
      if [ ! -f "$generated_file" ]; then
        echo "No generated File Search vector store metadata found; skipping remote delete."
        exit 0
      fi
      vector_store_id="$(python3 -c 'import json, pathlib, sys; data=json.loads(pathlib.Path(sys.argv[1]).read_text()); print(data.get("id", ""))' "$generated_file")"
      if [ -z "$vector_store_id" ]; then
        echo "Generated File Search vector store metadata has no id; skipping remote delete."
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
from pathlib import Path
from openai import OpenAI

api_key = json.loads(Path("${self.input.shared_api_key_file}").read_text()).get("data", {}).get("keys", [{}])[0].get("key", "")
project_id = json.loads(Path("${self.input.shared_project_file}").read_text()).get("data", {}).get("id", "")
if not api_key or not project_id:
    print("Missing shared OCI Generative AI project/API key; skipping vector store remote delete.")
    raise SystemExit(0)

client = OpenAI(
    base_url="${self.input.openai_base_url}",
    api_key=api_key,
    project=project_id,
)
client.vector_stores.delete("$vector_store_id")
print("Deleted File Search vector store $vector_store_id")
PY
      rm -f "$generated_file"
    EOT
  }
}

resource "terraform_data" "file_search_seed_documents" {
  depends_on = [terraform_data.file_search_vector_store]

  input = {
    compartment_id              = var.compartment_id
    control_plane_base_url      = local.control_plane_base_url
    display_name                = "${length(local.seed_pdf_files)} bundled Oracle PDFs"
    generated_file              = "${path.module}/.terraform/generated/vector_store_files.json"
    openai_base_url             = local.openai_base_url
    profile                     = var.profile
    seed_pdf_manifest           = jsonencode(local.seed_pdf_manifest)
    shared_api_key_file         = "${path.module}/${var.shared_generated_dir}/api_key.json"
    vector_store_generated_file = "${path.module}/.terraform/generated/vector_store.json"
    shared_project_file         = "${path.module}/${var.shared_generated_dir}/project.json"
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -euo pipefail
      mkdir -p '${path.module}/.terraform/generated'
      python_bin="../../env/bin/python"
      if [ ! -x "$python_bin" ]; then
        python_bin="python3"
      fi
      if [ "$python_bin" = "python3" ]; then
        "$python_bin" -m pip install --user --quiet openai oci_openai
      fi
      "$python_bin" - <<PY
import json
import time
from pathlib import Path
from openai import OpenAI

vector_store_path = Path("${self.input.vector_store_generated_file}")
seed_manifest = json.loads(r'''${self.input.seed_pdf_manifest}''')
if not vector_store_path.exists():
    raise SystemExit("Missing vector store metadata. Apply vector store provisioning first.")

vector_store_id = json.loads(vector_store_path.read_text()).get("id", "")
if not vector_store_id:
    raise SystemExit("Vector store metadata does not contain an id.")
if not seed_manifest:
    raise SystemExit("No bundled seed PDFs found under assets/pdfs.")

api_key = json.loads(Path("${self.input.shared_api_key_file}").read_text()).get("data", {}).get("keys", [{}])[0].get("key", "")
project_id = json.loads(Path("${self.input.shared_project_file}").read_text()).get("data", {}).get("id", "")
if not api_key:
    raise SystemExit("Missing shared OCI Generative AI API key. Apply infra/responses-api first.")
if not project_id:
    raise SystemExit("Missing shared OCI Generative AI project ID. Apply infra/responses-api first.")

client = OpenAI(
    base_url="${self.input.openai_base_url}",
    api_key=api_key,
    project=project_id,
)

records = []
for document in seed_manifest:
    pdf_path = Path(document["path"])
    if not pdf_path.exists():
        raise SystemExit(f"Missing bundled PDF: {pdf_path}")

    print(f"Uploading bundled File Search seed PDF: {document['name']}")
    with pdf_path.open("rb") as handle:
        uploaded_file = client.files.create(file=handle, purpose="assistants")
    file_payload = uploaded_file.model_dump(mode="json") if hasattr(uploaded_file, "model_dump") else json.loads(uploaded_file.model_dump_json())
    file_id = file_payload["id"]

    print(f"Attaching {file_id} to vector store {vector_store_id}")
    vector_store_file = client.vector_stores.files.create(
        vector_store_id,
        file_id=file_id,
        attributes={
            "source": "bundled-oracle-pdf",
            "file_name": document["name"],
            "sha256": document["sha256"],
        },
    )
    vector_store_file_payload = (
        vector_store_file.model_dump(mode="json")
        if hasattr(vector_store_file, "model_dump")
        else json.loads(vector_store_file.model_dump_json())
    )

    terminal = vector_store_file_payload.get("status")
    for _ in range(90):
        if terminal in {"completed", "failed", "cancelled"}:
            break
        time.sleep(5)
        current = client.vector_stores.files.retrieve(file_id, vector_store_id=vector_store_id)
        vector_store_file_payload = (
            current.model_dump(mode="json")
            if hasattr(current, "model_dump")
            else json.loads(current.model_dump_json())
        )
        terminal = vector_store_file_payload.get("status")

    if terminal != "completed":
        raise SystemExit(f"Vector store ingestion failed for {document['name']}: {terminal}")

    records.append({
        "name": document["name"],
        "sha256": document["sha256"],
        "file": file_payload,
        "vector_store_file": vector_store_file_payload,
    })

payload = {
    "vector_store_id": vector_store_id,
    "documents": records,
}
Path("${self.input.generated_file}").write_text(json.dumps(payload, indent=2))
print(json.dumps(payload))
PY
    EOT
  }

  provisioner "local-exec" {
    when    = destroy
    command = <<-EOT
      set -euo pipefail
      generated_file='${self.input.generated_file}'
      if [ ! -f "$generated_file" ]; then
        echo "No generated File Search seed document metadata found; skipping remote delete."
        exit 0
      fi
      python_bin="../../env/bin/python"
      if [ ! -x "$python_bin" ]; then
        python_bin="python3"
      fi
      if [ "$python_bin" = "python3" ]; then
        "$python_bin" -m pip install --user --quiet openai oci_openai
      fi
      "$python_bin" - <<PY
import json
from pathlib import Path
from openai import OpenAI

generated_path = Path("${self.input.generated_file}")
payload = json.loads(generated_path.read_text())
vector_store_id = payload.get("vector_store_id", "")
api_key = json.loads(Path("${self.input.shared_api_key_file}").read_text()).get("data", {}).get("keys", [{}])[0].get("key", "")
project_id = json.loads(Path("${self.input.shared_project_file}").read_text()).get("data", {}).get("id", "")
if not api_key or not project_id:
    print("Missing shared OCI Generative AI project/API key; skipping seed document remote delete.")
    generated_path.unlink(missing_ok=True)
    raise SystemExit(0)

client = OpenAI(
    base_url="${self.input.openai_base_url}",
    api_key=api_key,
    project=project_id,
)

for document in payload.get("documents", []):
    file_id = (document.get("file") or {}).get("id", "")
    if not file_id:
        continue
    if vector_store_id:
        try:
            client.vector_stores.files.delete(file_id, vector_store_id=vector_store_id)
            print(f"Detached File Search seed file {file_id} from {vector_store_id}")
        except Exception as exc:
            print(f"Could not detach File Search seed file {file_id}: {exc}")
    try:
        client.files.delete(file_id)
        print(f"Deleted File Search seed file {file_id}")
    except Exception as exc:
        print(f"Could not delete File Search seed file {file_id}: {exc}")

generated_path.unlink(missing_ok=True)
PY
    EOT
  }
}
