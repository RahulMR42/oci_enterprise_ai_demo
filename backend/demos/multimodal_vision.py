#!/usr/bin/env python3
import json
from datetime import datetime, timezone

from common_oci import (
    OCI_RESPONSES_MODEL,
    call_oci_responses_api,
    config_from_env,
    read_payload,
    response_output_text,
    response_to_json,
    validate_config,
)


DOCS_URL = "https://docs.oracle.com/en-us/iaas/Content/generative-ai/overview.htm"

ASSET_MANIFEST = {
    "assetId": "vision-demo-incident-screenshot",
    "type": "described-image",
    "description": (
        "A checkout operations dashboard screenshot showing elevated database latency, "
        "a spike in delayed confirmations, and a warning on payment callback retries."
    ),
    "signals": ["database latency", "delayed confirmations", "payment callback retries"],
}


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Multimodal Vision demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    trace = [
        "Prepared multimodal vision asset manifest",
        "Converted visual evidence into structured prompt context",
        f"Selected OCI Responses-compatible model {model}",
    ]
    result = {
        "feature": "Multimodal Vision",
        "mode": "multimodal-vision",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "assetId": ASSET_MANIFEST["assetId"],
        },
        "assetManifest": ASSET_MANIFEST,
        "trace": trace,
    }

    validate_config(config)
    response = call_oci_responses_api(
        (
            "Analyze the described visual asset as if it were approved multimodal context. "
            "Return observed signals, incident triage, and recommended next actions.\n\n"
            f"User request: {prompt}\n"
            f"Visual asset manifest: {json.dumps(ASSET_MANIFEST, sort_keys=True)}"
        ),
        temperature,
        model,
        config,
    )
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [*trace, "Called OCI Responses API with visual context", "Returned structured visual insight"]
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
                    "feature": "Multimodal Vision",
                    "mode": "multimodal-vision",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                        "assetId": ASSET_MANIFEST["assetId"],
                    },
                    "error": str(exc),
                    "trace": [
                        "Prepared multimodal vision asset manifest",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
