#!/usr/bin/env python3
import importlib.metadata
import inspect
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


DOCS_URL = "https://locusagents.oracle.com/"


def _tool_name(tool_obj):
    return getattr(tool_obj, "name", getattr(tool_obj, "__name__", type(tool_obj).__name__))


def _workflow_map(prompt, session_id):
    return {
        "sdk": "locus-sdk",
        "goal": "Design a production multi-agent workflow with resumable execution and governed tools.",
        "sessionId": session_id,
        "agentLoop": {
            "agent": "IncidentAgent",
            "modelProvider": "OCI Responses API",
            "prompt": prompt,
            "termination": "Stop after evidence, action proposal, and approval posture are produced.",
        },
        "tools": [
            {
                "name": "lookup_order_status",
                "kind": "idempotent function tool",
                "purpose": "Retrieve order, customer tier, and current delay reason.",
            },
            {
                "name": "search_support_policy",
                "kind": "MCP-ready retrieval tool",
                "purpose": "Find approved policy guidance before drafting customer updates.",
            },
            {
                "name": "create_support_ticket",
                "kind": "guarded write tool",
                "purpose": "Create or update an operational ticket only after risk checks.",
            },
        ],
        "memory": {
            "conversation": "Keep short-term turn context in the agent state.",
            "longTerm": "Store stable customer preferences and account facts in a scoped memory manager.",
            "checkpoint": "Persist workflow state so the run can pause for a human and resume later.",
        },
        "composition": [
            "Start with an orchestrator pattern for deterministic triage.",
            "Add handoff or swarm only when specialist agents own separate tool domains.",
            "Stream events for operator visibility and audit capture.",
        ],
        "productionControls": [
            "Use typed tool inputs and idempotency keys for side effects.",
            "Gate customer-impacting actions with human approval.",
            "Record trace, token usage, selected tools, memory reads, and checkpoint IDs.",
        ],
    }


def _build_locus_sdk_contract(prompt, session_id):
    try:
        from locus.agent import Agent
        from locus.tools import tool
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Missing Python dependency 'locus-sdk'. Install root requirements before running the "
            "Locus SDK Agentic Workflows live demo."
        ) from exc

    @tool
    def lookup_order_status(order_id: str) -> dict:
        """Return support-visible order status for incident triage."""

        return {
            "orderId": order_id,
            "status": "delayed",
            "delayReason": "payment callback queue latency",
            "customerTier": "premium",
        }

    @tool
    def create_support_ticket(summary: str, risk: str) -> dict:
        """Create a guarded support ticket proposal."""

        return {
            "ticketId": "TICKET-PENDING-APPROVAL",
            "summary": summary,
            "risk": risk,
            "requiresApproval": risk.lower() in {"high", "customer-impacting"},
        }

    tools = [lookup_order_status, create_support_ticket]
    try:
        sdk_version = importlib.metadata.version("locus-sdk")
    except importlib.metadata.PackageNotFoundError:
        sdk_version = "installed"

    return {
        "sdk": "locus-sdk",
        "sdkVersion": sdk_version,
        "agentClass": Agent.__name__,
        "agentSignature": str(inspect.signature(Agent))[:180],
        "toolDecorator": "locus.tools.tool",
        "toolNames": [_tool_name(item) for item in tools],
        "sessionId": session_id,
        "promptPreview": prompt[:160],
        "agentContract": {
            "modelProvider": "OCI Generative AI Responses API",
            "systemPrompt": "Use approved tools, preserve checkpoint state, stream progress, and gate risky writes.",
            "maxIterations": 4,
        },
    }


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Locus SDK Agentic Workflows demo.")

    session_id = str(payload.get("sessionId", "")).strip() or "locus-incident-agent-001"
    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    workflow = _workflow_map(prompt, session_id)
    trace = [
        "Prepared Locus SDK agentic workflow map",
        "Mapped agent loop, tools, memory, checkpoints, and streaming events",
        f"Selected OCI Responses-compatible model {model}",
    ]
    result = {
        "feature": "Locus SDK Agentic Workflows",
        "mode": "locus-sdk-agentic-workflows",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "sessionId": session_id,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "workflow": workflow,
        },
        "locusWorkflow": workflow,
        "trace": trace,
    }

    validate_config(config)
    sdk_contract = _build_locus_sdk_contract(prompt, session_id)
    workflow["sdkRuntime"] = sdk_contract
    response = call_oci_responses_api(
        (
            "You are explaining how to implement a production agent with Oracle's Locus SDK. "
            "Use the provided workflow map and SDK contract generated from locus.agent.Agent and "
            "locus.tools.tool. Return a concise implementation plan covering agent loop, tools, "
            "memory, checkpoints, streaming, and governance.\n\n"
            f"Workflow map: {json.dumps(workflow, sort_keys=True)}"
        ),
        temperature,
        model,
        config,
    )
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [
        *trace,
        "Loaded Locus SDK Agent and tool contract",
        "Called OCI Responses API for Locus SDK implementation guidance",
        "Returned production agent workflow design",
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
                    "feature": "Locus SDK Agentic Workflows",
                    "mode": "locus-sdk-agentic-workflows",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                        "workflow": _workflow_map(
                            str(payload.get("prompt", "")).strip() or "production agent workflow",
                            str(payload.get("sessionId", "")).strip() or "locus-incident-agent-001",
                        ),
                    },
                    "error": str(exc),
                    "trace": [
                        "Prepared Locus SDK agentic workflow map",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
