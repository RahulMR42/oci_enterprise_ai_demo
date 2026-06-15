#!/usr/bin/env python3
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from common_oci import (
    OCI_RESPONSES_MODEL,
    call_oci_responses_api,
    config_from_env,
    demo_data_path,
    read_payload,
    response_output_text,
    response_to_json,
    validate_config,
)


DOCS_URL = "https://docs.oracle.com/en-us/iaas/Content/generative-ai/building-agents.htm"
DB_PATH = demo_data_path("sql_search_sample.sqlite")
TFSTATE_PATH = Path(__file__).resolve().parents[2] / "infra" / "nl2sql-sql-search" / "terraform.tfstate"

SCHEMA = """
Tables:
- customers(customer_id, account_name, tier, region)
- orders(order_id, customer_id, order_date, status, amount_usd)
- support_cases(case_id, customer_id, opened_date, severity, topic, status)
Relationships:
- orders.customer_id joins customers.customer_id
- support_cases.customer_id joins customers.customer_id
"""

SEED_SQL = [
    "create table if not exists customers(customer_id text primary key, account_name text, tier text, region text)",
    "create table if not exists orders(order_id text primary key, customer_id text, order_date text, status text, amount_usd real)",
    "create table if not exists support_cases(case_id text primary key, customer_id text, opened_date text, severity text, topic text, status text)",
]

SEED_ROWS = {
    "customers": [
        ("C-100", "Acme Retail", "premium", "NA"),
        ("C-200", "Vision Foods", "standard", "EMEA"),
        ("C-300", "Northwind Online", "premium", "APAC"),
    ],
    "orders": [
        ("ORD-1001", "C-100", "2026-05-10", "delayed", 1240.50),
        ("ORD-1002", "C-100", "2026-05-11", "complete", 775.00),
        ("ORD-2407", "C-200", "2026-05-12", "ready", 420.25),
        ("ORD-3009", "C-300", "2026-05-12", "delayed", 1890.00),
    ],
    "support_cases": [
        ("SR-501", "C-100", "2026-05-11", "high", "checkout confirmation", "open"),
        ("SR-502", "C-200", "2026-05-09", "medium", "invoice question", "closed"),
        ("SR-503", "C-300", "2026-05-12", "high", "delivery delay", "open"),
    ],
}


