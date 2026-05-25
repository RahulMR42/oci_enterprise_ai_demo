#!/usr/bin/env python3
import asyncio
import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from llama_index.core.workflow import Event, StartEvent, StopEvent, Workflow, step


GRAPH_STEPS = ["plan", "execute_tools", "review", "finish"]


class PlanEvent(Event):
    plan: dict


class ToolEvent(Event):
    plan: dict
    tool_results: list


class ReviewEvent(Event):
    plan: dict
    tool_results: list
    evidence_review: dict


def build_plan(prompt):
    risk_level = "high" if any(term in prompt.lower() for term in ["checkout", "customer", "refund", "approval"]) else "medium"
    return {
        "goal": "Coordinate a hosted governed agent workflow with evidence, approval, and audit.",
        "riskLevel": risk_level,
        "steps": [
            "Classify operational request",
            "Gather incident evidence",
            "Check policy and metrics",
            "Evaluate approval requirement",
            "Record audit event",
            "Return next action",
        ],
    }


def incident_lookup(prompt):
    return {
        "tool": "incident_lookup",
        "status": "degraded-checkout-confirmation" if "checkout" in prompt.lower() else "needs-triage",
        "severity": "high" if "checkout" in prompt.lower() else "medium",
        "affectedCustomers": 42,
    }


def policy_search():
    return {
        "tool": "policy_search",
        "policy": "Customer-impacting high-severity operations require manager approval.",
        "evidence": ["manager-approval-required", "customer-update-window-30-minutes"],
    }


def metric_summary():
    return {
        "tool": "metric_summary",
        "metric": "confirmation_delay_minutes_p95",
        "value": 18,
        "trend": "up",
    }


def approval_request(risk_level):
    return {
        "tool": "approval_request",
        "approvalRequired": risk_level == "high",
        "approver": "operations-manager" if risk_level == "high" else "",
    }


def audit_event(plan):
    return {
        "tool": "audit_event",
        "recorded": True,
        "eventType": "hosted-llamaindex-control-tower",
        "stepCount": len(plan["steps"]),
    }


class ControlTowerWorkflow(Workflow):
    @step
    async def plan(self, ev: StartEvent) -> PlanEvent:
        return PlanEvent(plan=build_plan(ev.prompt))

    @step
    async def execute_tools(self, ev: PlanEvent) -> ToolEvent:
        prompt = self.ctx.data.get("prompt", "") if hasattr(self, "ctx") else ""
        tool_results = [
            incident_lookup(prompt),
            policy_search(),
            metric_summary(),
            approval_request(ev.plan["riskLevel"]),
            audit_event(ev.plan),
        ]
        return ToolEvent(plan=ev.plan, tool_results=tool_results)

    @step
    async def review(self, ev: ToolEvent) -> ReviewEvent:
        return ReviewEvent(
            plan=ev.plan,
            tool_results=ev.tool_results,
            evidence_review={
                "sufficient": all(result.get("tool") for result in ev.tool_results),
                "requiresApproval": any(result.get("approvalRequired") for result in ev.tool_results),
                "hostedRuntime": True,
            },
        )

    @step
    async def finish(self, ev: ReviewEvent) -> StopEvent:
        return StopEvent(
            result={
                "plan": ev.plan,
                "toolResults": ev.tool_results,
                "evidenceReview": ev.evidence_review,
                "memoryNote": {
                    "subject": "hosted-control-tower",
                    "fact": f"Hosted LlamaIndex workflow risk={ev.plan['riskLevel']} approval={ev.evidence_review['requiresApproval']}",
                },
            }
        )


async def run_workflow(prompt):
    workflow = ControlTowerWorkflow(timeout=10, verbose=False)
    return await workflow.run(prompt=prompt)


class Handler(BaseHTTPRequestHandler):
    server_version = "EnterpriseAIDemoHostedLlamaIndex/1.0"

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in {"/", "/health"}:
            self.send_json(
                200,
                {
                    "status": "healthy",
                    "service": "enterprise-ai-demo-hosted-llamaindex-control-tower",
                    "runtime": "llamaindex",
                    "hosted": True,
                    "graphSteps": GRAPH_STEPS,
                    "time": datetime.now(timezone.utc).isoformat(),
                },
            )
            return
        if self.path == "/.well-known/agent-card.json":
            self.send_json(
                200,
                {
                    "name": "Hosted LlamaIndex Control Tower",
                    "description": "Runs a hosted LlamaIndex workflow for governed incident planning, evidence review, approval, and audit.",
                    "url": "/agent/control-tower/respond",
                    "version": "1.0.0",
                    "capabilities": {"streaming": False, "pushNotifications": False},
                    "skills": [
                        {
                            "id": "control-tower-workflow",
                            "name": "Control tower workflow",
                            "description": "Plan, execute deterministic tools, review evidence, and return governed next action.",
                            "tags": ["llamaindex", "workflow", "hosted-application"],
                        }
                    ],
                },
            )
            return
        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/agent/control-tower/respond":
            self.send_json(404, {"error": "not found"})
            return
        length = int(self.headers.get("content-length", "0") or "0")
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            payload = {}
        prompt = str(payload.get("prompt") or "Coordinate an enterprise incident response.").strip()
        task_id = str(payload.get("id") or payload.get("taskId") or "llamaindex-control-tower")
        workflow = asyncio.run(run_workflow(prompt))
        self.send_json(
            200,
            {
                "agent": "enterprise-ai-demo-hosted-llamaindex-control-tower",
                "id": task_id,
                "kind": "task",
                "status": "completed",
                "runtime": "llamaindex",
                "hosted": True,
                "graphSteps": GRAPH_STEPS,
                "workflow": workflow,
                "response": (
                    "Hosted LlamaIndex control tower completed planning, tool execution, evidence review, "
                    "approval check, audit recording, and next-action synthesis."
                ),
                "inputPreview": prompt[:160],
                "time": datetime.now(timezone.utc).isoformat(),
            },
        )

    def log_message(self, format, *args):
        print("%s - %s" % (self.address_string(), format % args), flush=True)


def main():
    port = int(os.getenv("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Hosted LlamaIndex Control Tower listening on {port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
