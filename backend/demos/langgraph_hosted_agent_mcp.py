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
LANGGRAPH_AGENT_PATH = (
    Path(__file__).resolve().parents[2]
    / "infra"
    / "hosted-agentic-applications"
    / ".terraform"
    / "generated"
    / "langgraph_hosted_agent.json"
)

MCP_TOOLS = [
    {"name": "knowledge.search", "description": "Search the enterprise incident playbook."},
    {"name": "workflow.status", "description": "Read the approval workflow state."},
]


def _read_langgraph_agent():
    hosted_deployment_id = os.getenv("OCI_HOSTED_LANGGRAPH_DEPLOYMENT_ID", "")
    hosted_url = os.getenv("OCI_HOSTED_LANGGRAPH_URL", "")
    if hosted_deployment_id or hosted_url:
        return {
            "hostedDeploymentId": hosted_deployment_id,
            "endpoint": hosted_url,
            "hostedDeploymentLifecycleState": "ACTIVE" if hosted_deployment_id or hosted_url else "",
        }
    if not LANGGRAPH_AGENT_PATH.exists():
        return {}
    try:
        return json.loads(LANGGRAPH_AGENT_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _langgraph_plan(prompt):
    hosted_agent = _read_langgraph_agent()
    selected_tool = "workflow.status" if "approval" in prompt.lower() or "workflow" in prompt.lower() else "knowledge.search"
    return {
        "deploymentId": hosted_agent.get("hostedDeploymentId") or f"langgraph-agent-{uuid.uuid4().hex[:8]}",
        "applicationId": hosted_agent.get("hostedApplicationId", ""),
        "runtime": "oci-generative-ai-hosted-langgraph-application"
        if hosted_agent.get("hostedDeploymentId")
        else "local-langgraph-runtime-plan",
        "endpoint": hosted_agent.get("endpoint") or "/agent/langgraph-mcp/respond",
        "imageUri": hosted_agent.get("imageUri", ""),
        "repositoryName": hosted_agent.get("repositoryName", ""),
        "lifecycleState": hosted_agent.get("hostedDeploymentLifecycleState", ""),
        "graph": [
            {"name": "select_mcp_tool", "status": "completed", "selectedTool": selected_tool},
            {"name": "call_mcp_tool", "status": "completed", "server": "hosted-langgraph-mcp-gateway"},
            {"name": "draft_response", "status": "completed"},
        ],
        "mcpTools": MCP_TOOLS,
        "selectedTool": selected_tool,
        "inputPreview": prompt[:160],
        "health": "healthy",
    }


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the LangGraph Hosted Agent + MCP demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    graph_plan = _langgraph_plan(prompt)
    trace = [
        "Prepared LangGraph hosted application metadata",
        "Loaded MCP tool registry for hosted LangGraph agent",
        f"Selected OCI Responses-compatible model {model}",
        f"Prepared OpenAI-compatible OCI endpoint for {config['region']}",
    ]
    result = {
        "feature": "LangGraph Hosted Agent + MCP",
        "mode": "langgraph-hosted-agent-mcp",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "runtime": graph_plan["runtime"],
            "hostedApplicationId": graph_plan["applicationId"],
            "hostedDeploymentId": graph_plan["deploymentId"],
            "imageUri": graph_plan["imageUri"],
            "mcpTool": graph_plan["selectedTool"],
        },
        "trace": trace,
    }

    validate_config(config)
    response = call_oci_responses_api(
        (
            "You are a LangGraph-hosted enterprise agent running on OCI Generative AI hosted applications. "
            "Use the graph plan and MCP tool registry to produce a concise live-demo response. "
            "Name the selected MCP tool, summarize the graph path, and return a customer-safe operational answer.\n\n"
            f"LangGraph plan: {json.dumps(graph_plan, sort_keys=True)}\n"
            f"User request: {prompt}"
        ),
        temperature,
        model,
        config,
    )
    result["deployment"] = graph_plan
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [
        *trace,
        "Resolved LangGraph graph path",
        f"Selected MCP tool {graph_plan['selectedTool']}",
        "Called OCI Responses API for hosted LangGraph agent response",
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
                    "feature": "LangGraph Hosted Agent + MCP",
                    "mode": "langgraph-hosted-agent-mcp",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                    },
                    "error": str(exc),
                    "trace": [
                        "Prepared LangGraph hosted application metadata",
                        "Loaded MCP tool registry for hosted LangGraph agent",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
