#!/usr/bin/env python3
import asyncio
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


DOCS_URL = "https://docs.llamaindex.ai/en/stable/module_guides/workflow/"


def load_llamaindex_workflow():
    try:
        from llama_index.core.workflow import Event, StartEvent, StopEvent, Workflow, step
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Missing Python dependency 'llama-index-core'. Install it with "
            "`env/bin/python -m pip install -r requirements.txt` before running this demo."
        ) from exc
    return Event, StartEvent, StopEvent, Workflow, step


def idcs_posture_from_env():
    import os

    raw = os.getenv("OCI_HOSTED_APP_IDCS_POSTURE", "{}")
    try:
        posture = json.loads(raw)
    except json.JSONDecodeError:
        posture = {}
    return {
        "configured": bool(posture.get("configured")),
        "source": str(posture.get("source") or "not-configured"),
        "domainUrl": str(posture.get("domainUrl") or ""),
        "tokenUrlConfigured": bool(posture.get("tokenUrlConfigured")),
        "clientIdConfigured": bool(posture.get("clientIdConfigured")),
        "clientSecretConfigured": bool(posture.get("clientSecretConfigured")),
        "audience": str(posture.get("audience") or ""),
        "scope": str(posture.get("scope") or ""),
    }


def incident_lookup(prompt):
    return {
        "tool": "incident_lookup",
        "status": "degraded-checkout-confirmation",
        "severity": "high" if "checkout" in prompt.lower() else "medium",
        "affectedCustomers": 42,
    }


def policy_search(_prompt):
    return {
        "tool": "policy_search",
        "policy": "Customer-impacting actions require approval when severity is high.",
        "evidence": ["approval-required-for-high-severity", "customer-update-within-30-minutes"],
    }


def sql_metric_summary(_prompt):
    return {
        "tool": "sql_metric_summary",
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
        "eventType": "agentic-control-tower-plan",
        "recorded": True,
        "stepCount": len(plan["steps"]),
    }


def build_plan(prompt):
    risk_level = "high" if any(term in prompt.lower() for term in ["refund", "checkout", "customer"]) else "medium"
    return {
        "goal": "Coordinate a governed enterprise agent workflow with evidence and approval.",
        "riskLevel": risk_level,
        "steps": [
            "Classify incident intent",
            "Gather incident and policy evidence",
            "Summarize operational metrics",
            "Check approval requirement",
            "Record audit event",
            "Synthesize final response",
        ],
    }


async def run_llamaindex_control_tower(prompt, idcs_posture):
    Event, StartEvent, StopEvent, Workflow, step = load_llamaindex_workflow()

    class PlanEvent(Event):
        plan: dict

    class ToolEvent(Event):
        plan: dict
        tool_results: list

    class ReviewEvent(Event):
        plan: dict
        tool_results: list
        evidence_review: dict

    class ControlTowerWorkflow(Workflow):
        @step
        async def plan(self, ev: StartEvent) -> PlanEvent:
            return PlanEvent(plan=build_plan(ev.prompt))

        @step
        async def execute_tools(self, ev: PlanEvent) -> ToolEvent:
            results = [
                incident_lookup(prompt),
                policy_search(prompt),
                sql_metric_summary(prompt),
                approval_request(ev.plan["riskLevel"]),
                audit_event(ev.plan),
            ]
            return ToolEvent(plan=ev.plan, tool_results=results)

        @step
        async def review(self, ev: ToolEvent) -> ReviewEvent:
            evidence_review = {
                "sufficient": all(result.get("tool") for result in ev.tool_results),
                "requiresApproval": any(result.get("approvalRequired") for result in ev.tool_results),
                "idcsConfigured": idcs_posture["configured"],
            }
            return ReviewEvent(plan=ev.plan, tool_results=ev.tool_results, evidence_review=evidence_review)

        @step
        async def finish(self, ev: ReviewEvent) -> StopEvent:
            return StopEvent(
                result={
                    "plan": ev.plan,
                    "toolResults": ev.tool_results,
                    "evidenceReview": ev.evidence_review,
                    "memoryNote": {
                        "subject": "operations-control-tower",
                        "fact": f"Latest risk level is {ev.plan['riskLevel']} with approval={ev.evidence_review['requiresApproval']}",
                    },
                }
            )

    workflow = ControlTowerWorkflow(timeout=10, verbose=False)
    return await workflow.run(prompt=prompt)


def build_control_tower_prompt(prompt, workflow, idcs_posture):
    return (
        "You are an enterprise agent control tower. Summarize the workflow, evidence, approval state, "
        "IDCS credential posture, and next action. Do not invent evidence.\n\n"
        f"User request: {prompt}\n\n"
        f"Workflow: {json.dumps(workflow, sort_keys=True)}\n\n"
        f"IDCS posture: {json.dumps(idcs_posture, sort_keys=True)}"
    )


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Agentic Control Tower demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    idcs_posture = idcs_posture_from_env()
    workflow = asyncio.run(run_llamaindex_control_tower(prompt, idcs_posture))
    trace = [
        "Loaded LlamaIndex agentic control tower workflow",
        "Planned governed multi-tool incident workflow",
        "Executed local enterprise tools",
        "Reviewed evidence and approval posture",
        "Checked hosted app IDCS credential posture",
    ]
    result = {
        "feature": "Agentic Control Tower",
        "mode": "agentic-control-tower",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
        },
        "idcsCredentialPosture": idcs_posture,
        "workflow": workflow,
        "trace": trace,
    }

    validate_config(config)
    response = call_oci_responses_api(
        build_control_tower_prompt(prompt, workflow, idcs_posture),
        temperature,
        model,
        config,
    )
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [*trace, "Called OCI Responses API for final control tower synthesis"]
    return result


def main():
    payload = read_payload()
    try:
        print(json.dumps(run_demo(payload)))
        return 0
    except Exception as exc:
        config = config_from_env()
        model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
        idcs_posture = idcs_posture_from_env()
        workflow = {}
        trace = ["Live OCI Responses API call was not completed"]
        try:
            workflow = asyncio.run(
                run_llamaindex_control_tower(
                    str(payload.get("prompt", "")).strip() or "enterprise incident",
                    idcs_posture,
                )
            )
            trace = [
                "Loaded LlamaIndex agentic control tower workflow",
                "Planned governed multi-tool incident workflow",
                "Executed local enterprise tools",
                "Reviewed evidence and approval posture",
                "Checked hosted app IDCS credential posture",
                "Live OCI Responses API call was not completed",
            ]
        except Exception as workflow_exc:
            trace = ["LlamaIndex agentic control tower workflow was not completed"]
            workflow = {"error": str(workflow_exc)}
        print(
            json.dumps(
                {
                    "feature": "Agentic Control Tower",
                    "mode": "agentic-control-tower",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                    },
                    "idcsCredentialPosture": idcs_posture,
                    "workflow": workflow,
                    "error": str(exc),
                    "trace": trace,
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
