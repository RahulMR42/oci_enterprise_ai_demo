#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import TypedDict

from langgraph.graph import END, StateGraph


class AgentState(TypedDict, total=False):
    prompt: str
    selected_tool: str
    tool_result: dict
    response: str


MCP_TOOLS = {
    "knowledge.search": {
        "description": "Search the enterprise incident playbook.",
        "result": {
            "title": "Checkout Confirmation Playbook",
            "snippet": "Acknowledge delay, correlate payment retries, flag premium customers, and publish a next update window.",
        },
    },
    "workflow.status": {
        "description": "Read the approval workflow state.",
        "result": {"workflowId": "WF-100", "status": "waiting-on-approval", "owner": "cloud-ops"},
    },
}


def select_mcp_tool(state: AgentState) -> AgentState:
    prompt = state.get("prompt", "").lower()
    selected_tool = "workflow.status" if "approval" in prompt or "workflow" in prompt else "knowledge.search"
    return {**state, "selected_tool": selected_tool}


def call_mcp_tool(state: AgentState) -> AgentState:
    selected_tool = state.get("selected_tool", "knowledge.search")
    tool = MCP_TOOLS[selected_tool]
    return {
        **state,
        "tool_result": {
            "server": "hosted-langgraph-mcp-gateway",
            "tool": selected_tool,
            "description": tool["description"],
            "content": tool["result"],
        },
    }


def draft_response(state: AgentState) -> AgentState:
    tool_result = state.get("tool_result", {})
    content = tool_result.get("content", {})
    response = (
        "LangGraph agent response: use the MCP result to acknowledge checkout confirmation delays, "
        "summarize the current operational signal, and route the case to the correct approval or support owner."
    )
    if content.get("status"):
        response = f"{response} Current workflow status is {content['status']} owned by {content.get('owner', 'unknown')}."
    elif content.get("snippet"):
        response = f"{response} Playbook guidance: {content['snippet']}"
    return {**state, "response": response}


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("select_mcp_tool", select_mcp_tool)
    graph.add_node("call_mcp_tool", call_mcp_tool)
    graph.add_node("draft_response", draft_response)
    graph.set_entry_point("select_mcp_tool")
    graph.add_edge("select_mcp_tool", "call_mcp_tool")
    graph.add_edge("call_mcp_tool", "draft_response")
    graph.add_edge("draft_response", END)
    return graph.compile()


GRAPH = build_graph()


class LangGraphAgentHandler(BaseHTTPRequestHandler):
    server_version = "EnterpriseAIDemoLangGraphAgent/1.0"

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/.well-known/agent-card.json":
            self._send_json(
                200,
                {
                    "name": "LangGraph MCP Agent",
                    "description": "Selects an approved MCP-style tool and returns workflow or knowledge context.",
                    "url": "/a2a/tasks",
                    "version": "1.0.0",
                    "capabilities": {"streaming": False, "pushNotifications": False},
                    "skills": [
                        {
                            "id": "mcp-tool-selection",
                            "name": "MCP tool selection",
                            "description": "Select an approved knowledge or workflow tool for the task.",
                            "tags": ["langgraph", "mcp", "workflow"],
                        }
                    ],
                },
            )
            return
        if self.path in {"/", "/health"}:
            self._send_json(
                200,
                {
                    "status": "healthy",
                    "service": "enterprise-ai-demo-hosted-langgraph-agent",
                    "graph": ["select_mcp_tool", "call_mcp_tool", "draft_response"],
                    "time": datetime.now(timezone.utc).isoformat(),
                },
            )
            return
        self._send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path not in {"/agent/langgraph-mcp/respond", "/a2a/tasks"}:
            self._send_json(404, {"error": "not found"})
            return

        length = int(self.headers.get("content-length", "0") or "0")
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            payload = {}

        prompt = str(payload.get("prompt") or "No prompt provided.").strip()
        task_id = str(payload.get("id") or payload.get("taskId") or "langgraph-task")
        result = GRAPH.invoke({"prompt": prompt})
        self._send_json(
            200,
            {
                "agent": "enterprise-ai-demo-hosted-langgraph-agent",
                "id": task_id,
                "kind": "task",
                "status": "completed",
                "runtime": "langgraph",
                "mcp": result.get("tool_result", {}),
                "graphSteps": ["select_mcp_tool", "call_mcp_tool", "draft_response"],
                "response": result.get("response", ""),
                "artifacts": [
                    {
                        "name": "mcp-tool-result",
                        "parts": [{"kind": "data", "data": result.get("tool_result", {})}],
                    }
                ],
                "inputPreview": prompt[:160],
                "time": datetime.now(timezone.utc).isoformat(),
            },
        )

    def log_message(self, format, *args):
        print("%s - %s" % (self.address_string(), format % args), flush=True)


def main():
    port = int(os.getenv("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), LangGraphAgentHandler)
    print(f"Enterprise AI demo hosted LangGraph agent listening on {port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
