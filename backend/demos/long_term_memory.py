#!/usr/bin/env python3
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from common_oci import (
    OCI_RESPONSES_MODEL,
    call_oci_responses_api,
    config_from_env,
    read_payload,
    response_output_text,
    response_to_json,
    validate_config,
)


DOCS_URL = "https://docs.oracle.com/en-us/iaas/Content/generative-ai/building-agents.htm"
STORE_PATH = Path(__file__).resolve().parents[1] / "data" / "long_term_memory_store.json"


def _read_store():
    if not STORE_PATH.exists():
        return {"subjects": {}}
    try:
        return json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"subjects": {}}


def _write_store(store):
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")


def _subject(store, subject_id):
    now = datetime.now(timezone.utc).isoformat()
    subjects = store.setdefault("subjects", {})
    if subject_id not in subjects:
        subjects[subject_id] = {
            "id": subject_id,
            "createdAt": now,
            "updatedAt": now,
            "memories": [],
        }
    return subjects[subject_id]


def _extract_json_array(text):
    if not text:
        return []
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end <= start:
        return []
    try:
        parsed = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def _fallback_memories(prompt):
    lowered = prompt.lower()
    if "prefer" in lowered or "prefers" in lowered:
        return [{"kind": "preference", "value": prompt[:180], "confidence": "medium"}]
    if "remember" in lowered:
        return [{"kind": "profile", "value": prompt[:180], "confidence": "medium"}]
    return []


def _merge_memories(subject, new_memories):
    now = datetime.now(timezone.utc).isoformat()
    existing_values = {memory.get("value") for memory in subject["memories"]}
    inserted = []
    for memory in new_memories:
        value = str(memory.get("value", "")).strip()
        if not value or value in existing_values:
            continue
        entry = {
            "id": f"mem-{uuid.uuid4().hex[:8]}",
            "kind": str(memory.get("kind") or "note"),
            "value": value,
            "confidence": str(memory.get("confidence") or "medium"),
            "createdAt": now,
        }
        subject["memories"].append(entry)
        inserted.append(entry)
        existing_values.add(value)
    subject["updatedAt"] = now
    return inserted


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Long-Term Memory demo.")

    subject_id = str(payload.get("sessionId", "")).strip() or "customer-acme-42"
    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    store = _read_store()
    subject = _subject(store, subject_id)
    trace = [
        "Loaded durable subject-scoped memory store",
        f"Retrieved {len(subject['memories'])} existing memory item(s)",
        f"Selected OCI Responses-compatible model {model}",
    ]
    result = {
        "feature": "Long-Term Memory",
        "mode": "long-term-memory",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "subjectId": subject_id,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
        },
        "trace": trace,
    }

    validate_config(config)
    if "forget" in prompt.lower() and "memory" in prompt.lower():
        subject["memories"] = []
        subject["updatedAt"] = datetime.now(timezone.utc).isoformat()

    extraction_prompt = (
        "Extract durable support memories from the user message. Return only a JSON array. "
        "Each item must have kind, value, and confidence. Store only stable preferences, "
        "account facts, or support context. Return [] when nothing should be stored.\n\n"
        f"Existing memories: {json.dumps(subject['memories'], sort_keys=True)}\n"
        f"User message: {prompt}"
    )
    extraction_response = call_oci_responses_api(extraction_prompt, 0, model, config)
    extracted = _extract_json_array(response_output_text(extraction_response)) or _fallback_memories(prompt)
    inserted = _merge_memories(subject, extracted)
    _write_store(store)
    answer_prompt = (
        "Answer the user using these durable memories when relevant. Do not expose internal memory IDs.\n\n"
        f"User message: {prompt}\n"
        f"Retrieved memories: {json.dumps(subject['memories'], sort_keys=True)}"
    )
    answer_response = call_oci_responses_api(answer_prompt, temperature, model, config)

    result["memory"] = {
        "subject": subject,
        "inserted": inserted,
        "storePath": str(STORE_PATH),
    }
    result["output"] = response_output_text(answer_response)
    result["rawResponse"] = {
        "extraction": response_to_json(extraction_response),
        "answer": response_to_json(answer_response),
    }
    result["trace"] = [
        *trace,
        "Called OCI Responses API to extract durable memories",
        f"Persisted {len(inserted)} new memory item(s)",
        "Called OCI Responses API with retrieved memory context",
    ]
    return result


def main():
    payload = read_payload()
    try:
        print(json.dumps(run_demo(payload)))
        return 0
    except Exception as exc:
        config = config_from_env()
        model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
        print(
            json.dumps(
                {
                    "feature": "Long-Term Memory",
                    "mode": "long-term-memory",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                    },
                    "error": str(exc),
                    "trace": [
                        "Loaded durable subject-scoped memory store",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
