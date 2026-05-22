#!/usr/bin/env python3
import json
import re
import uuid
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
MCP_SERVER = "local-offline-mcp-gateway"


MCP_TOOLS = [
    {
        "name": "knowledge.search",
        "description": "Search a curated enterprise knowledge index.",
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
    {
        "name": "workflow.status",
        "description": "Return status for a workflow or approval request.",
        "inputSchema": {
            "type": "object",
            "properties": {"workflowId": {"type": "string"}},
            "required": ["workflowId"],
        },
    },
]


KNOWLEDGE_INDEX = [
    {
        "title": "Checkout Confirmation Playbook",
        "snippet": "Delayed checkout confirmations should be acknowledged, correlated with payment retries, and escalated for premium accounts.",
    },
    {
        "title": "OCI AI Demo Operations",
        "snippet": "Provisioned demos should emit run logs, include infrastructure status, and avoid proxy dependencies in restricted environments.",
    },
]

WORKFLOWS = {
    "WF-100": {"workflowId": "WF-100", "status": "waiting-on-approval", "owner": "cloud-ops"},
    "WF-204": {"workflowId": "WF-204", "status": "completed", "owner": "support-automation"},
}


def _extract_json_object(text):
    if not text:
        return None
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None


def _fallback_tool_request(prompt):
    workflow_match = re.search(r"\bWF-\d+\b", prompt, flags=re.IGNORECASE)
    if workflow_match or "workflow" in prompt.lower() or "approval" in prompt.lower():
        return {
            "tool": "workflow.status",
            "arguments": {"workflowId": (workflow_match.group(0) if workflow_match else "WF-100").upper()},
            "source": "fallback",
        }
    return {
        "tool": "knowledge.search",
        "arguments": {"query": prompt},
        "source": "fallback",
    }


def _mcp_call(method, params):
    request = {
        "jsonrpc": "2.0",
        "id": f"mcp-{uuid.uuid4().hex[:8]}",
        "method": method,
        "params": params,
    }
    if method == "tools/list":
        return request, {"tools": MCP_TOOLS}

    if method == "tools/call":
        name = params.get("name")
        arguments = params.get("arguments") or {}
        if name == "knowledge.search":
            query_terms = set(str(arguments.get("query", "")).lower().split())
            ranked = []
            for item in KNOWLEDGE_INDEX:
                text = f"{item['title']} {item['snippet']}".lower()
                score = sum(1 for term in query_terms if term in text)
                if score:
                    ranked.append({**item, "score": score})
            return request, {"content": ranked or KNOWLEDGE_INDEX[:1]}

        if name == "workflow.status":
            workflow_id = str(arguments.get("workflowId") or "WF-100").upper()
            return request, {"content": WORKFLOWS.get(workflow_id) or {"workflowId": workflow_id, "status": "not-found"}}

    return request, {"error": f"Unsupported MCP method or tool: {method}"}


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Remote MCP demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    trace = [
        "Discovered tools from local MCP-compatible gateway",
        f"Selected OCI Responses-compatible model {model}",
        f"Prepared OpenAI-compatible OCI endpoint for {config['region']}",
    ]
    result = {
        "feature": "Remote MCP Calling",
        "mode": "remote-mcp-calling",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "mcpServer": MCP_SERVER,
        },
        "trace": trace,
    }

    validate_config(config)
    list_request, list_response = _mcp_call("tools/list", {})
    selection_prompt = (
        "You are selecting a tool from an MCP server. Return only JSON with keys "
        "'tool' and 'arguments'.\n\n"
        f"Available tools: {json.dumps(list_response['tools'], sort_keys=True)}\n"
        f"User request: {prompt}"
    )
    selection_response = call_oci_responses_api(selection_prompt, 0, model, config)
    selection = _extract_json_object(response_output_text(selection_response)) or _fallback_tool_request(prompt)
    call_request, call_response = _mcp_call(
        "tools/call",
        {
            "name": selection.get("tool"),
            "arguments": selection.get("arguments") or {},
        },
    )
    final_prompt = (
        "Answer the user using the MCP tool result. Include the tool name and avoid claiming "
        "access to systems beyond this demo gateway.\n\n"
        f"User request: {prompt}\n"
        f"MCP tool request: {json.dumps(call_request, sort_keys=True)}\n"
        f"MCP tool response: {json.dumps(call_response, sort_keys=True)}"
    )
    final_response = call_oci_responses_api(final_prompt, temperature, model, config)

    result["mcp"] = {
        "server": MCP_SERVER,
        "listRequest": list_request,
        "listResponse": list_response,
        "callRequest": call_request,
        "callResponse": call_response,
    }
    result["output"] = response_output_text(final_response)
    result["rawResponse"] = {
        "toolSelection": response_to_json(selection_response),
        "final": response_to_json(final_response),
    }
    result["trace"] = [
        *trace,
        "Called OCI Responses API to select an MCP tool",
        f"Invoked MCP tool {selection.get('tool')}",
        "Called OCI Responses API with MCP tool result",
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
                    "feature": "Remote MCP Calling",
                    "mode": "remote-mcp-calling",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                        "mcpServer": MCP_SERVER,
                    },
                    "error": str(exc),
                    "trace": [
                        "Loaded local MCP-compatible gateway",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
