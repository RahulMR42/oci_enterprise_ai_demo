import io
import json
import os
import subprocess
import sys
import tempfile
import types
import unittest
import zipfile

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

    def test_safe_cli_error_redacts_sensitive_text(self):
        error = store.safe_cli_error(RuntimeError(
            "password=plain-secret-password authorization=Bearer secret-token-value-abcdef from 203.0.113.10"
        ))
        self.assertIn("Auth store command failed.: RuntimeError:", error)
        self.assertNotIn("plain-secret-password", error)
        self.assertNotIn("secret-token-value-abcdef", error)
        self.assertNotIn("203.0.113.10", error)

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
        "OCI_PORTAL_AUTH_DB_ID",
        "OCI_PORTAL_AUTH_DB_WALLET_DIR",
        "OCI_PORTAL_AUTH_DB_WALLET_PASSWORD",
        "OCI_PORTAL_AUTH_DB_WALLET_CACHE_DIR",
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

    def test_wallet_from_env_generates_and_reuses_cache(self):
        calls = []
        original_download_wallet = store.AdbStore._download_wallet

        def fake_download_wallet(database_id, wallet_password):
            calls.append((database_id, wallet_password))
            handle = io.BytesIO()
            with zipfile.ZipFile(handle, "w") as archive:
                archive.writestr("tnsnames.ora", "alias = descriptor")
                archive.writestr("sqlnet.ora", "wallet_location = .")
            return handle.getvalue()

        try:
            store.AdbStore._download_wallet = staticmethod(fake_download_wallet)
            with tempfile.TemporaryDirectory() as cache_dir:
                env = {
                    "OCI_PORTAL_AUTH_DB_ID": "ocid1.autonomousdatabase.oc1.example",
                    "OCI_PORTAL_AUTH_DB_WALLET_CACHE_DIR": cache_dir,
                }
                wallet_dir, wallet_password = store.AdbStore._wallet_from_env(env)
                reused_dir, reused_password = store.AdbStore._wallet_from_env(env)

                self.assertEqual(wallet_dir, cache_dir)
                self.assertEqual(reused_dir, cache_dir)
                self.assertEqual(wallet_password, reused_password)
                self.assertTrue(os.path.exists(os.path.join(cache_dir, "tnsnames.ora")))
                self.assertEqual(len(calls), 1)
                self.assertEqual(calls[0][0], env["OCI_PORTAL_AUTH_DB_ID"])
        finally:
            store.AdbStore._download_wallet = original_download_wallet

    def test_wallet_descriptor_dsn_uses_matching_tns_alias(self):
        calls = []
        original_oracledb = sys.modules.get("oracledb")
        descriptor = (
            "(description= (retry_count=20)(retry_delay=3)"
            "(address=(protocol=tcps)(port=1522)(host=adb.us-chicago-1.oraclecloud.com))"
            "(connect_data=(service_name=g7f11b42ea9546b_eadsqlfd2ed9_high.adb.oraclecloud.com))"
            "(security=(ssl_server_dn_match=yes)))"
        )

        class FakeOracleDb:
            @staticmethod
            def connect(**kwargs):
                calls.append(kwargs)
                return object()

        try:
            sys.modules["oracledb"] = FakeOracleDb
            with tempfile.TemporaryDirectory() as wallet_dir:
                with open(os.path.join(wallet_dir, "tnsnames.ora"), "w", encoding="utf-8") as handle:
                    handle.write(
                        "eadsqlfd2ed9_high = (description=(connect_data="
                        "(service_name=g7f11b42ea9546b_eadsqlfd2ed9_high.adb.oraclecloud.com)))\n\n"
                        "eadsqlfd2ed9_low = (description=(connect_data="
                        "(service_name=g7f11b42ea9546b_eadsqlfd2ed9_low.adb.oraclecloud.com)))\n"
                    )

                store.AdbStore(
                    user="ADMIN",
                    password="test-password",
                    dsn=descriptor,
                    wallet_dir=wallet_dir,
                    wallet_password="wallet-password",
                )

            self.assertEqual(calls[0]["dsn"], "eadsqlfd2ed9_high")
            self.assertEqual(calls[0]["config_dir"], wallet_dir)
            self.assertEqual(calls[0]["wallet_location"], wallet_dir)
            self.assertEqual(calls[0]["wallet_password"], "wallet-password")
        finally:
            if original_oracledb is None:
                sys.modules.pop("oracledb", None)
            else:
                sys.modules["oracledb"] = original_oracledb

    def test_resource_principal_clients_use_oci_region_config(self):
        calls = []
        original_modules = {
            name: sys.modules.get(name)
            for name in ("oci", "oci.database", "oci.database.models")
        }
        original_region = os.environ.get("OCI_REGION")

        class FakeSigners:
            @staticmethod
            def get_resource_principals_signer():
                return "fake-signer"

        class FakeSecretsClient:
            def __init__(self, config, signer):
                calls.append(("secrets", config, signer))

            def get_secret_bundle(self, secret_id):
                encoded = store.base64.b64encode(b"db-password").decode("ascii")
                content = types.SimpleNamespace(content=encoded)
                data = types.SimpleNamespace(secret_bundle_content=content)
                return types.SimpleNamespace(data=data)

        class FakeDatabaseClient:
            def __init__(self, config, signer):
                calls.append(("database", config, signer))

            def generate_autonomous_database_wallet(self, database_id, details):
                return types.SimpleNamespace(data=types.SimpleNamespace(data=b"wallet-bytes"))

        class FakeWalletDetails:
            GENERATE_TYPE_SINGLE = "SINGLE"

            def __init__(self, generate_type, password):
                self.generate_type = generate_type
                self.password = password

        fake_oci = types.ModuleType("oci")
        fake_database = types.ModuleType("oci.database")
        fake_models = types.ModuleType("oci.database.models")
        fake_oci.auth = types.SimpleNamespace(signers=FakeSigners)
        fake_oci.secrets = types.SimpleNamespace(SecretsClient=FakeSecretsClient)
        fake_oci.database = fake_database
        fake_database.DatabaseClient = FakeDatabaseClient
        fake_models.GenerateAutonomousDatabaseWalletDetails = FakeWalletDetails

        try:
            os.environ["OCI_REGION"] = "us-chicago-1"
            sys.modules["oci"] = fake_oci
            sys.modules["oci.database"] = fake_database
            sys.modules["oci.database.models"] = fake_models

            self.assertEqual(store.AdbStore._password_from_secret("secret-id"), "db-password")
            self.assertEqual(store.AdbStore._download_wallet("database-id", "wallet-password"), b"wallet-bytes")

            self.assertEqual(calls[0], ("secrets", {"region": "us-chicago-1"}, "fake-signer"))
            self.assertEqual(calls[1], ("database", {"region": "us-chicago-1"}, "fake-signer"))
        finally:
            if original_region is None:
                os.environ.pop("OCI_REGION", None)
            else:
                os.environ["OCI_REGION"] = original_region
            for name, original in original_modules.items():
                if original is None:
                    sys.modules.pop(name, None)
                else:
                    sys.modules[name] = original


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

    def test_init_schema_normalizes_local_json_structure(self):
        with tempfile.NamedTemporaryFile(mode="w+", encoding="utf-8") as handle:
            json.dump({"users": [{"email": "user@example.com"}], "sessions": "bad"}, handle)
            handle.flush()

            response = self.run_local_command(handle.name, "init_schema", {})

            self.assertEqual(response["status"], "success")
            self.assertEqual(response["schema"], "local-json")
            handle.seek(0)
            data = json.load(handle)
            self.assertEqual(data["users"], [{"email": "user@example.com"}])
            self.assertEqual(data["sessions"], [])
            self.assertEqual(data["events"], [])

    def test_private_actions_are_rejected_without_mutating_local_json(self):
        original = {"users": [], "sessions": [], "events": [{"event_type": "original"}]}
        with tempfile.NamedTemporaryFile(mode="w+", encoding="utf-8") as handle:
            json.dump(original, handle)
            handle.flush()

            response = self.run_local_command(handle.name, "_save", {
                "users": [{"email": "attacker@example.com"}],
                "sessions": [],
                "events": [],
            })

            self.assertIsInstance(response, dict)
            self.assertEqual(response["status"], "failed")
            self.assertEqual(response["error"], "Unsupported auth store action.")
            handle.seek(0)
            self.assertEqual(json.load(handle), original)

    def test_record_event_redacts_client_details_in_storage_and_activity(self):
        raw_ip = "203.0.113.10"
        raw_message_ip = "198.51.100.7"
        raw_user_agent = "UnitTestBrowser/1.0"
        raw_session_token = "browser-session-token-value"
        raw_password = "plain-secret-password"

        with tempfile.NamedTemporaryFile(mode="w+", encoding="utf-8") as handle:
            event = self.run_local_command(handle.name, "record_event", {
                "sessionId": "sess_redaction",
                "identity": {
                    "userId": "usr_redaction",
                    "userEmail": "redaction@example.com",
                    "role": "user",
                },
                "eventType": "demo_run",
                "featureId": "responses-api",
                "action": "run",
                "status": "success",
                "durationMs": 17,
                "details": {
                    "ip": raw_ip,
                    "userAgent": raw_user_agent,
                    "sessionToken": raw_session_token,
                    "password": raw_password,
                    "message": f"request originated from {raw_message_ip}",
                    "output": "ok",
                },
            })
            self.assertEqual(event["status"], "success")

            handle.seek(0)
            persisted = json.load(handle)
            persisted_text = json.dumps(persisted)
            self.assertNotIn(raw_ip, persisted_text)
            self.assertNotIn(raw_message_ip, persisted_text)
            self.assertNotIn(raw_user_agent, persisted_text)
            self.assertNotIn(raw_session_token, persisted_text)
            self.assertNotIn(raw_password, persisted_text)
            self.assertIn("ok", persisted_text)

            activity = self.run_local_command(handle.name, "query_activity", {
                "filters": {"userEmail": "redaction@example.com", "eventType": "demo_run"},
            })
            activity_text = json.dumps(activity)
            self.assertEqual(activity["metrics"]["totalEvents"], 1)
            self.assertNotIn(raw_ip, activity_text)
            self.assertNotIn(raw_message_ip, activity_text)
            self.assertNotIn(raw_user_agent, activity_text)
            self.assertNotIn(raw_session_token, activity_text)
            self.assertNotIn(raw_password, activity_text)
            self.assertIn("ok", activity_text)

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
