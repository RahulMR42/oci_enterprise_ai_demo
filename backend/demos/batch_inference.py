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

SAMPLE_RECORDS = [
    {"id": "ticket-1001", "text": "Checkout confirmation delayed for premium customer."},
    {"id": "ticket-1002", "text": "Customer asks whether payment was captured after timeout."},
    {"id": "ticket-1003", "text": "Support needs a concise escalation summary for operations."},
]


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Batch Inference demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    job_manifest = {
        "jobId": "batch-demo-local",
        "records": SAMPLE_RECORDS,
        "outputTarget": "portal-run-output",
        "reviewMode": "human-review-required",
    }
    trace = [
        "Prepared batch inference job manifest",
        f"Queued {len(SAMPLE_RECORDS)} sample record(s)",
        f"Selected OCI Responses-compatible model {model}",
    ]
    result = {
        "feature": "Batch Inference",
        "mode": "batch-inference",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "recordCount": len(SAMPLE_RECORDS),
        },
        "jobManifest": job_manifest,
        "trace": trace,
    }

    validate_config(config)
    response = call_oci_responses_api(
        (
            "Act as a batch inference worker. Summarize each record and provide a compact batch-level "
            "operations summary.\n\n"
            f"Batch instruction: {prompt}\n"
            f"Records: {json.dumps(SAMPLE_RECORDS, sort_keys=True)}"
        ),
        temperature,
        model,
        config,
    )
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [*trace, "Called OCI Responses API for batch processing", "Collected batch output for review"]
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
                    "feature": "Batch Inference",
                    "mode": "batch-inference",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                        "recordCount": len(SAMPLE_RECORDS),
                    },
                    "error": str(exc),
                    "trace": [
                        "Prepared batch inference job manifest",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
