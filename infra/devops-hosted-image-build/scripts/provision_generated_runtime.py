#!/usr/bin/env python3
import hashlib
import json
import os
import shlex
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from oci_openai import OciOpenAI, OciResourcePrincipalAuth, OciUserPrincipalAuth


TERMINAL_VECTOR_FILE_STATES = {"completed", "failed", "cancelled"}
SKIPPED_STATUSES = {"deleted", "deleting", "expired", "failed"}


def env_value(name, default=""):
    return str(os.environ.get(name, default) or "").strip()


def required_env(name):
    value = env_value(name)
    if not value:
        raise SystemExit(f"{name} is required")
    return value


def dump(value):
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if hasattr(value, "model_dump_json"):
        return json.loads(value.model_dump_json())
    if hasattr(value, "to_dict"):
        return value.to_dict()
    return dict(value)


def oci_cli_base(region):
    profile = env_value("OCI_PROFILE") or env_value("OCI_CLI_PROFILE")
    if profile:
        return ["oci", "--profile", profile, "--region", region]
    return ["oci", "--auth", "resource_principal", "--region", region]


def run_oci(region, args, check=True):
    command = [*oci_cli_base(region), *args]
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    if check and result.returncode != 0:
        sys.stderr.write(result.stdout)
        sys.stderr.write(result.stderr)
        raise SystemExit(f"OCI command failed: {' '.join(shlex.quote(part) for part in command)}")
    return result


def signed_auth():
    profile = env_value("OCI_PROFILE") or env_value("OCI_CLI_PROFILE")
    if profile:
        return OciUserPrincipalAuth(profile_name=profile)
    return OciResourcePrincipalAuth()


def control_client(region, compartment_id):
    return OciOpenAI(
        auth=signed_auth(),
        service_endpoint=f"https://generativeai.{region}.oci.oraclecloud.com/20231130",
        compartment_id=compartment_id,
    )


def inference_client(region, compartment_id, project_id):
    return OciOpenAI(
        auth=signed_auth(),
        service_endpoint=f"https://inference.generativeai.{region}.oci.oraclecloud.com",
        compartment_id=compartment_id,
        project=project_id,
    )


def read_runtime_config(region, namespace, bucket, object_name):
    if not namespace or not bucket or not object_name:
        return {}
    output_file = Path("/tmp/portal-runtime-config-input.json")
    result = run_oci(
        region,
        [
            "os",
            "object",
            "get",
            "--namespace-name",
            namespace,
            "--bucket-name",
            bucket,
            "--name",
            object_name,
            "--file",
            str(output_file),
        ],
        check=False,
    )
    if result.returncode != 0 or not output_file.exists():
        return {}
    try:
        return json.loads(output_file.read_text(encoding="utf-8"))
    except Exception:
        return {}


def write_runtime_config(region, namespace, bucket, object_name, config):
    if not namespace or not bucket or not object_name:
        print("Runtime config Object Storage location is not configured; skipping upload.")
        return
    output_file = Path("/tmp/portal-runtime-config-generated.json")
    output_file.write_text(json.dumps(config, indent=2, sort_keys=True), encoding="utf-8")
    run_oci(
        region,
        [
            "os",
            "object",
            "put",
            "--namespace-name",
            namespace,
            "--bucket-name",
            bucket,
            "--name",
            object_name,
            "--file",
            str(output_file),
            "--content-type",
            "application/json",
            "--force",
        ],
    )


def write_export_env(values, output_path="/tmp/provision-generated-runtime.env"):
    lines = []
    for key, value in values.items():
        lines.append(f"export {key}={shlex.quote(str(value or ''))}")
    Path(output_path).write_text("\n".join(lines) + "\n", encoding="utf-8")


