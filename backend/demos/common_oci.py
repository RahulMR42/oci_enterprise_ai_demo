import json
import os
from pathlib import Path


OCI_RESPONSES_MODEL = "openai.gpt-oss-120b"
DEFAULT_REGION = "us-chicago-1"
DOCS_URL = "https://docs.oracle.com/en-us/iaas/Content/generative-ai/responses-api.htm"
DEFAULT_DEMO_DATA_DIRS = (
    Path("/dev/shm") / "enterprise-ai-demo" / "backend-data",
    Path("/tmp") / "enterprise-ai-demo" / "backend-data",
)


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


def demo_data_path(filename):
    root = os.getenv("OCI_PORTAL_DEMO_DATA_DIR") or os.getenv("OCI_DEMO_DATA_DIR") or ""
    base_dir = Path(root).expanduser() if root.strip() else demo_data_dir()
    return base_dir / filename


def demo_data_dir():
    for candidate in DEFAULT_DEMO_DATA_DIRS:
        if writable_directory(candidate):
            return candidate
    return DEFAULT_DEMO_DATA_DIRS[-1]


def writable_directory(path):
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".write-test"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return True
    except OSError:
        return False


def read_json_store(path, default_value):
    try:
        if not path.exists():
            return json.loads(json.dumps(default_value))
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return json.loads(json.dumps(default_value))


def write_json_store(path, value):
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, indent=2), encoding="utf-8")
        return str(path)
    except OSError:
        return "in-memory fallback"


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
