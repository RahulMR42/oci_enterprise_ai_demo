#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone

from common_oci import (
    OCI_RESPONSES_MODEL,
    call_oci_responses_api_with_tools,
    config_from_env,
    create_client,
    read_payload,
    response_output_text,
    response_to_json,
    validate_config,
)


DOCS_URL = "https://docs.oracle.com/en-us/iaas/Content/generative-ai/code-interpreter.htm"


def _container(payload):
    container_id = str(
        payload.get("codeInterpreterContainer") or os.getenv("OCI_GENAI_CODE_INTERPRETER_CONTAINER", "")
    ).strip()

    if container_id:
        return container_id

    return _auto_container(payload)


def _auto_container(payload):
    memory_limit = str(payload.get("codeInterpreterMemoryLimit") or "1g").strip() or "1g"
    return {
        "type": "auto",
        "memory_limit": memory_limit,
    }


def _should_create_new_container(payload):
    return bool(payload.get("createNewCodeInterpreterContainer"))


def _is_recoverable_explicit_container_error(error):
    error_text = str(error).lower()
    return "container is expired" in error_text or "internal server error" in error_text


def _container_response_to_json(container):
    if hasattr(container, "model_dump"):
        return container.model_dump(mode="json")
    if hasattr(container, "to_dict"):
        return container.to_dict()
    return json.loads(container.model_dump_json())


def _create_replacement_container(config, payload):
    memory_limit = str(payload.get("codeInterpreterMemoryLimit") or "1g").strip() or "1g"
    display_name = str(
        payload.get("codeInterpreterContainerName")
        or f"enterprise-ai-demo-code-interpreter-runtime-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    ).strip()
    client = create_client(config)
    container = client.containers.create(
        name=display_name,
        memory_limit=memory_limit,
    )
    container_json = _container_response_to_json(container)
    container_id = str(container_json.get("id", "")).strip()
    if not container_id:
        raise RuntimeError("OCI created a replacement Code Interpreter container without returning an id.")

    return container_id, container_json


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Code Interpreter demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    selected_container = _container(payload)
    tool = {
        "type": "code_interpreter",
        "container": selected_container,
    }
    trace = [
        "Prepared Code Interpreter tool definition",
        f"Selected OCI Responses-compatible model {model}",
        f"Prepared OpenAI-compatible OCI endpoint for {config['region']}",
    ]

    result = {
        "feature": "Code Interpreter",
        "mode": "code-interpreter",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "tool": tool,
        },
        "trace": trace,
    }

    validate_config(config)
    instructions = (
        "Use the python tool for computation, data analysis, or file processing when useful. "
        "Explain the result concisely and include any important intermediate values."
    )

    if _should_create_new_container(payload):
        replacement_container_id, replacement_container = _create_replacement_container(config, payload)
        tool = {
            "type": "code_interpreter",
            "container": replacement_container_id,
        }
        result["request"]["tool"] = tool
        result["recreatedCodeInterpreterContainer"] = replacement_container
        result["notices"] = [
            {
                "type": "container-created",
                "title": "Code Interpreter container created",
                "message": (
                    "OCI created a new Code Interpreter container for this run. "
                    f"Using container {replacement_container_id}."
                ),
            }
        ]
        trace = [
            *trace,
            f"Code Interpreter container created for this run; using replacement container {replacement_container_id}",
        ]

    try:
        response = call_oci_responses_api_with_tools(
            prompt=prompt,
            temperature=temperature,
            model=model,
            config=config,
            tools=[tool],
            instructions=instructions,
            tool_choice="required",
        )
        execution_trace = trace
    except Exception as exc:
        if not isinstance(tool["container"], str) or not _is_recoverable_explicit_container_error(exc):
            raise

        replacement_container_id, replacement_container = _create_replacement_container(config, payload)
        tool = {
            "type": "code_interpreter",
            "container": replacement_container_id,
        }
        result["request"]["tool"] = tool
        result["recreatedCodeInterpreterContainer"] = replacement_container
        result["notices"] = [
            {
                "type": "container-recreated",
                "title": "Code Interpreter container recreated",
                "message": (
                    "The configured Code Interpreter container could not be reused. "
                    f"OCI created replacement container {replacement_container_id} during this run."
                ),
            }
        ]
        response = call_oci_responses_api_with_tools(
            prompt=prompt,
            temperature=temperature,
            model=model,
            config=config,
            tools=[tool],
            instructions=instructions,
            tool_choice="required",
        )
        execution_trace = [
            *trace,
            f"Code Interpreter container recovery triggered; created replacement container {replacement_container_id}",
        ]

    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [
        *execution_trace,
        "Called OCI Responses API with Code Interpreter",
        "Received model response after sandboxed Python execution",
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
                    "feature": "Code Interpreter",
                    "mode": "code-interpreter",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                        "tool": {
                            "type": "code_interpreter",
                            "container": _container(payload),
                        },
                    },
                    "error": str(exc),
                    "trace": [
                        "Prepared Code Interpreter tool definition",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
