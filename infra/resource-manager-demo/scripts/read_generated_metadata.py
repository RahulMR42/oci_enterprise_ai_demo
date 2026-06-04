#!/usr/bin/env python3
import json
import sys
from pathlib import Path


def main():
    try:
        query = json.load(sys.stdin)
    except Exception:
        query = {}

    generated_file_value = str(query.get("generated_file") or "")
    generated_file = Path(generated_file_value) if generated_file_value else None
    id_keys = [
        key.strip()
        for key in str(query.get("id_keys") or "id").split(",")
        if key.strip()
    ]

    payload = {}
    status = "missing"
    reason = ""

    if generated_file and generated_file.exists():
        try:
            payload = json.loads(generated_file.read_text(encoding="utf-8"))
            status = str(payload.get("status") or "loaded")
            reason = str(payload.get("reason") or "")
        except Exception as exc:
            status = "invalid"
            reason = type(exc).__name__

    generated_id = ""
    for key in id_keys:
        value = str(payload.get(key) or "").strip()
        if value:
            generated_id = value
            break

    print(json.dumps({
        "id": generated_id,
        "status": status,
        "reason": reason,
    }))


if __name__ == "__main__":
    main()
