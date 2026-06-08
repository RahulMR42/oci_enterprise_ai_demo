#!/usr/bin/env python3
import json
from datetime import datetime, timezone

from common_oci import (
    OCI_RESPONSES_MODEL,
    config_from_env,
    create_client,
    read_payload,
    validate_config,
)


DOCS_URL = "https://docs.oracle.com/en-us/iaas/Content/generative-ai/responses-api.htm"


STRUCTURED_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "summary": {"type": "string"},
        "severity": {"type": "string", "enum": ["low", "medium", "high"]},
        "next_actions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "severity", "next_actions"],
}


def _event_to_json(event):
    if hasattr(event, "model_dump"):
        return event.model_dump(mode="json")
    if hasattr(event, "to_dict"):
        return event.to_dict()
    if isinstance(event, dict):
        return event
    return {"type": getattr(event, "type", type(event).__name__), "value": str(event)}


def _event_delta(event, event_json):
    event_type = getattr(event, "type", event_json.get("type", ""))
    if event_type == "response.output_text.delta":
        return getattr(event, "delta", "") or event_json.get("delta", "")
    if event_type == "response.output_text.done":
        return getattr(event, "text", "") or event_json.get("text", "")
    output = event_json.get("output_text")
    return output if isinstance(output, str) else ""


def _parse_structured_output(output):
    if not output:
        return None
    try:
        return json.loads(output)
    except json.JSONDecodeError:
        object_text = _first_json_object(output)
        if not object_text:
            return None
        try:
            return json.loads(object_text)
        except json.JSONDecodeError:
            return None


def _first_json_object(output):
    start = output.find("{")
    if start == -1:
        return ""

    depth = 0
    in_string = False
    escaped = False
    for index, char in enumerate(output[start:], start=start):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return output[start : index + 1]
    return ""


def _stream_response(client, request):
    try:
        return client.responses.create(**request)
    except Exception as exc:
        fallback = dict(request)
        fallback.pop("text", None)
        fallback["input"] = (
            f"{request['input']}\n\n"
            "Return only valid JSON with keys summary, severity, and next_actions."
        )
        return client.responses.create(**fallback), str(exc)


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Responses Streaming + Structured Output demo.")

    temperature = float(payload.get("temperature", 0.1))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    trace = [
        "Prepared OCI Responses API streaming request",
        "Attached structured JSON schema contract",
        f"Selected OCI Responses-compatible model {model}",
    ]
    result = {
        "feature": "OCI Responses Streaming + Structured Output",
        "mode": "responses-streaming-structured-output",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "stream": True,
            "schema": STRUCTURED_SCHEMA,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
        },
        "trace": trace,
    }

    validate_config(config)
    client = create_client(config)
    request = {
        "model": model,
        "input": prompt,
        "temperature": temperature,
        "stream": True,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "incident_triage_summary",
                "schema": STRUCTURED_SCHEMA,
                "strict": True,
            }
        },
    }
    stream_result = _stream_response(client, request)
    stream = stream_result
    fallback_error = ""
    if isinstance(stream_result, tuple):
        stream, fallback_error = stream_result

    chunks = []
    events = []
    for event in stream:
        event_json = _event_to_json(event)
        events.append(event_json)
        delta = _event_delta(event, event_json)
        if delta:
            chunks.append(delta)

    output = "".join(chunks).strip()
    structured_output = _parse_structured_output(output)

    result["output"] = output
    result["structuredOutput"] = structured_output
    result["streamEvents"] = events[:20]
    result["trace"] = [
        *trace,
        *([f"Structured schema retry used after provider rejected text.format: {fallback_error}"] if fallback_error else []),
        f"Received {len(events)} streaming events from OCI Responses API",
        "Aggregated streaming output for inspection",
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
                    "feature": "OCI Responses Streaming + Structured Output",
                    "mode": "responses-streaming-structured-output",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                    },
                    "error": str(exc),
                    "trace": [
                        "Prepared OCI Responses API streaming request",
                        "Attached structured JSON schema contract",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
