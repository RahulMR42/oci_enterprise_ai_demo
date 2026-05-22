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

WORKFLOW_STEPS = [
    {"id": "classify", "owner": "ai-runtime", "action": "Classify incident severity and customer impact."},
    {"id": "tool-lookup", "owner": "operations-tool", "action": "Retrieve current order and service status."},
    {"id": "approval", "owner": "support-manager", "action": "Approve external customer messaging."},
    {"id": "ticket-update", "owner": "workflow-engine", "action": "Write audited ticket update."},
]


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the AI Workflow Orchestration demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    trace = [
        "Loaded AI workflow orchestration plan",
        f"Prepared {len(WORKFLOW_STEPS)} workflow step(s)",
        f"Selected OCI Responses-compatible model {model}",
    ]
    result = {
        "feature": "AI Workflow Orchestration",
        "mode": "ai-workflow-orchestration",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "workflowSteps": [step["id"] for step in WORKFLOW_STEPS],
        },
        "workflow": WORKFLOW_STEPS,
        "trace": trace,
    }

    validate_config(config)
    response = call_oci_responses_api(
        (
            "Act as an enterprise AI workflow orchestrator. Given the workflow plan, produce the next "
            "state, approval checkpoint, and audited ticket update draft.\n\n"
            f"User request: {prompt}\n"
            f"Workflow steps: {json.dumps(WORKFLOW_STEPS, sort_keys=True)}"
        ),
        temperature,
        model,
        config,
    )
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [*trace, "Called OCI Responses API for workflow plan", "Produced audited workflow outcome"]
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
                    "feature": "AI Workflow Orchestration",
                    "mode": "ai-workflow-orchestration",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                        "workflowSteps": [step["id"] for step in WORKFLOW_STEPS],
                    },
                    "error": str(exc),
                    "trace": [
                        "Loaded AI workflow orchestration plan",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
