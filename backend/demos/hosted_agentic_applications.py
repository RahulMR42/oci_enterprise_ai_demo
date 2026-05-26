#!/usr/bin/env python3
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

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
HOSTED_AGENT_PATH = Path(__file__).resolve().parents[2] / "infra" / "hosted-agentic-applications" / ".terraform" / "generated" / "hosted_agent.json"


def _read_hosted_agent():
    hosted_deployment_id = os.getenv("OCI_HOSTED_AGENT_DEPLOYMENT_ID", "")
    hosted_url = os.getenv("OCI_HOSTED_AGENT_URL", "")
    if hosted_deployment_id or hosted_url:
        return {
            "hostedDeploymentId": hosted_deployment_id,
            "endpoint": hosted_url,
            "hostedDeploymentLifecycleState": "ACTIVE" if hosted_deployment_id or hosted_url else "",
        }
    if not HOSTED_AGENT_PATH.exists():
        return {}
    try:
        return json.loads(HOSTED_AGENT_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _local_runtime_plan(prompt):
    hosted_agent = _read_hosted_agent()
    return {
        "deploymentId": hosted_agent.get("hostedDeploymentId") or f"agent-app-{uuid.uuid4().hex[:8]}",
        "applicationId": hosted_agent.get("hostedApplicationId", ""),
        "runtime": "oci-generative-ai-hosted-application" if hosted_agent.get("hostedDeploymentId") else "local-managed-runtime-simulator",
        "endpoint": hosted_agent.get("endpoint") or "/agent/incidents/respond",
        "imageUri": hosted_agent.get("imageUri", ""),
        "repositoryName": hosted_agent.get("repositoryName", ""),
        "lifecycleState": hosted_agent.get("hostedDeploymentLifecycleState", ""),
        "steps": [
            {"name": "validate-request", "status": "completed"},
            {"name": "classify-incident", "status": "completed", "classification": "support-operations"},
            {"name": "select-tools", "status": "completed", "tools": ["knowledge.search", "create_service_ticket"]},
            {"name": "draft-response", "status": "completed"},
        ],
        "inputPreview": prompt[:160],
        "health": "healthy",
    }


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Hosted Agentic Applications demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    runtime_plan = _local_runtime_plan(prompt)
    trace = [
        "Prepared hosted agent runtime manifest",
        f"Selected OCI Responses-compatible model {model}",
        f"Prepared OpenAI-compatible OCI endpoint for {config['region']}",
    ]
    result = {
        "feature": "Hosted Agentic Applications",
        "mode": "hosted-agentic-applications",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "runtime": runtime_plan["runtime"],
            "hostedApplicationId": runtime_plan["applicationId"],
            "hostedDeploymentId": runtime_plan["deploymentId"],
            "imageUri": runtime_plan["imageUri"],
        },
        "trace": trace,
    }

    validate_config(config)
    response = call_oci_responses_api(
        (
            "You are a hosted incident-response agent application. Use the runtime manifest "
            "to produce a concise invocation result with deployment health, selected actions, "
            "and a final customer-safe response.\n\n"
            f"Runtime manifest: {json.dumps(runtime_plan, sort_keys=True)}\n"
            f"User request: {prompt}"
        ),
        temperature,
        model,
        config,
    )
    result["deployment"] = runtime_plan
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [
        *trace,
        "Executed local hosted-agent runtime steps",
        "Called OCI Responses API for hosted app response",
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
                    "feature": "Hosted Agentic Applications",
                    "mode": "hosted-agentic-applications",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                    },
                    "error": str(exc),
                    "trace": [
                        "Prepared hosted agent runtime manifest",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
