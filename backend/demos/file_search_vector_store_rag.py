#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone

from common_oci import (
    OCI_RESPONSES_MODEL,
    call_oci_responses_api_with_tools,
    config_from_env,
    read_payload,
    response_output_text,
    response_to_json,
    validate_config,
)


DOCS_URL = "https://docs.oracle.com/en-us/iaas/Content/generative-ai/file-search.htm"


def _vector_store_id(payload):
    return str(payload.get("vectorStoreId") or os.getenv("OCI_GENAI_VECTOR_STORE_ID", "")).strip()


def _validate_vector_store(vector_store_id):
    if not vector_store_id:
        raise RuntimeError(
            "Missing required File Search configuration: OCI_GENAI_VECTOR_STORE_ID. "
            "Create or select a vector store and provide its ID before running this live demo."
        )


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the File Search demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    vector_store_id = _vector_store_id(payload)
    config = config_from_env()
    tool = {
        "type": "file_search",
        "vector_store_ids": [vector_store_id] if vector_store_id else [],
    }
    trace = [
        "Prepared File Search tool definition",
        f"Selected OCI Responses-compatible model {model}",
        f"Prepared OpenAI-compatible OCI endpoint for {config['region']}",
    ]

    result = {
        "feature": "File Search & Vector Store RAG",
        "mode": "file-search-vector-store-rag",
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

    _validate_vector_store(vector_store_id)
    validate_config(config)
    response = call_oci_responses_api_with_tools(
        prompt=prompt,
        temperature=temperature,
        model=model,
        config=config,
        tools=[tool],
        instructions=(
            "Use File Search to ground the answer in the configured vector store. "
            "Mention when the available documents do not contain enough evidence."
        ),
    )
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [
        *trace,
        "Called OCI Responses API with File Search",
        "Received grounded response from OCI",
    ]
    return result


def main():
    payload = read_payload()
    try:
        print(json.dumps(run_demo(payload)))
        return 0
    except Exception as exc:
        config = config_from_env()
        vector_store_id = _vector_store_id(payload)
        model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
        print(
            json.dumps(
                {
                    "feature": "File Search & Vector Store RAG",
                    "mode": "file-search-vector-store-rag",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                        "tool": {
                            "type": "file_search",
                            "vector_store_ids": [vector_store_id] if vector_store_id else [],
                        },
                    },
                    "error": str(exc),
                    "trace": [
                        "Prepared File Search tool definition",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
