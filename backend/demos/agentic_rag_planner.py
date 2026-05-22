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


def _plan_retrieval(prompt):
    question = prompt.strip()
    return {
        "goal": "Produce a grounded enterprise answer with evidence checks before final response.",
        "steps": [
            {"name": "Clarify intent", "action": "Identify the business question and required evidence."},
            {"name": "Retrieve evidence", "action": "Use File Search / Vector Store for approved enterprise documents."},
            {"name": "Evaluate evidence", "action": "Check whether retrieved snippets support the answer."},
            {"name": "Answer", "action": "Return a concise response and call out missing evidence."},
        ],
        "retrievalQueries": [
            question,
            "policy guidance for delayed checkout confirmations",
            "customer support response requirements",
        ],
        "evidencePolicy": "Answer only from retrieved evidence; state gaps when evidence is insufficient.",
    }


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Agentic RAG Planner demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    plan = _plan_retrieval(prompt)
    trace = [
        "Prepared agentic RAG retrieval plan",
        "Defined evidence evaluation policy",
        f"Selected OCI Responses-compatible model {model}",
    ]
    result = {
        "feature": "Agentic RAG Planner",
        "mode": "agentic-rag-planner",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "plan": plan,
        },
        "ragPlan": plan,
        "trace": trace,
    }

    validate_config(config)
    response = call_oci_responses_api(
        (
            "You are an enterprise RAG planning agent. Create a concise grounded-answer plan. "
            "Include retrieval queries, evidence checks, and final answer policy.\n\n"
            f"User request: {prompt}\n\nPlan: {json.dumps(plan, sort_keys=True)}"
        ),
        temperature,
        model,
        config,
    )
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [
        *trace,
        "Called OCI Responses API for agentic RAG plan",
        "Returned evidence-aware answer plan",
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
                    "feature": "Agentic RAG Planner",
                    "mode": "agentic-rag-planner",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                        "plan": _plan_retrieval(str(payload.get("prompt", "")).strip() or "enterprise question"),
                    },
                    "error": str(exc),
                    "trace": [
                        "Prepared agentic RAG retrieval plan",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
