#!/usr/bin/env python3
import json
from datetime import datetime, timezone

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


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    trace = [
        "Validated request for OCI Responses API",
        f"Selected OCI Responses-compatible model {model}",
        f"Prepared OpenAI-compatible OCI endpoint for {config['region']}",
    ]

    if not prompt:
        raise RuntimeError("Prompt is required for the live OCI Responses API call.")

    result = {
        "feature": "OCI Responses API",
        "mode": "oci-responses-api",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "stream": False,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
        },
        "trace": trace,
    }

    validate_config(config)
    response = call_oci_responses_api(prompt, temperature, model, config)
    response_json = response_to_json(response)
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_json
    result["trace"] = [
        *trace,
        "Called OCI Responses API",
        "Received live model response from OCI",
    ]
    return result


def main():
    try:
        payload = read_payload()
        print(json.dumps(run_demo(payload)))
        return 0
    except Exception as exc:
        config = config_from_env()
        error_payload = {
            "feature": "OCI Responses API",
            "mode": "oci-responses-api",
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "documentation": DOCS_URL,
            "request": {
                "model": OCI_RESPONSES_MODEL,
                "baseUrl": config["base_url"],
                "project": config["project"] or "not configured",
            },
            "error": str(exc),
            "trace": [
                "Validated request for OCI Responses API",
                f"Selected OCI Responses-compatible model {OCI_RESPONSES_MODEL}",
                "Live OCI Responses API call was not completed",
            ],
        }
        print(json.dumps(error_payload))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
