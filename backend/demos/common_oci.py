import json
import os


OCI_RESPONSES_MODEL = "openai.gpt-oss-120b"
DEFAULT_REGION = "us-chicago-1"
DOCS_URL = "https://docs.oracle.com/en-us/iaas/Content/generative-ai/responses-api.htm"


def read_payload():
    import sys

    try:
        raw_input = sys.stdin.read()
        return json.loads(raw_input or "{}")
    except json.JSONDecodeError as exc:
        return {"error": f"Invalid JSON payload: {exc}"}


def base_url(region):
    return f"https://inference.generativeai.{region}.oci.oraclecloud.com/openai/v1"


def config_from_env():
    region = os.getenv("OCI_GENAI_REGION", DEFAULT_REGION).strip() or DEFAULT_REGION
    return {
        "api_key": os.getenv("OCI_GENAI_API_KEY", "").strip(),
        "project": os.getenv("OCI_GENAI_PROJECT_ID", "").strip(),
        "region": region,
        "base_url": base_url(region),
    }


def validate_config(config):
    missing = []
    if not config["api_key"]:
        missing.append("OCI_GENAI_API_KEY")
    if not config["project"]:
        missing.append("OCI_GENAI_PROJECT_ID")

    if missing:
        raise RuntimeError(
            "Missing required OCI Responses API configuration: "
            f"{', '.join(missing)}. Provision infrastructure before running the live demo."
        )


def create_client(config):
    try:
        from openai import OpenAI
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Missing Python dependency 'openai'. Install it with `python3 -m pip install openai` "
            "before running live OCI Responses API demos."
        ) from exc

    return OpenAI(
        base_url=config["base_url"],
        api_key=config["api_key"],
        project=config["project"],
    )


def call_oci_responses_api(prompt, temperature, model, config):
    client = create_client(config)
    return client.responses.create(
        model=model,
        input=prompt,
        temperature=temperature,
    )


def call_oci_responses_api_with_tools(prompt, temperature, model, config, tools, instructions=None, tool_choice=None):
    client = create_client(config)
    request = {
        "model": model,
        "input": prompt,
        "temperature": temperature,
        "tools": tools,
    }

    if instructions:
        request["instructions"] = instructions
    if tool_choice:
        request["tool_choice"] = tool_choice

    return client.responses.create(**request)


def response_to_json(response):
    if hasattr(response, "model_dump"):
        return response.model_dump(mode="json")
    if hasattr(response, "to_dict"):
        return response.to_dict()
    return json.loads(response.model_dump_json())


def response_output_text(response):
    return getattr(response, "output_text", "") or ""
