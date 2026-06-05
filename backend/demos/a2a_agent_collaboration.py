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


DOCS_URL = "https://google-a2a.github.io/A2A/specification/"
GENERATED_DIR = Path(__file__).resolve().parents[2] / "infra" / "hosted-agentic-applications" / ".terraform" / "generated"
HOSTED_AGENT_PATH = GENERATED_DIR / "hosted_agent.json"
LANGGRAPH_AGENT_PATH = GENERATED_DIR / "langgraph_hosted_agent.json"


def _read_json(path):
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _agent_card(name, description, runtime, path, skills):
    metadata = _read_json(path)
    env_prefix = "OCI_HOSTED_LANGGRAPH" if "LangGraph" in name else "OCI_HOSTED_AGENT"
    hosted_deployment_id = os.getenv(f"{env_prefix}_DEPLOYMENT_ID", "") or metadata.get("hostedDeploymentId", "")
    hosted_url = os.getenv(f"{env_prefix}_URL", "") or metadata.get("endpoint")
    return {
        "name": name,
        "description": description,
        "url": hosted_url or "/a2a/tasks",
        "version": "1.0.0",
        "runtime": runtime,
        "hostedApplicationId": metadata.get("hostedApplicationId", ""),
        "hostedDeploymentId": hosted_deployment_id,
        "lifecycleState": metadata.get("hostedDeploymentLifecycleState", "") or ("ACTIVE" if hosted_deployment_id else ""),
        "capabilities": {"streaming": False, "pushNotifications": False},
        "skills": skills,
    }


def _discover_agents():
    return [
        _agent_card(
            "Incident Response Agent",
            "Classifies checkout incidents and drafts customer-safe operational actions.",
            "oci-generative-ai-hosted-application",
            HOSTED_AGENT_PATH,
            [{"id": "incident-response", "name": "Incident response", "tags": ["incident", "support"]}],
        ),
        _agent_card(
            "LangGraph MCP Agent",
            "Selects an approved MCP-style tool and returns workflow or knowledge context.",
            "oci-generative-ai-hosted-langgraph-application",
            LANGGRAPH_AGENT_PATH,
            [{"id": "mcp-tool-selection", "name": "MCP tool selection", "tags": ["langgraph", "mcp"]}],
        ),
    ]


def _create_task(prompt, agent):
    task_id = f"a2a-{uuid.uuid4().hex[:10]}"
    return {
        "id": task_id,
        "kind": "task",
        "status": "completed",
        "agent": agent["name"],
        "message": {"role": "user", "parts": [{"kind": "text", "text": prompt}]},
        "artifacts": [
            {
                "name": f"{agent['name'].lower().replace(' ', '-')}-result",
                "parts": [
                    {
                        "kind": "text",
                        "text": (
                            "Incident severity and customer communication actions prepared."
                            if "Incident" in agent["name"]
                            else "Approved MCP knowledge/workflow context selected for the coordinator."
                        ),
                    }
                ],
            }
        ],
    }


def _collaboration_plan(prompt):
    agents = _discover_agents()
    tasks = [_create_task(prompt, agent) for agent in agents]
    return {
        "protocol": "Agent2Agent",
        "transport": "HTTP JSON task exchange",
        "coordinator": "portal-a2a-client",
        "agentCards": agents,
        "tasks": tasks,
        "handoff": [
            {"from": "portal-a2a-client", "to": agents[0]["name"], "taskId": tasks[0]["id"]},
            {"from": agents[0]["name"], "to": agents[1]["name"], "taskId": tasks[1]["id"]},
            {"from": agents[1]["name"], "to": "portal-a2a-client", "taskId": tasks[1]["id"]},
        ],
    }


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Agent2Agent Collaboration demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    plan = _collaboration_plan(prompt)
    trace = [
        "Discovered A2A agent cards",
        "Created A2A tasks for hosted agents",
        "Prepared agent-to-agent handoff plan",
        f"Selected OCI Responses-compatible model {model}",
        f"Prepared OpenAI-compatible OCI endpoint for {config['region']}",
    ]
    result = {
        "feature": "Agent2Agent Collaboration",
        "mode": "a2a-agent-collaboration",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "protocol": plan["protocol"],
            "agents": [agent["name"] for agent in plan["agentCards"]],
        },
        "a2a": plan,
        "trace": trace,
    }

    validate_config(config)
    response = call_oci_responses_api(
        (
            "You are an enterprise A2A coordinator running on OCI. Summarize this Agent2Agent "
            "collaboration plan for a live demo. Name the agents, describe the handoff, and return "
            "a customer-safe operational answer.\n\n"
            f"A2A plan: {json.dumps(plan, sort_keys=True)}\n"
            f"User request: {prompt}"
        ),
        temperature,
        model,
        config,
    )
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [*trace, "Called OCI Responses API to summarize A2A collaboration"]
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
                    "feature": "Agent2Agent Collaboration",
                    "mode": "a2a-agent-collaboration",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                    },
                    "a2a": _collaboration_plan(str(payload.get("prompt", "")).strip()),
                    "error": str(exc),
                    "trace": [
                        "Discovered A2A agent cards",
                        "Created A2A tasks for hosted agents",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
