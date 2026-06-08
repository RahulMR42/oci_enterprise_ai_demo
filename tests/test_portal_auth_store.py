import json
import os
import subprocess
import sys
import tempfile
import unittest

from backend import portal_auth_store as store


class PortalAuthStoreCoreTests(unittest.TestCase):
    def test_normalize_email_requires_email_shape(self):
        self.assertEqual(store.normalize_email("  User.Name@Example.COM "), "user.name@example.com")
        with self.assertRaises(ValueError):
            store.normalize_email("not-an-email")

    def test_password_hash_uses_random_salts_and_constant_verification(self):
        first = store.hash_password("correct horse battery staple")
        second = store.hash_password("correct horse battery staple")
        self.assertEqual(first["hashAlgorithm"], "PBKDF2-HMAC-SHA256")
        self.assertGreaterEqual(first["hashIterations"], 210000)
        self.assertNotEqual(first["passwordSalt"], second["passwordSalt"])
        self.assertNotEqual(first["passwordHash"], second["passwordHash"])
        self.assertTrue(store.verify_password("correct horse battery staple", first))
        self.assertFalse(store.verify_password("wrong password value", first))

    def test_redact_details_removes_sensitive_values(self):
        details = store.redact_details({
            "featureId": "responses-api",
            "password": "plain",
            "nested": {"authorization": "Bearer secret-token", "status": "success"},
        })
        serialized = json.dumps(details)
        self.assertIn("responses-api", serialized)
        self.assertIn("success", serialized)
        self.assertNotIn("plain", serialized)
        self.assertNotIn("secret-token", serialized)

    def test_build_activity_filters_accepts_user_duration_feature_event_status(self):
        where, binds = store.build_activity_filters({
            "userEmail": "USER@EXAMPLE.COM",
            "from": "2026-06-08T00:00:00Z",
            "to": "2026-06-08T23:59:59Z",
            "featureId": "responses-api",
            "eventType": "demo_run",
            "status": "success",
        })
        self.assertIn("LOWER(user_email) = :user_email", where)
        self.assertIn("created_at >= TO_TIMESTAMP_TZ(:from_ts", where)
        self.assertIn("created_at <= TO_TIMESTAMP_TZ(:to_ts", where)
        self.assertEqual(binds["user_email"], "user@example.com")
        self.assertEqual(binds["feature_id"], "responses-api")
        self.assertEqual(binds["event_type"], "demo_run")
        self.assertEqual(binds["status"], "success")


class PortalAuthStoreCommandTests(unittest.TestCase):
    AUTH_ENV_KEYS = (
        "OCI_PORTAL_AUTH_DB_DSN",
        "OCI_PORTAL_AUTH_DB_USER",
        "OCI_PORTAL_AUTH_DB_PASSWORD",
        "OCI_PORTAL_AUTH_DB_PASSWORD_SECRET_ID",
    )

    def run_raw_command(self, payload, env=None):
        command_env = os.environ.copy()
        for key in self.AUTH_ENV_KEYS:
            command_env.pop(key, None)
        if env:
            command_env.update(env)

        result = subprocess.run(
            [sys.executable, "backend/portal_auth_store.py"],
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            check=False,
            env=command_env,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return result

    def run_command(self, payload, env=None):
        result = self.run_raw_command(payload, env=env)
        return json.loads(result.stdout)

    def test_status_reports_disabled_without_adb_env(self):
        response = self.run_command({"action": "status", "payload": {}})
        self.assertEqual(response["status"], "disabled")
        self.assertEqual(response["configured"], False)

    def test_status_reports_configured_with_adb_env(self):
        response = self.run_command(
            {"action": "status", "payload": {}},
            env={
                "OCI_PORTAL_AUTH_DB_DSN": "test_dsn",
                "OCI_PORTAL_AUTH_DB_USER": "ADMIN",
                "OCI_PORTAL_AUTH_DB_PASSWORD": "test_password",
            },
        )
        self.assertEqual(response["status"], "configured")
        self.assertEqual(response["configured"], True)

    def test_cli_errors_do_not_echo_secret_like_inputs(self):
        secret_action = "reset-Bearer-secret-token-value"
        secret_password = "plain-secret-password"
        secret_token = "secret-token-value-abcdef"

        with tempfile.NamedTemporaryFile() as handle:
            result = self.run_raw_command(
                {
                    "action": secret_action,
                    "payload": {
                        "password": secret_password,
                        "authorization": f"Bearer {secret_token}",
                    },
                },
                env={"OCI_PORTAL_AUTH_STORE_TEST_FILE": handle.name},
            )
        combined_output = result.stdout + result.stderr
        response = json.loads(result.stdout)

        self.assertEqual(response["status"], "failed")
        self.assertEqual(response["error"], "Unsupported auth store action.")
        self.assertNotIn(secret_action, combined_output)
        self.assertNotIn(secret_password, combined_output)
        self.assertNotIn(secret_token, combined_output)


class PortalAuthStoreLocalModeTests(unittest.TestCase):
    def run_local_command(self, path, action, payload):
        env = os.environ.copy()
        env["OCI_PORTAL_AUTH_STORE_TEST_FILE"] = path
        result = subprocess.run(
            [sys.executable, "backend/portal_auth_store.py"],
            input=json.dumps({"action": action, "payload": payload}),
            text=True,
            capture_output=True,
            check=False,
            env=env,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_signup_login_session_and_audit_workflow(self):
        with tempfile.NamedTemporaryFile() as handle:
            signup = self.run_local_command(handle.name, "signup", {
                "email": "User@Example.com",
                "password": "correct horse battery staple",
            })
            self.assertEqual(signup["status"], "success")
            self.assertEqual(signup["user"]["email"], "user@example.com")
            self.assertNotIn("password", json.dumps(signup).lower())

            duplicate = self.run_local_command(handle.name, "signup", {
                "email": "user@example.com",
                "password": "correct horse battery staple",
            })
            self.assertEqual(duplicate["status"], "failed")

            login = self.run_local_command(handle.name, "login", {
                "email": "USER@example.com",
                "password": "correct horse battery staple",
            })
            self.assertEqual(login["status"], "success")
            self.assertEqual(login["identity"]["authType"], "protected_user")
            self.assertEqual(login["identity"]["role"], "user")

            failed = self.run_local_command(handle.name, "login", {
                "email": "USER@example.com",
                "password": "wrong password value",
            })
            self.assertEqual(failed["status"], "failed")

            session = self.run_local_command(handle.name, "open_session", {
                "sessionToken": "browser-token",
                "identity": login["identity"],
                "ip": "203.0.113.10",
                "userAgent": "unit-test",
            })
            self.assertEqual(session["status"], "success")
            self.assertTrue(session["sessionId"].startswith("sess_"))

            event = self.run_local_command(handle.name, "record_event", {
                "sessionId": session["sessionId"],
                "identity": login["identity"],
                "eventType": "demo_run",
                "featureId": "responses-api",
                "action": "run",
                "status": "success",
                "durationMs": 42,
                "details": {"apiKey": "secret", "output": "ok"},
            })
            self.assertEqual(event["status"], "success")

            activity = self.run_local_command(handle.name, "query_activity", {
                "filters": {"userEmail": "user@example.com", "eventType": "demo_run"},
            })
            self.assertEqual(activity["status"], "success")
            self.assertEqual(activity["metrics"]["totalEvents"], 1)
            self.assertEqual(activity["events"][0]["featureId"], "responses-api")
            self.assertNotIn("secret", json.dumps(activity))


if __name__ == "__main__":
    unittest.main()
