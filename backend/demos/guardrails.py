#!/usr/bin/env python3
import json
import re
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


POLICIES = [
    {
        "id": "prompt-injection",
        "label": "Prompt injection",
        "severity": "high",
        "action": "block",
        "patterns": [
            r"ignore (all )?(previous|prior) instructions",
            r"reveal (the )?(system|developer) prompt",
            r"bypass (the )?(policy|guardrails|safety)",
            r"disable (the )?(filter|policy|safety)",
        ],
    },
    {
        "id": "secret-request",
        "label": "Secret exfiltration",
        "severity": "high",
        "action": "block",
        "patterns": [
            r"\b(api key|password|private key|secret token)\b",
            r"\bcredentials?\b.*\b(show|print|dump|export)\b",
        ],
    },
    {
        "id": "pii-email",
        "label": "Email address",
        "severity": "medium",
        "action": "redact",
        "patterns": [r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b"],
        "replacement": "[REDACTED_EMAIL]",
    },
    {
        "id": "pii-phone",
        "label": "Phone number",
        "severity": "medium",
        "action": "redact",
        "patterns": [r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"],
        "replacement": "[REDACTED_PHONE]",
    },
    {
        "id": "pii-ssn",
        "label": "US SSN",
        "severity": "high",
        "action": "redact",
        "patterns": [r"\b\d{3}-\d{2}-\d{4}\b"],
        "replacement": "[REDACTED_SSN]",
    },
]


def _evaluate_policy(text):
    redacted = text
    findings = []
    blocked = False

    for policy in POLICIES:
        matches = []
        for pattern in policy["patterns"]:
            flags = re.IGNORECASE
            found = re.findall(pattern, redacted, flags)
            if found:
                matches.extend(found)
                if policy["action"] == "redact":
                    redacted = re.sub(pattern, policy.get("replacement", "[REDACTED]"), redacted, flags=flags)

        if matches:
            if policy["action"] == "block":
                blocked = True
            findings.append(
                {
                    "policyId": policy["id"],
                    "label": policy["label"],
                    "severity": policy["severity"],
                    "action": policy["action"],
                    "matchCount": len(matches),
                }
            )

    return {
        "decision": "block" if blocked else "allow",
        "findings": findings,
        "redactedPrompt": redacted,
    }


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Guardrails demo.")

    temperature = float(payload.get("temperature", 0.0))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    policy_result = _evaluate_policy(prompt)
    trace = [
        "Evaluated prompt against local enterprise guardrail policies",
        f"Policy decision: {policy_result['decision']}",
    ]
    result = {
        "feature": "Guardrails",
        "mode": "guardrails",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
        },
        "policy": policy_result,
        "trace": trace,
    }

    if policy_result["decision"] == "block":
        result["output"] = "Blocked by guardrails before model invocation."
        result["trace"] = [*trace, "Skipped OCI Responses API call because the prompt was blocked"]
        return result

    validate_config(config)
    guarded_prompt = (
        "Answer the user's request using the sanitized prompt below. "
        "Do not recreate redacted personal data.\n\n"
        f"Sanitized prompt:\n{policy_result['redactedPrompt']}"
    )
    response = call_oci_responses_api(guarded_prompt, temperature, model, config)
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [
        *trace,
        "Called OCI Responses API with sanitized prompt",
        "Returned model response after policy enforcement",
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
                    "feature": "Guardrails",
                    "mode": "guardrails",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": OCI_RESPONSES_MODEL,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                    },
                    "error": str(exc),
                    "trace": [
                        "Loaded Guardrails demo",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
