#!/usr/bin/env python3
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from common_oci import (
    DOCS_URL,
    OCI_RESPONSES_MODEL,
    call_oci_responses_api,
    config_from_env,
    read_payload,
    response_output_text,
    response_to_json,
    validate_config,
)


STORE_PATH = Path(__file__).resolve().parents[1] / "data" / "conversation_store.json"
MAX_CONTEXT_TURNS = 8


def _read_store():
    if not STORE_PATH.exists():
        return {"sessions": {}}

    try:
        return json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"sessions": {}}


def _write_store(store):
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(json.dumps(store, indent=2), encoding="utf-8")


def _session(store, session_id):
    sessions = store.setdefault("sessions", {})
    if session_id not in sessions:
        now = datetime.now(timezone.utc).isoformat()
        sessions[session_id] = {
            "id": session_id,
            "title": "Conversation Store Demo",
            "createdAt": now,
            "updatedAt": now,
            "turns": [],
        }
    return sessions[session_id]


def _context_prompt(session, user_prompt):
    recent_turns = session["turns"][-MAX_CONTEXT_TURNS:]
    context_lines = []
    for turn in recent_turns:
        context_lines.append(f"User: {turn['user']}")
        context_lines.append(f"Assistant: {turn['assistant']}")

    context = "\n".join(context_lines) if context_lines else "No previous turns."
    return (
        "You are continuing a stored enterprise assistant conversation. "
        "Use the prior turns only as context and answer the newest user request.\n\n"
        f"Conversation context:\n{context}\n\nNewest user request:\n{user_prompt}"
    )


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    user_prompt = str(payload.get("prompt", "")).strip()
    if not user_prompt:
        raise RuntimeError("Prompt is required for the Conversation Store demo.")

    session_id = str(payload.get("sessionId", "")).strip() or f"session-{uuid.uuid4().hex[:8]}"
    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    store = _read_store()
    session = _session(store, session_id)
    response_prompt = _context_prompt(session, user_prompt)
    trace = [
        "Loaded persisted conversation session",
        f"Prepared {len(session['turns'])} prior turn(s) as model context",
        f"Selected OCI Responses-compatible model {model}",
    ]

    result = {
        "feature": "Conversation Store",
        "mode": "conversation-store",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "sessionId": session_id,
            "prompt": user_prompt,
            "temperature": temperature,
            "contextTurns": len(session["turns"]),
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
        },
        "trace": trace,
    }

    validate_config(config)
    response = call_oci_responses_api(response_prompt, temperature, model, config)
    output = response_output_text(response)
    now = datetime.now(timezone.utc).isoformat()
    session["turns"].append(
        {
            "at": now,
            "user": user_prompt,
            "assistant": output,
            "model": model,
        }
    )
    session["updatedAt"] = now
    _write_store(store)

    result["output"] = output
    result["session"] = session
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [
        *trace,
        "Called OCI Responses API with stored context",
        "Persisted the new user and assistant turn",
    ]
    return result


def main():
    try:
        payload = read_payload()
        print(json.dumps(run_demo(payload)))
        return 0
    except Exception as exc:
        config = config_from_env()
        print(
            json.dumps(
                {
                    "feature": "Conversation Store",
                    "mode": "conversation-store",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": OCI_RESPONSES_MODEL,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                    },
                    "error": str(exc),
                    "trace": [
                        "Loaded Conversation Store demo",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
