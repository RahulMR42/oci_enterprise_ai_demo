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


DOCS_URL = "https://docs.oracle.com/en-us/iaas/Content/generative-ai/building-agents.htm"


def _approval_plan(prompt):
    risk_terms = ["refund", "credit", "production", "customer impact", "delete", "external"]
    risk = "high" if any(term in prompt.lower() for term in risk_terms) else "medium"
    return {
        "risk": risk,
        "proposedAction": "Draft a customer-safe response and prepare the next operational step.",
        "approvalRequired": risk in {"medium", "high"},
        "approvalReason": "Enterprise agent actions that affect customers or operations require a human approval checkpoint.",
        "approvedTools": ["ticket_update", "knowledge_lookup", "customer_message_draft"],
    }


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Human Approval Agent demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    approval = _approval_plan(prompt)
    trace = [
        "Classified agent action risk",
        "Prepared human approval checkpoint",
        f"Selected OCI Responses-compatible model {model}",
    ]
    result = {
        "feature": "Human-in-the-Loop Agent Approval",
        "mode": "human-approval-agent",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "approval": approval,
        },
        "approval": approval,
        "trace": trace,
    }

    validate_config(config)
    response = call_oci_responses_api(
        (
            "You are an enterprise agent preparing a human approval checkpoint. "
            "Summarize the proposed action, risk, approval reason, and safe next step.\n\n"
            f"User request: {prompt}\n\nApproval plan: {json.dumps(approval, sort_keys=True)}"
        ),
        temperature,
        model,
        config,
    )
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [
        *trace,
        "Called OCI Responses API for approval-ready agent response",
        "Returned governed action proposal",
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
                    "feature": "Human-in-the-Loop Agent Approval",
                    "mode": "human-approval-agent",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                        "approval": _approval_plan(str(payload.get("prompt", "")).strip()),
                    },
                    "error": str(exc),
                    "trace": [
                        "Classified agent action risk",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