def _read_nl2sql_infra():
    if not TFSTATE_PATH.exists():
        return {}
    try:
        state = json.loads(TFSTATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

    values = {}
    for resource in state.get("resources", []):
        instances = resource.get("instances", [])
        attrs = instances[0].get("attributes", {}) if instances else {}
        key = f"{resource.get('type')}.{resource.get('name')}"
        if key == "oci_database_autonomous_database.sql_search":
            values["autonomousDatabaseId"] = attrs.get("id", "")
            values["autonomousDatabaseName"] = attrs.get("db_name", "") or attrs.get("display_name", "")
        elif key == "oci_database_tools_database_tools_connection.query":
            values["queryConnectionId"] = attrs.get("id", "")
        elif key == "oci_database_tools_database_tools_connection.enrichment":
            values["enrichmentConnectionId"] = attrs.get("id", "")
    return values


def _ensure_database():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    for statement in SEED_SQL:
        connection.execute(statement)
    connection.executemany("insert or ignore into customers values(?, ?, ?, ?)", SEED_ROWS["customers"])
    connection.executemany("insert or ignore into orders values(?, ?, ?, ?, ?)", SEED_ROWS["orders"])
    connection.executemany("insert or ignore into support_cases values(?, ?, ?, ?, ?, ?)", SEED_ROWS["support_cases"])
    connection.commit()
    return connection


def _extract_json_object(text):
    if not text:
        return None
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None


def _fallback_sql(prompt):
    lowered = prompt.lower()
    if "support" in lowered or "case" in lowered:
        return (
            "select c.account_name, s.severity, s.topic, s.status "
            "from support_cases s join customers c on c.customer_id = s.customer_id "
            "order by s.opened_date desc limit 10"
        )
    if "premium" in lowered:
        return (
            "select c.account_name, count(o.order_id) as order_count, sum(o.amount_usd) as total_amount_usd "
            "from customers c join orders o on c.customer_id = o.customer_id "
            "where c.tier = 'premium' group by c.account_name order by total_amount_usd desc"
        )
    return (
        "select c.account_name, o.order_id, o.status, o.amount_usd "
        "from orders o join customers c on c.customer_id = o.customer_id "
        "order by o.order_date desc limit 10"
    )


def _validate_select(sql):
    cleaned = sql.strip().rstrip(";")
    lowered = cleaned.lower()
    if not lowered.startswith("select "):
        raise RuntimeError("Generated SQL was rejected because only SELECT statements are allowed.")
    if ";" in cleaned:
        raise RuntimeError("Generated SQL was rejected because multiple statements are not allowed.")
    blocked = [" insert ", " update ", " delete ", " drop ", " alter ", " create ", " attach ", " pragma "]
    padded = f" {lowered} "
    if any(keyword in padded for keyword in blocked):
        raise RuntimeError("Generated SQL was rejected because it contains a blocked keyword.")
    if not re.search(r"\blimit\b", lowered):
        cleaned = f"{cleaned} limit 25"
    return cleaned


def _query_rows(connection, sql):
    cursor = connection.execute(sql)
    columns = [description[0] for description in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def run_demo(payload):
    if "error" in payload:
        raise RuntimeError(payload["error"])

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        raise RuntimeError("Prompt is required for the NL2SQL demo.")

    temperature = float(payload.get("temperature", 0.2))
    model = str(payload.get("model", OCI_RESPONSES_MODEL)).strip() or OCI_RESPONSES_MODEL
    config = config_from_env()
    infra = _read_nl2sql_infra()
    trace = [
        "Loaded SQL Search sample schema",
        "Loaded NL2SQL infrastructure metadata from Terraform state",
        f"Selected OCI Responses-compatible model {model}",
    ]
    result = {
        "feature": "NL2SQL / SQL Search",
        "mode": "nl2sql-sql-search",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "documentation": DOCS_URL,
        "request": {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "baseUrl": config["base_url"],
            "project": config["project"] or "not configured",
            "schema": SCHEMA.strip(),
            "infrastructure": infra,
        },
        "trace": trace,
    }

    validate_config(config)
    sql_prompt = (
        "Translate the business question into one safe SQLite SELECT query for this schema. "
        "Return only JSON with keys 'sql' and 'explanation'.\n\n"
        f"{SCHEMA}\nQuestion: {prompt}"
    )
    sql_response = call_oci_responses_api(sql_prompt, 0, model, config)
    sql_plan = _extract_json_object(response_output_text(sql_response)) or {
        "sql": _fallback_sql(prompt),
        "explanation": "Fallback SQL selected because the model response was not parseable JSON.",
    }
    sql = _validate_select(str(sql_plan.get("sql") or _fallback_sql(prompt)))
    connection = _ensure_database()
    rows = _query_rows(connection, sql)
    answer_prompt = (
        "Summarize these SQL results for the business user. Include the SQL that was executed.\n\n"
        f"Question: {prompt}\nSQL: {sql}\nRows: {json.dumps(rows, sort_keys=True)}"
    )
    answer_response = call_oci_responses_api(answer_prompt, temperature, model, config)

    result["sql"] = sql
    result["rows"] = rows
    result["output"] = response_output_text(answer_response)
    result["rawResponse"] = {
        "sqlGeneration": response_to_json(sql_response),
        "answer": response_to_json(answer_response),
    }
    result["trace"] = [
        *trace,
        "Called OCI Responses API to generate SQL",
        "Validated SELECT-only SQL",
        f"Executed query against bundled sample database at {DB_PATH}",
        "Called OCI Responses API to summarize SQL results",
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
                    "feature": "NL2SQL / SQL Search",
                    "mode": "nl2sql-sql-search",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "documentation": DOCS_URL,
                    "request": {
                        "model": model,
                        "baseUrl": config["base_url"],
                        "project": config["project"] or "not configured",
                        "schema": SCHEMA.strip(),
                    },
                    "error": str(exc),
                    "trace": [
                        "Loaded SQL Search sample schema",
                        "Live OCI Responses API call was not completed",
                    ],
                }
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
