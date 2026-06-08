#!/usr/bin/env python3
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sys
from datetime import datetime, timezone

HASH_ALGORITHM = "PBKDF2-HMAC-SHA256"
HASH_ITERATIONS = 210_000
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SENSITIVE_KEY_PATTERN = re.compile(
    r"secret|password|passwd|passphrase|token|authorization|api[_-]?key|client[_-]?secret|credential|private[_-]?key|cookie|session|jwt|bearer",
    re.IGNORECASE,
)


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_email(value):
    email = str(value or "").strip().lower()
    if not EMAIL_PATTERN.match(email):
        raise ValueError("Enter a valid email address.")
    return email


def hash_password(password, salt=None, iterations=HASH_ITERATIONS):
    raw_password = str(password or "")
    if len(raw_password) < 12:
        raise ValueError("Password must be at least 12 characters.")
    raw_salt = salt or secrets.token_bytes(24)
    if isinstance(raw_salt, str):
        raw_salt = base64.b64decode(raw_salt.encode("utf-8"))
    digest = hashlib.pbkdf2_hmac("sha256", raw_password.encode("utf-8"), raw_salt, int(iterations))
    return {
        "hashAlgorithm": HASH_ALGORITHM,
        "hashIterations": int(iterations),
        "passwordSalt": base64.b64encode(raw_salt).decode("ascii"),
        "passwordHash": base64.b64encode(digest).decode("ascii"),
    }


def verify_password(password, record):
    candidate = hash_password(
        password,
        salt=record["passwordSalt"],
        iterations=int(record["hashIterations"]),
    )
    return hmac.compare_digest(candidate["passwordHash"], record["passwordHash"])


def redact_details(value):
    if isinstance(value, list):
        return [redact_details(item) for item in value]
    if isinstance(value, dict):
        redacted = {}
        for key, item in value.items():
            redacted[str(key)] = "<redacted>" if SENSITIVE_KEY_PATTERN.search(str(key)) else redact_details(item)
        return redacted
    if isinstance(value, str):
        return re.sub(r"(bearer\s+)[A-Za-z0-9._~+/=-]{12,}", r"\1<redacted>", value, flags=re.IGNORECASE)
    return value


def build_activity_filters(filters):
    clauses = []
    binds = {}
    if filters.get("userEmail"):
        clauses.append("LOWER(user_email) = :user_email")
        binds["user_email"] = normalize_email(filters["userEmail"])
    if filters.get("from"):
        clauses.append("created_at >= TO_TIMESTAMP_TZ(:from_ts, 'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM')")
        binds["from_ts"] = str(filters["from"]).replace("Z", "+00:00")
    if filters.get("to"):
        clauses.append("created_at <= TO_TIMESTAMP_TZ(:to_ts, 'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM')")
        binds["to_ts"] = str(filters["to"]).replace("Z", "+00:00")
    if filters.get("featureId"):
        clauses.append("feature_id = :feature_id")
        binds["feature_id"] = str(filters["featureId"])
    if filters.get("eventType"):
        clauses.append("event_type = :event_type")
        binds["event_type"] = str(filters["eventType"])
    if filters.get("status"):
        clauses.append("status = :status")
        binds["status"] = str(filters["status"])
    return (" AND ".join(clauses) if clauses else "1 = 1", binds)


def configured_from_env(env=os.environ):
    return bool(env.get("OCI_PORTAL_AUTH_DB_DSN") and env.get("OCI_PORTAL_AUTH_DB_USER") and (
        env.get("OCI_PORTAL_AUTH_DB_PASSWORD") or env.get("OCI_PORTAL_AUTH_DB_PASSWORD_SECRET_ID")
    ))


def handle_status():
    configured = configured_from_env()
    return {
        "ok": True,
        "configured": configured,
        "status": "configured" if configured else "disabled",
        "source": "nl2sql-autonomous-database" if configured else "not-configured",
    }


def handle_command(command):
    action = command.get("action") or ""
    if action == "status":
        return handle_status()
    raise ValueError(f"Unsupported auth store action: {action}")


def main():
    try:
        command = json.loads(sys.stdin.read() or "{}")
        response = handle_command(command)
        print(json.dumps(response, separators=(",", ":")))
    except Exception as exc:
        print(json.dumps({"ok": False, "status": "failed", "error": str(exc)}, separators=(",", ":")))
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