def seed_pdf_manifest():
    root = Path(__file__).resolve().parents[3]
    pdf_dir = root / "infra" / "file-search-vector-store-rag" / "assets" / "pdfs"
    documents = []
    for path in sorted(pdf_dir.glob("*.pdf")):
        documents.append(
            {
                "name": path.name,
                "path": str(path),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
        )
    if not documents:
        raise SystemExit(f"No bundled seed PDFs found under {pdf_dir}")
    return documents


def status_value(payload):
    return str(payload.get("status") or payload.get("state") or payload.get("lifecycle_state") or "").lower()


def payload_id(payload):
    return str(payload.get("id") or payload.get("file_id") or payload.get("file-id") or "").strip()


def retrieve_vector_store(client, vector_store_id):
    if not vector_store_id:
        return None
    try:
        payload = dump(client.vector_stores.retrieve(vector_store_id))
    except Exception:
        return None
    if status_value(payload) in SKIPPED_STATUSES:
        return None
    return payload


def existing_vector_store(client, name, preferred_id=""):
    preferred = retrieve_vector_store(client, preferred_id)
    if preferred:
        return preferred
    try:
        listed = client.vector_stores.list(limit=100)
    except Exception:
        return None
    for item in getattr(listed, "data", []) or []:
        payload = dump(item)
        if status_value(payload) in SKIPPED_STATUSES:
            continue
        if payload.get("name") == name:
            return payload
    return None


def ensure_vector_store(client, compartment_id, resource_suffix, preferred_id=""):
    name = f"enterprise-ai-demo-file-search-{resource_suffix}"
    payload = existing_vector_store(client, name, preferred_id)
    if payload:
        print(f"Reusing File Search vector store {payload.get('id')}")
        return payload

    print(f"Creating File Search vector store {name}")
    vector_store = client.vector_stores.create(
        name=name,
        description="Enterprise AI demo File Search vector store",
        expires_after={"anchor": "last_active_at", "days": 30},
        metadata={
            "compartment_id": compartment_id,
            "managed_by": "oci-devops-build-pipeline",
            "demo": "enterprise-ai-demo-file-search",
            "resource_suffix": resource_suffix,
        },
    )
    return dump(vector_store)


def existing_seed_document(client, vector_store_id, document):
    try:
        listed = client.vector_stores.files.list(vector_store_id=vector_store_id, limit=100)
    except Exception:
        return None
    for item in getattr(listed, "data", []) or []:
        payload = dump(item)
        attributes = payload.get("attributes") or {}
        if status_value(payload) != "completed":
            continue
        if attributes.get("sha256") == document["sha256"] or attributes.get("file_name") == document["name"]:
            return {
                "name": document["name"],
                "sha256": document["sha256"],
                "file": {"id": payload_id(payload), "status": "uploaded"},
                "vector_store_file": payload,
            }
    return None


def ensure_seed_documents(client, vector_store_id):
    records = []
    for document in seed_pdf_manifest():
        existing = existing_seed_document(client, vector_store_id, document)
        if existing:
            print(f"Reusing bundled File Search seed PDF: {document['name']}")
            records.append(existing)
            continue

        print(f"Uploading bundled File Search seed PDF: {document['name']}")
        with Path(document["path"]).open("rb") as handle:
            uploaded_file = client.files.create(file=handle, purpose="assistants")
        file_payload = dump(uploaded_file)
        file_id = payload_id(file_payload)
        if not file_id:
            raise SystemExit(f"File upload for {document['name']} did not return an id")

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
        vector_store_file_payload = dump(vector_store_file)
        terminal = status_value(vector_store_file_payload)
        for _ in range(90):
            if terminal in TERMINAL_VECTOR_FILE_STATES:
                break
            time.sleep(5)
            current = client.vector_stores.files.retrieve(file_id, vector_store_id=vector_store_id)
            vector_store_file_payload = dump(current)
            terminal = status_value(vector_store_file_payload)

        if terminal != "completed":
            raise SystemExit(f"Vector store ingestion failed for {document['name']}: {terminal}")

        records.append(
            {
                "name": document["name"],
                "sha256": document["sha256"],
                "file": file_payload,
                "vector_store_file": vector_store_file_payload,
            }
        )
    return {"vector_store_id": vector_store_id, "documents": records}


def completed_seed_document_count(seed_documents):
    count = 0
    for document in seed_documents.get("documents", []) or []:
        file_payload = document.get("file") or {}
        vector_store_file = document.get("vector_store_file") or {}
        file_status = status_value(file_payload)
        vector_status = status_value(vector_store_file)
        if file_status in {"uploaded", "processed", "completed"} and vector_status == "completed":
            count += 1
    return count


def existing_container(client, name, preferred_id=""):
    if preferred_id:
        try:
            payload = dump(client.containers.retrieve(preferred_id))
            if status_value(payload) not in SKIPPED_STATUSES:
                return payload
        except Exception:
            pass
    try:
        listed = client.containers.list(limit=100)
    except Exception:
        return None
    for item in getattr(listed, "data", []) or []:
        payload = dump(item)
        if status_value(payload) in SKIPPED_STATUSES:
            continue
        if payload.get("name") == name:
            return payload
    return None


def ensure_code_container(client, resource_suffix, preferred_id=""):
    name = f"enterprise-ai-demo-code-interpreter-{resource_suffix}"
    payload = existing_container(client, name, preferred_id)
    if payload:
        print(f"Reusing Code Interpreter container {payload.get('id')}")
        return payload

    print(f"Creating Code Interpreter container {name}")
    container = client.containers.create(name=name, memory_limit=env_value("CODE_INTERPRETER_MEMORY_LIMIT", "1g") or "1g")
    return dump(container)


def ensure_conversation(client, resource_suffix, preferred_id=""):
    if preferred_id:
        try:
            payload = dump(client.conversations.retrieve(preferred_id))
            if payload_id(payload):
                print(f"Reusing OCI conversation {payload.get('id')}")
                return payload
        except Exception:
            pass

    print("Creating OCI conversation store conversation")
    conversation = client.conversations.create(
        metadata={
            "topic": "enterprise-ai-demo-conversation-store",
            "managed_by": "oci-devops-build-pipeline",
            "demo": "conversation-store",
            "resource_suffix": resource_suffix,
        }
    )
    return dump(conversation)


def main():
    region = required_env("OCI_REGION")
    compartment_id = required_env("COMPARTMENT_ID")
    project_id = required_env("OCI_GENAI_PROJECT_ID")
    resource_suffix = required_env("RESOURCE_SUFFIX")
    namespace = env_value("PORTAL_RUNTIME_CONFIG_NAMESPACE")
    bucket = env_value("PORTAL_RUNTIME_CONFIG_BUCKET")
    object_name = env_value("PORTAL_RUNTIME_CONFIG_OBJECT", "portal-runtime-config.json")

    config = read_runtime_config(region, namespace, bucket, object_name)
    client = control_client(region, compartment_id)
    vector_store = ensure_vector_store(client, compartment_id, resource_suffix, env_value("PORTAL_VECTOR_STORE_ID") or str(config.get("vectorStoreId") or ""))
    vector_store_id = payload_id(vector_store)
    if not vector_store_id:
        raise SystemExit("Vector Store create/reuse did not return an id")

    client = inference_client(region, compartment_id, project_id)
    seed_documents = ensure_seed_documents(client, vector_store_id)
    code_container = ensure_code_container(
        client,
        resource_suffix,
        env_value("PORTAL_CODE_INTERPRETER_CONTAINER_ID") or str(config.get("codeInterpreterContainerId") or ""),
    )
    conversation = ensure_conversation(
        client,
        resource_suffix,
        env_value("PORTAL_CONVERSATION_ID") or str(config.get("conversationId") or ""),
    )

    code_container_id = payload_id(code_container)
    conversation_id = payload_id(conversation)
    code_container_status = code_container.get("status") or code_container.get("state") or "created"
    seed_document_count = len(seed_documents.get("documents", []))
    seed_document_completed_count = completed_seed_document_count(seed_documents)
    if not code_container_id:
        raise SystemExit("Code Interpreter container create/reuse did not return an id")
    if not conversation_id:
        raise SystemExit("Conversation create/reuse did not return an id")

    config.update(
        {
            "resourceSuffix": resource_suffix,
            "region": region,
            "projectId": project_id,
            "sourceRevision": env_value("SOURCE_REVISION") or config.get("sourceRevision", ""),
            "devopsHostedImageBuildRunId": env_value("BUILD_RUN_ID") or config.get("devopsHostedImageBuildRunId", ""),
            "conversationId": conversation_id,
            "vectorStoreId": vector_store_id,
            "codeInterpreterContainerId": code_container_id,
            "codeInterpreterContainerStatus": code_container_status,
            "fileSearchVectorStore": vector_store,
            "fileSearchSeedDocuments": seed_documents,
            "fileSearchSeedDocumentCount": seed_document_count,
            "fileSearchSeedDocumentCompletedCount": seed_document_completed_count,
            "generatedRuntimeConfigUpdatedAt": datetime.now(timezone.utc).isoformat(),
            "generatedRuntimeProvisioner": "oci-devops-build-pipeline",
        }
    )
    write_runtime_config(region, namespace, bucket, object_name, config)
    write_export_env(
        {
            "PORTAL_VECTOR_STORE_ID": vector_store_id,
            "PORTAL_CONVERSATION_ID": conversation_id,
            "PORTAL_CODE_INTERPRETER_CONTAINER_ID": code_container_id,
            "PORTAL_CODE_INTERPRETER_CONTAINER_STATUS": code_container_status,
            "PORTAL_FILE_SEARCH_SEED_DOCUMENT_COUNT": seed_document_count,
            "PORTAL_FILE_SEARCH_SEED_DOCUMENT_COMPLETED_COUNT": seed_document_completed_count,
        }
    )

    print(f"PORTAL_VECTOR_STORE_ID={vector_store_id}")
    print(f"PORTAL_CONVERSATION_ID={conversation_id}")
    print(f"PORTAL_CODE_INTERPRETER_CONTAINER_ID={code_container_id}")
    print(f"Seeded File Search documents: {seed_document_completed_count}/{seed_document_count}")


if __name__ == "__main__":
    main()
