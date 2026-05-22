#!/usr/bin/env python3
import hashlib
import json
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


DOCS_URL = "https://docs.oracle.com/en-us/iaas/Content/document-understanding/home.htm"
PDF_DIR = Path(__file__).resolve().parents[2] / "infra" / "file-search-vector-store-rag" / "assets" / "pdfs"

DOCUMENT_HINTS = {
    "best-practices-for-iam-on-oci.pdf": [
        "Identity and access management best practices",
        "Least privilege and compartment policy design",
        "API key and credential handling",
    ],
    "oracle-cloud-infrastructure-security-architecture.pdf": [
        "Security architecture for OCI workloads",
        "Network, IAM, logging, and monitoring controls",
        "Defense-in-depth reference patterns",
    ],
    "whitepaper-zero-trust-security-oci.pdf": [
        "Zero trust security principles on OCI",
        "Continuous verification and least privilege",
        "Segmentation and policy enforcement",
    ],
}


def _document_manifest():
    documents = []
    if not PDF_DIR.exists():
        return documents

    for path in sorted(PDF_DIR.glob("*.pdf")):
        data = path.read_bytes()
        documents.append(
            {
                "fileName": path.name,
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
                "pageEstimate": max(data.count(b"/Type /Page"), 1),
                "extractedSignals": DOCUMENT_HINTS.get(path.name, ["Bundled Oracle PDF"]),
            }
        )
    return documents


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the Document Understanding demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    documents = _document_manifest()
    if not documents:
        raise RuntimeError(f"No bundled PDFs were found under {PDF_DIR}.")

    trace = [
        f"Loaded {len(documents)} bundled Oracle PDF document(s)",
        "Extracted local document metadata and curated document signals",
        f"Selected OCI Responses-compatible model {model}",
    ]
    result = {
        "feature": "Document Understanding + GenAI",
        "mode": "document-understanding-genai",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "documentCount": len(documents),
        },
        "documents": documents,
        "trace": trace,
    }

    validate_config(config)
    response = call_oci_responses_api(
        (
            "You are reviewing document-understanding output for an enterprise AI portal. "
            "Use the extracted PDF manifest and document signals to answer the user. "
            "Mention document filenames when useful.\n\n"
            f"User request: {prompt}\n"
            f"Document manifest: {json.dumps(documents, sort_keys=True)}"
        ),
        temperature,
        model,
        config,
    )
    result["output"] = response_output_text(response)
    result["rawResponse"] = response_to_json(response)
    result["trace"] = [
        *trace,
        "Called OCI Responses API with document-understanding context",
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
                    "feature": "Document Understanding + GenAI",
                    "mode": "document-understanding-genai",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                    },
                    "error": str(exc),
                    "trace": [
                        "Loaded bundled Oracle PDF document metadata",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
