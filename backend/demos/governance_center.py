#!/usr/bin/env python3
import json
import re
import uuid
from datetime import datetime, timezone

from common_oci import (
    OCI_RESPONSES_MODEL,
    call_oci_responses_api,
    config_from_env,
    demo_data_path,
    read_payload,
    read_json_store,
    response_output_text,
    response_to_json,
    validate_config,
    write_json_store,
)


DOCS_URL = "https://docs.oracle.com/en-us/iaas/Content/generative-ai/overview.htm"
AUDIT_PATH = demo_data_path("governance_audit_log.json")


POLICIES = [
    {"id": "pii-redaction", "description": "Detect and redact direct contact information."},
    {"id": "tool-allowlist", "description": "Allow only approved local demo tools."},
    {"id": "production-review", "description": "Flag production-impacting requests for review."},
]


def _load_audit():
    return read_json_store(AUDIT_PATH, {"events": []})


def _write_audit(audit):
    return write_json_store(AUDIT_PATH, audit)


def _evaluate(prompt):
    findings = []
    sanitized = prompt
    if re.search(r"[\w.+-]+@[\w.-]+\.\w+", prompt):
        findings.append({"policy": "pii-redaction", "severity": "medium", "decision": "redact"})
        sanitized = re.sub(r"[\w.+-]+@[\w.-]+\.\w+", "[redacted-email]", sanitized)
    if re.search(r"\b\d{3}[-.]\d{3}[-.]\d{4}\b", prompt):
        findings.append({"policy": "pii-redaction", "severity": "medium", "decision": "redact"})
        sanitized = re.sub(r"\b\d{3}[-.]\d{3}[-.]\d{4}\b", "[redacted-phone]", sanitized)
    if any(term in prompt.lower() for term in ["delete production", "drop database", "disable audit"]):
        findings.append({"policy": "production-review", "severity": "high", "decision": "block"})
    if "call external tool" in prompt.lower():
        findings.append({"policy": "tool-allowlist", "severity": "medium", "decision": "review"})

    decision = "blocked" if any(item["decision"] == "block" for item in findings) else "allowed"
    return {
        "decision": decision,
        "findings": findings or [{"policy": "baseline", "severity": "low", "decision": "allow"}],
        "sanitizedPrompt": sanitized,
    }


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Governance Center demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    evaluation = _evaluate(prompt)
    trace = [
        "Loaded governance policy pack",
        f"Evaluated {len(POLICIES)} governance policy control(s)",
        f"Selected OCI Responses-compatible model {model}",
    ]
    result = {
        "feature": "Governance Center",
        "mode": "governance-center",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "policies": [policy["id"] for policy in POLICIES],
        },
        "governance": evaluation,
        "trace": trace,
    }

    audit = _load_audit()
    audit_event = {
        "id": f"audit-{uuid.uuid4().hex[:8]}",
        "at": datetime.now(timezone.utc).isoformat(),
        "decision": evaluation["decision"],
        "findings": evaluation["findings"],
    }
    audit.setdefault("events", []).append(audit_event)
    _write_audit(audit)

    if evaluation["decision"] == "blocked":
        result["output"] = "Request blocked by governance policy. Review the findings before continuing."
        result["auditEvent"] = audit_event
        result["trace"] = [*trace, "Persisted governance audit event", "Blocked request before model invocation"]
        return result

    validate_config(config)
    response = call_oci_responses_api(
        (
            "Summarize the governance decision for an enterprise AI reviewer. "
            "Include allowed/blocked status, findings, and recommended next action.\n\n"
            f"Evaluation: {json.dumps(evaluation, sort_keys=True)}"
        ),
        temperature,
        model,
        config,
    )
    result["auditEvent"] = audit_event
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [
        *trace,
        "Persisted governance audit event",
        "Called OCI Responses API for reviewer summary",
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
                    "feature": "Governance Center",
                    "mode": "governance-center",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                        "policies": [policy["id"] for policy in POLICIES],
                    },
                    "error": str(exc),
                    "trace": [
                        "Loaded governance policy pack",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
