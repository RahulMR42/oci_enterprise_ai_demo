#!/usr/bin/env python3
import json
import time
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


ROUTES = [
    {
        "name": "fast-summary",
        "instruction": "Answer in three concise bullets for an operations lead.",
    },
    {
        "name": "risk-review",
        "instruction": "Identify governance, data, and operational risks before answering.",
    },
    {
        "name": "action-plan",
        "instruction": "Return a short action plan with owner-friendly next steps.",
    },
]


def _score_route(route_name, output, duration_ms):
    text = output.lower()
    score = 50
    if route_name == "fast-summary" and duration_ms < 4_000:
        score += 15
    if route_name == "risk-review" and any(term in text for term in ["risk", "policy", "governance"]):
        score += 20
    if route_name == "action-plan" and any(term in text for term in ["step", "owner", "next"]):
        score += 20
    score += min(len(output) // 120, 10)
    return min(score, 100)


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Multi-Model Routing demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    trace = [
        "Loaded routing policy",
        f"Selected OCI Responses-compatible model {model}",
        f"Prepared OpenAI-compatible OCI endpoint for {config['region']}",
    ]
    result = {
        "feature": "Multi-Model Routing",
        "mode": "multi-model-routing",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "routes": [route["name"] for route in ROUTES],
        },
        "trace": trace,
    }

    validate_config(config)
    candidates = []
    raw_responses = {}
    for route in ROUTES:
        routed_prompt = (
            f"Route policy: {route['instruction']}\n\n"
            f"User request: {prompt}"
        )
        started = time.perf_counter()
        response = call_oci_responses_api(routed_prompt, temperature, model, config)
        duration_ms = round((time.perf_counter() - started) * 1000)
        output = response_output_text(response)
        score = _score_route(route["name"], output, duration_ms)
        candidates.append(
            {
                "route": route["name"],
                "model": model,
                "durationMs": duration_ms,
                "score": score,
                "output": output,
            }
        )
        raw_responses[route["name"]] = response_to_json(response)

    selected = sorted(candidates, key=lambda item: (-item["score"], item["durationMs"]))[0]
    result["selectedRoute"] = selected
    result["candidates"] = candidates
    result["output"] = selected["output"]
    result["rawResponse"] = raw_responses
    result["trace"] = [
        *trace,
        f"Evaluated {len(candidates)} route candidate(s)",
        f"Selected route {selected['route']} with score {selected['score']}",
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
                    "feature": "Multi-Model Routing",
                    "mode": "multi-model-routing",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                        "routes": [route["name"] for route in ROUTES],
                    },
                    "error": str(exc),
                    "trace": [
                        "Loaded routing policy",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
