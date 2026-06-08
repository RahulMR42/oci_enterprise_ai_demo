#!/usr/bin/env python3
import json
from datetime import datetime, timezone

from common_oci import (
    OCI_RESPONSES_MODEL,
    config_from_env,
    create_client,
    read_payload,
    response_to_json,
    validate_config,
)


DOCS_URL = "https://docs.oracle.com/en-us/iaas/Content/generative-ai/chat-completions-api.htm"


def _message_text(choice):
    message = getattr(choice, "message", None)
    if message is None:
        return ""
    return getattr(message, "content", "") or ""


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the OCI Chat Completions API demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    trace = [
        "Prepared OCI OpenAI-compatible Chat Completions request",
        f"Selected OCI OpenAI-compatible model {model}",
        f"Prepared OpenAI-compatible OCI endpoint for {config['region']}",
    ]
    result = {
        "feature": "OCI OpenAI-Compatible Chat Completions",
        "mode": "openai-compatible-chat",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "path": "/chat/completions",
            "project": config["project"] or "not configured",
        },
        "trace": trace,
    }

    validate_config(config)
    client = create_client(config)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "You are an OCI Generative AI assistant using the OpenAI-compatible Chat Completions API.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=temperature,
    )
    choices = getattr(response, "choices", []) or []
    result["output"] = _message_text(choices[0]) if choices else ""
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [
        *trace,
        "Called OCI Chat Completions API",
        "Received live chat completion from OCI",
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
                    "feature": "OCI OpenAI-Compatible Chat Completions",
                    "mode": "openai-compatible-chat",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "path": "/chat/completions",
                        "project": config["project"] or "not configured",
                    },
                    "error": str(exc),
                    "trace": [
                        "Prepared OCI OpenAI-compatible Chat Completions request",
                        "Live OCI Chat Completions API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
