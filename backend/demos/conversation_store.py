#!/usr/bin/env python3
import json
import os
import uuid
from datetime import datetime, timezone

from common_oci import (
    DOCS_URL,
    OCI_RESPONSES_MODEL,
    config_from_env,
    create_client,
    demo_data_path,
    read_payload,
    response_output_text,
    response_to_json,
    validate_config,
)


STORE_PATH = demo_data_path("conversation_store.json")


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
            "conversationId": "",
            "turns": [],
        }
    return sessions[session_id]


def _conversation_to_json(conversation):
    if hasattr(conversation, "model_dump"):
        return conversation.model_dump(mode="json")
    if hasattr(conversation, "to_dict"):
        return conversation.to_dict()
    return json.loads(conversation.model_dump_json())


def _ensure_conversation(client, session, session_id, payload):
    configured_id = (
        str(payload.get("conversationId", "")).strip()
        or os.getenv("OCI_GENAI_CONVERSATION_ID", "").strip()
        or str(session.get("conversationId", "")).strip()
    )
    if configured_id:
        session["conversationId"] = configured_id
        return configured_id, {"id": configured_id, "source": "configured-or-session"}

    conversation = client.conversations.create(
        metadata={
            "topic": "enterprise-ai-demo-conversation-store",
            "session_id": session_id,
            "managed_by": "portal-runtime",
        }
    )
    payload_json = _conversation_to_json(conversation)
    session["conversationId"] = payload_json.get("id", "")
    if not session["conversationId"]:
        raise RuntimeError("OCI Conversations API did not return a conversation id.")
    return session["conversationId"], payload_json


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
    trace = [
        "Loaded Conversation Store session mapping",
        f"Selected OCI Responses-compatible model {model}",
    ]
    validate_config(config)
    client = create_client(config)
    conversation_id, conversation = _ensure_conversation(client, session, session_id, payload)
    trace = [
        *trace,
        "Resolved OCI Conversations API conversation",
    ]

    result = {
        "feature": "Conversation Store",
        "mode": "conversation-store",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "sessionId": session_id,
            "conversationId": conversation_id,
            "prompt": user_prompt,
            "temperature": temperature,
            "contextTurns": len(session["turns"]),
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
        },
        "conversation": conversation,
        "trace": trace,
    }

    response = client.responses.create(
        model=model,
        input=user_prompt,
        temperature=temperature,
        conversation=conversation_id,
    )
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
        "Called OCI Responses API with OCI-managed conversation state",
        "Persisted local session-to-conversation mapping",
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
                        "conversationId": os.getenv("OCI_GENAI_CONVERSATION_ID", ""),
                    },
                    "error": str(exc),
                    "trace": [
                        "Loaded Conversation Store session mapping",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
