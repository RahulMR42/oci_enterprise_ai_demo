#!/usr/bin/env python3
import json
import re
import uuid
from datetime import datetime, timezone

from common_oci import (
    OCI_RESPONSES_MODEL,
    call_oci_responses_api,
    call_oci_responses_api_with_tools,
    config_from_env,
    read_payload,
    response_output_text,
    response_to_json,
    validate_config,
)


DOCS_URL = "https://docs.oracle.com/en-us/iaas/Content/generative-ai/building-agents.htm"


ORDERS = {
    "ORD-1001": {
        "orderId": "ORD-1001",
        "status": "delayed",
        "eta": "2026-05-14T15:30:00Z",
        "reason": "payment confirmation retry",
        "customerTier": "premium",
    },
    "ORD-2407": {
        "orderId": "ORD-2407",
        "status": "ready",
        "eta": "2026-05-12T10:00:00Z",
        "reason": "warehouse handoff complete",
        "customerTier": "standard",
    },
}

ENTITLEMENTS = {
    "ACME-42": {"accountId": "ACME-42", "plan": "Enterprise", "support": "24x7", "active": True},
    "VISION-7": {"accountId": "VISION-7", "plan": "Standard", "support": "business-hours", "active": True},
}


TOOLS = [
    {
        "type": "function",
        "name": "lookup_order_status",
        "description": "Look up fulfillment and delivery status for a known order ID.",
        "parameters": {
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "string",
                    "description": "Order identifier such as ORD-1001.",
                }
            },
            "required": ["order_id"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "check_entitlement",
        "description": "Check the active support entitlement for an account.",
        "parameters": {
            "type": "object",
            "properties": {
                "account_id": {
                    "type": "string",
                    "description": "Account identifier such as ACME-42.",
                }
            },
            "required": ["account_id"],
            "additionalProperties": False,
        },
    },
    {
        "type": "function",
        "name": "create_service_ticket",
        "description": "Create a service ticket for a customer follow-up.",
        "parameters": {
            "type": "object",
            "properties": {
                "subject": {"type": "string"},
                "priority": {"type": "string", "enum": ["low", "medium", "high"]},
            },
            "required": ["subject", "priority"],
            "additionalProperties": False,
        },
    },
]


def _tool_result(name, arguments):
    if name == "lookup_order_status":
        order_id = str(arguments.get("order_id") or "ORD-1001").upper()
        return ORDERS.get(order_id) or {
            "orderId": order_id,
            "status": "not-found",
            "message": "No local demo order matched that ID.",
        }

    if name == "check_entitlement":
        account_id = str(arguments.get("account_id") or "ACME-42").upper()
        return ENTITLEMENTS.get(account_id) or {
            "accountId": account_id,
            "active": False,
            "message": "No local demo entitlement matched that account.",
        }

    if name == "create_service_ticket":
        return {
            "ticketId": f"SR-{uuid.uuid4().hex[:8].upper()}",
            "subject": str(arguments.get("subject") or "Customer follow-up"),
            "priority": str(arguments.get("priority") or "medium"),
            "status": "created",
        }

    raise RuntimeError(f"Unsupported tool call: {name}")


def _parse_json_arguments(value):
    if isinstance(value, dict):
        return value
    if not value:
        return {}
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return {}


def _find_function_call(value):
    if isinstance(value, dict):
        item_type = str(value.get("type", ""))
        if "function" in item_type and value.get("name"):
            return {
                "name": value["name"],
                "arguments": _parse_json_arguments(value.get("arguments")),
            }
        for child in value.values():
            found = _find_function_call(child)
            if found:
                return found
    elif isinstance(value, list):
        for child in value:
            found = _find_function_call(child)
            if found:
                return found
    return None


def _fallback_tool_call(prompt):
    order_match = re.search(r"\bORD-\d+\b", prompt, flags=re.IGNORECASE)
    if order_match or "order" in prompt.lower():
        return {
            "name": "lookup_order_status",
            "arguments": {"order_id": (order_match.group(0) if order_match else "ORD-1001").upper()},
            "source": "fallback",
        }

    account_match = re.search(r"\b[A-Z]+-\d+\b", prompt, flags=re.IGNORECASE)
    if account_match or "entitlement" in prompt.lower() or "support" in prompt.lower():
        return {
            "name": "check_entitlement",
            "arguments": {"account_id": (account_match.group(0) if account_match else "ACME-42").upper()},
            "source": "fallback",
        }

    return {
        "name": "create_service_ticket",
        "arguments": {"subject": prompt[:90] or "Customer follow-up", "priority": "medium"},
        "source": "fallback",
    }


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Function Calling demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    trace = [
        "Loaded local function catalog",
        f"Selected OCI Responses-compatible model {model}",
        f"Prepared OpenAI-compatible OCI endpoint for {config['region']}",
    ]
    result = {
        "feature": "Function Calling",
        "mode": "function-calling",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "tools": [tool["name"] for tool in TOOLS],
        },
        "trace": trace,
    }

    validate_config(config)
    planning_response = call_oci_responses_api_with_tools(
        prompt=prompt,
        temperature=0,
        model=model,
        config=config,
        tools=TOOLS,
        instructions=(
            "Choose one available function when the user asks for order, entitlement, "
            "or service ticket work. Do not invent unavailable tools."
        ),
    )
    planning_raw = response_to_json(planning_response)
    tool_call = _find_function_call(planning_raw) or _fallback_tool_call(prompt)
    tool_result = _tool_result(tool_call["name"], tool_call["arguments"])
    final_prompt = (
        "Use this governed application tool result to answer the user. "
        "Be concise and mention the action that was taken.\n\n"
        f"User request: {prompt}\n"
        f"Tool call: {json.dumps(tool_call, sort_keys=True)}\n"
        f"Tool result: {json.dumps(tool_result, sort_keys=True)}"
    )
    final_response = call_oci_responses_api(final_prompt, temperature, model, config)

    result["toolCall"] = tool_call
    result["toolResult"] = tool_result
    result["output"] = response_output_text(final_response)
    result["rawResponse"] = {
        "toolPlanning": planning_raw,
        "final": response_to_json(final_response),
    }
    result["trace"] = [
        *trace,
        "Called OCI Responses API with function tool schemas",
        f"Executed local tool {tool_call['name']}",
        "Called OCI Responses API with tool result handoff",
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
                    "feature": "Function Calling",
                    "mode": "function-calling",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                        "tools": [tool["name"] for tool in TOOLS],
                    },
                    "error": str(exc),
                    "trace": [
                        "Loaded local function catalog",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
