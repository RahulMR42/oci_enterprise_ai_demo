#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class AgentHandler(BaseHTTPRequestHandler):
    server_version = "EnterpriseAIDemoHostedAgent/1.0"

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/.well-known/agent-card.json":
            self._send_json(
                200,
                {
                    "name": "Incident Response Agent",
                    "description": "Classifies checkout incidents and drafts customer-safe operational actions.",
                    "url": "/a2a/tasks",
                    "version": "1.0.0",
                    "capabilities": {"streaming": False, "pushNotifications": False},
                    "skills": [
                        {
                            "id": "incident-response",
                            "name": "Incident response",
                            "description": "Validate, classify, and draft actions for support incidents.",
                            "tags": ["incident", "support", "operations"],
                        }
                    ],
                },
            )
            return
        if self.path in {"/", "/health"}:
            self._send_json(
                200,
                {
                    "status": "healthy",
                    "service": "enterprise-ai-demo-hosted-agent",
                    "time": datetime.now(timezone.utc).isoformat(),
                },
            )
            return
        self._send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path not in {"/agent/incidents/respond", "/a2a/tasks"}:
            self._send_json(404, {"error": "not found"})
            return

        length = int(self.headers.get("content-length", "0") or "0")
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            payload = {}

        prompt = str(payload.get("prompt") or "No prompt provided.").strip()
        task_id = str(payload.get("id") or payload.get("taskId") or "incident-task")
        self._send_json(
            200,
            {
                "agent": "enterprise-ai-demo-hosted-agent",
                "id": task_id,
                "kind": "task",
                "status": "completed",
                "classification": "support-operations",
                "actions": [
                    {"name": "validate-request", "status": "completed"},
                    {"name": "classify-incident", "status": "completed"},
                    {"name": "draft-response", "status": "completed"},
                ],
                "response": (
                    "Incident response draft: acknowledge checkout delays, confirm investigation, "
                    "track customer impact, and provide the next update window."
                ),
                "artifacts": [
                    {
                        "name": "incident-response-plan",
                        "parts": [
                            {
                                "kind": "text",
                                "text": "Acknowledge checkout delays, identify impacted customers, and provide a next update window.",
                            }
                        ],
                    }
                ],
                "inputPreview": prompt[:160],
                "time": datetime.now(timezone.utc).isoformat(),
            },
        )

    def log_message(self, format, *args):
        print("%s - %s" % (self.address_string(), format % args), flush=True)


def main():
    port = int(os.getenv("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), AgentHandler)
    print(f"Enterprise AI demo hosted agent listening on {port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
