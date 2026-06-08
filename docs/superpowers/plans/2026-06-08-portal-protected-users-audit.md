# Portal Protected Users and Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password protected users with salted password hashes in the existing NL2SQL Autonomous Database, preserve the default `oci` login, and expose user-aware audit logs for logins, demo runs, hosted launches, duration, and status.

**Architecture:** Keep `server.mjs` as the HTTP/session/UI process and add a focused Python command helper for Autonomous Database auth/audit operations. Resource Manager passes the NL2SQL ADB connection string, DB user, and password secret OCID into the DevOps portal deployment; the portal uses resource principal to fetch the secret at runtime. Server sessions carry identity metadata so demo logs, hosted launches, and admin queries can be correlated by user.

**Tech Stack:** Node.js built-in HTTP server, Python `python-oracledb` thin mode, OCI Python SDK/resource principal, Oracle Autonomous Database, OCI Vault secrets, Terraform Resource Manager, OCI DevOps, Node test runner, Python unittest.

---

## File Structure

- Create `backend/portal_auth_store.py`: command helper for hashing, signup, login, sessions, audit writes, and activity queries against the NL2SQL Autonomous Database.
- Create `tests/test_portal_auth_store.py`: Python unit tests for password hashing, email normalization, redaction, SQL filter construction, and local command behavior without live ADB.
- Modify `requirements.txt`: add `oracledb>=2.5.0`.
- Modify `server.mjs`: add identity/session helpers, protected signup/login, auth store command calls, audit writes, admin role checks, run identity attribution, and audit-aware admin summaries.
- Modify `tests/provisioning.test.js`: add coverage for bootstrap `oci` compatibility, protected identity sessions, signup route, admin role enforcement, audit helper redaction, and run history identity fields.
- Modify `admin.html`: add compact user/date/feature/event filters in the existing Logs panel.
- Modify `src/admin.js`: send filter query parameters, render user/event fields, and keep client-side status/source filtering.
- Modify `src/styles.css`: style the compact admin filter row without adding nested cards.
- Modify `infra/nl2sql-sql-search/outputs.tf`: expose the NL2SQL ADB connection string and DB username for portal wiring.
- Modify `infra/devops-hosted-image-build/variables.tf`: add portal auth DB variables.
- Modify `infra/devops-hosted-image-build/main.tf`: pass portal auth DB variables into the deploy-portal stage.
- Modify `infra/devops-hosted-image-build/scripts/deploy_portal_container.sh`: inject auth DB env vars into the portal container.
- Modify `infra/resource-manager-demo/main.tf`: pass NL2SQL module outputs to the DevOps module.
- Modify `infra/resource-manager-demo/outputs.tf`: expose non-sensitive portal auth DB wiring state.
- Modify `tests/terraformInfra.test.js`: verify the NL2SQL ADB is reused and the DevOps container env wiring exists.
- Modify `change-log.json`, `package.json`, `package-lock.json`, `src/version.json`, `index.html`, and `admin.html`: bump version and record the feature.

## Task 1: Python Auth Store Core

**Files:**
- Create: `backend/portal_auth_store.py`
- Create: `tests/test_portal_auth_store.py`
- Modify: `requirements.txt`

- [ ] **Step 1: Write failing tests for hashing, normalization, and redaction**

Add `tests/test_portal_auth_store.py`:

```python
import json
import subprocess
import sys
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
    def run_command(self, payload):
        result = subprocess.run(
            [sys.executable, "backend/portal_auth_store.py"],
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_status_reports_disabled_without_adb_env(self):
        response = self.run_command({"action": "status", "payload": {}})
        self.assertEqual(response["status"], "disabled")
        self.assertEqual(response["configured"], False)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests and verify they fail before implementation**

Run:

```bash
python3 -m unittest tests/test_portal_auth_store.py -v
```

Expected: failure importing `backend.portal_auth_store`.

- [ ] **Step 3: Add the auth store helper with pure functions and disabled status command**

Create `backend/portal_auth_store.py` with these exported functions and command entry point:

```python
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
```

Add to `requirements.txt`:

```text
oracledb>=2.5.0
```

- [ ] **Step 4: Run tests and verify the core passes**

Run:

```bash
python3 -m unittest tests/test_portal_auth_store.py -v
```

Expected: all tests in `tests/test_portal_auth_store.py` pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add backend/portal_auth_store.py tests/test_portal_auth_store.py requirements.txt
git commit -m "Add portal auth store core"
```

## Task 2: Autonomous Database Store Actions

**Files:**
- Modify: `backend/portal_auth_store.py`
- Modify: `tests/test_portal_auth_store.py`

- [ ] **Step 1: Add failing Python tests for command actions using a temporary SQLite-backed test mode**

Extend `tests/test_portal_auth_store.py` with:

```python
import os
import tempfile


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
```

- [ ] **Step 2: Run tests and verify command actions fail**

Run:

```bash
python3 -m unittest tests/test_portal_auth_store.py -v
```

Expected: failures for unsupported actions such as `signup`.

- [ ] **Step 3: Implement local test mode and ADB action interface**

In `backend/portal_auth_store.py`, add:

```python
def hmac_digest(value):
    key = os.environ.get("OCI_PORTAL_SESSION_HASH_KEY") or "enterprise-ai-demo-session-hash"
    return hmac.new(key.encode("utf-8"), str(value or "").encode("utf-8"), hashlib.sha256).hexdigest()


def public_identity(row):
    return {
        "userId": row["user_id"],
        "userEmail": row["email"],
        "displayEmail": row.get("display_email") or row["email"],
        "authType": "protected_user",
        "role": row.get("role") or "user",
    }
```

Add a `LocalJsonStore` class for unit tests only when `OCI_PORTAL_AUTH_STORE_TEST_FILE` is set. It stores a JSON object with top-level `users`, `sessions`, and `events` arrays in that file. Its methods must have these exact effects:

- `signup(payload)`: normalize `payload.email`, reject duplicates, hash `payload.password`, append an active user with role `user`, append a `signup` audit event, and return `{ "status": "success", "user": public_user, "identity": public_identity }`.
- `login(payload)`: normalize `payload.email`, find an active user, verify the password hash, update `last_login_at` on success, append either `login` or `login_failed`, and return `{ "status": "success", "identity": public_identity }` or `{ "status": "failed", "error": "Invalid email or password." }`.
- `open_session(payload)`: create a `sess_` id, store only HMAC hashes of `payload.sessionToken`, IP, and user agent, append a session row, and return `{ "status": "success", "sessionId": session_id }`.
- `close_session(payload)`: mark the matching HMAC session token row `logged_out`, append a `logout` event, and return `{ "status": "success" }`.
- `record_event(payload)`: append a redacted audit event with `event_id`, `session_id`, `user_email`, `event_type`, `feature_id`, `action`, `status`, `duration_ms`, and `details`, then return `{ "status": "success", "eventId": event_id }`.
- `query_activity(payload)`: apply `build_activity_filters(payload.filters)` semantics to the local event list and return `{ "status": "success", "metrics": { "totalEvents": count }, "events": events }`.

Use the same method names in an `AdbStore` class. `AdbStore` must:

- lazily import `oracledb` only when ADB mode is used,
- fetch `OCI_PORTAL_AUTH_DB_PASSWORD_SECRET_ID` with `oci.secrets.SecretsClient` and resource principal when `OCI_PORTAL_AUTH_DB_PASSWORD` is absent,
- connect with `oracledb.connect(user=user, password=password, dsn=dsn)`,
- create `PORTAL_PROTECTED_USERS`, `PORTAL_AUTH_SESSIONS`, and `PORTAL_AUDIT_EVENTS` idempotently by checking `USER_TABLES`,
- commit after mutating actions.

Update `handle_command()` to dispatch:

```python
def store_for_env():
    test_file = os.environ.get("OCI_PORTAL_AUTH_STORE_TEST_FILE")
    if test_file:
        return LocalJsonStore(test_file)
    if configured_from_env():
        return AdbStore.from_env()
    return None


def handle_command(command):
    action = command.get("action") or ""
    payload = command.get("payload") or {}
    if action == "status":
        return handle_status()
    store = store_for_env()
    if store is None:
        return {"ok": False, "status": "disabled", "error": "Portal protected-user auth store is not configured."}
    if not hasattr(store, action):
        raise ValueError(f"Unsupported auth store action: {action}")
    return getattr(store, action)(payload)
```

- [ ] **Step 4: Run Python auth store tests**

Run:

```bash
python3 -m unittest tests/test_portal_auth_store.py -v
```

Expected: all auth store tests pass.

- [ ] **Step 5: Commit Task 2**

```bash
git add backend/portal_auth_store.py tests/test_portal_auth_store.py
git commit -m "Add portal auth store actions"
```

## Task 3: Server Identity, Signup, and Login

**Files:**
- Modify: `server.mjs`
- Modify: `tests/provisioning.test.js`

- [ ] **Step 1: Write failing Node tests for identity sessions and signup route surface**

In `tests/provisioning.test.js`, update the import list to include:

```js
  bootstrapPortalIdentity,
  createPortalSessionForIdentity,
  resolvePortalIdentity,
  callPortalAuthStore,
  isAdminIdentity,
```

Add tests:

```js
test("portal sessions resolve bootstrap and protected-user identities", () => {
  const sessions = new Set();
  const identities = new Map();
  const protectedIdentity = {
    userId: "usr_123",
    userEmail: "user@example.com",
    authType: "protected_user",
    role: "user"
  };
  const token = createPortalSessionForIdentity(protectedIdentity, sessions, identities);
  const resolved = resolvePortalIdentity(
    { headers: { cookie: `oci_portal_session=${token}` } },
    { password: "test-password", sessions, sessionIdentities: identities }
  );

  assert.deepEqual(resolved, protectedIdentity);
  assert.equal(isAuthorizedRequest({ headers: { cookie: `oci_portal_session=${token}` } }, "test-password", sessions, identities), true);
  assert.equal(isAdminIdentity(resolved), false);
  assert.equal(isAdminIdentity(bootstrapPortalIdentity()), true);
});

test("server exposes signup route and protected auth store command", () => {
  const server = readFileSync("server.mjs", "utf8");

  assert.match(server, /requestPath === "\/signup"/);
  assert.match(server, /callPortalAuthStore/);
  assert.match(server, /backend\/portal_auth_store\.py/);
  assert.match(server, /createPortalSessionForIdentity/);
  assert.match(server, /resolvePortalIdentity/);
  assert.match(server, /Protected user sign-up/);
});
```

- [ ] **Step 2: Run the targeted Node test and verify failure**

Run:

```bash
node --test tests/provisioning.test.js
```

Expected: import or assertion failures for missing identity helpers and signup route.

- [ ] **Step 3: Implement identity/session helpers and auth store command caller**

In `server.mjs`, replace the session-only helpers with:

```js
const portalSessionIdentities = new Map();
const portalAuthStoreScript = process.env.OCI_PORTAL_AUTH_STORE_SCRIPT || join(root, "backend/portal_auth_store.py");

export function bootstrapPortalIdentity() {
  return {
    userId: "bootstrap:oci",
    userEmail: portalAuthUser,
    displayEmail: portalAuthUser,
    authType: "bootstrap",
    role: "admin"
  };
}

export function isAdminIdentity(identity = {}) {
  return identity.role === "admin" || identity.authType === "bootstrap";
}

export function createPortalSession(sessions = portalSessionTokens) {
  const token = randomBytes(18).toString("base64url");
  sessions.add(token);
  return token;
}

export function createPortalSessionForIdentity(identity = bootstrapPortalIdentity(), sessions = portalSessionTokens, sessionIdentities = portalSessionIdentities) {
  const token = createPortalSession(sessions);
  sessionIdentities.set(token, identity);
  return token;
}

export function resolvePortalIdentity(request, { password = portalAuthPassword, sessions = portalSessionTokens, sessionIdentities = portalSessionIdentities } = {}) {
  const sessionToken = parseCookies(request.headers.cookie || "")[portalSessionCookie];
  if (sessionToken && sessions.has(sessionToken)) {
    return sessionIdentities.get(sessionToken) || bootstrapPortalIdentity();
  }

  const credentials = parseBasicAuthHeader(request.headers.authorization || "");
  if (credentials?.username === portalAuthUser && credentials.password === password) {
    return bootstrapPortalIdentity();
  }

  return null;
}

export function isAuthorizedRequest(request, password = portalAuthPassword, sessions = portalSessionTokens, sessionIdentities = portalSessionIdentities) {
  return Boolean(resolvePortalIdentity(request, { password, sessions, sessionIdentities }));
}

export function callPortalAuthStore(action, payload = {}, { env = process.env } = {}) {
  const result = spawnSync(pythonExecutable, [portalAuthStoreScript], {
    cwd: root,
    encoding: "utf8",
    env: demoProcessEnv(env),
    input: JSON.stringify({ action, payload })
  });
  if (result.status !== 0) {
    return { ok: false, status: "failed", error: result.stderr || `Auth store command failed with status ${result.status}` };
  }
  try {
    return JSON.parse(result.stdout || "{}");
  } catch (error) {
    return { ok: false, status: "failed", error: `Auth store returned invalid JSON: ${error.message}` };
  }
}
```

- [ ] **Step 4: Add signup UI and route**

Update `renderLoginPage()` so it includes both the existing sign-in form and this signup form:

```html
      <form method="post" action="/signup" aria-label="Protected user sign-up">
        <label>
          Email
          <input name="email" type="email" autocomplete="email" />
        </label>
        <label>
          Password
          <input name="password" type="password" autocomplete="new-password" minlength="12" />
        </label>
        <button type="submit">Sign up</button>
      </form>
```

Add a `POST /signup` route before the authorization gate:

```js
  if (request.method === "POST" && requestPath === "/signup") {
    const body = await readRequestBody(request);
    const form = new URLSearchParams(body);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const signup = callPortalAuthStore("signup", { email, password });
    if (signup.status === "success" && signup.identity) {
      const token = createPortalSessionForIdentity(signup.identity);
      callPortalAuthStore("open_session", {
        sessionToken: token,
        identity: signup.identity,
        ip: request.socket?.remoteAddress || "",
        userAgent: request.headers["user-agent"] || ""
      });
      response.writeHead(302, {
        Location: "/",
        "Set-Cookie": sessionCookie(token),
        "Cache-Control": "no-store"
      });
      response.end();
      return;
    }
    sendLoginPage(response, 400, { error: signup.error || "Protected user sign-up is unavailable." });
    return;
  }
```

Update `POST /login` so `oci` uses the existing password and non-`oci` usernames call:

```js
    const protectedLogin = callPortalAuthStore("login", { email: username, password });
    if (protectedLogin.status === "success" && protectedLogin.identity) {
      const token = createPortalSessionForIdentity(protectedLogin.identity);
      callPortalAuthStore("open_session", {
        sessionToken: token,
        identity: protectedLogin.identity,
        ip: request.socket?.remoteAddress || "",
        userAgent: request.headers["user-agent"] || ""
      });
      response.writeHead(302, {
        Location: "/",
        "Set-Cookie": sessionCookie(token),
        "Cache-Control": "no-store"
      });
      response.end();
      return;
    }
```

Preserve the existing `oci` branch:

```js
    if (username === portalAuthUser && password === portalAuthPassword) {
      const token = createPortalSessionForIdentity(bootstrapPortalIdentity());
      response.writeHead(302, {
        Location: "/",
        "Set-Cookie": sessionCookie(token),
        "Cache-Control": "no-store"
      });
      response.end();
      return;
    }
```

- [ ] **Step 5: Close sessions on logout**

In the logout route, before deleting the token:

```js
      const identity = portalSessionIdentities.get(sessionToken) || bootstrapPortalIdentity();
      callPortalAuthStore("close_session", { sessionToken, identity });
      portalSessionIdentities.delete(sessionToken);
```

- [ ] **Step 6: Run targeted tests**

Run:

```bash
node --test tests/provisioning.test.js
```

Expected: tests pass.

- [ ] **Step 7: Commit Task 3**

```bash
git add server.mjs tests/provisioning.test.js
git commit -m "Add protected user login flow"
```

## Task 4: Demo and Hosted Launch Audit Attribution

**Files:**
- Modify: `server.mjs`
- Modify: `tests/provisioning.test.js`

- [ ] **Step 1: Write failing tests for identity in run summaries and audit helper redaction**

Add to `tests/provisioning.test.js`:

```js
test("demo run history includes redacted user identity metadata", () => {
  const history = summarizeDemoRunHistory([
    {
      featureId: "responses-api",
      status: "success",
      durationMs: 100,
      createdAt: "2026-06-08T12:00:00.000Z",
      userId: "usr_123",
      userEmail: "user@example.com",
      authType: "protected_user",
      sessionId: "sess_123",
      request: { password: "secret", prompt: "hello" }
    }
  ]);

  assert.equal(history.runs[0].userEmail, "user@example.com");
  assert.equal(history.runs[0].authType, "protected_user");
  assert.equal(history.runs[0].sessionId, "sess_123");
  assert.equal(JSON.stringify(history).includes("secret"), false);
});

test("server records audit events for demo runs and hosted launches", () => {
  const server = readFileSync("server.mjs", "utf8");

  assert.match(server, /recordPortalAuditEvent/);
  assert.match(server, /eventType: "demo_run"/);
  assert.match(server, /eventType: "hosted_launch"/);
  assert.match(server, /runFeatureDemo\(runMatch\[1\], payload, \{ identity/);
});
```

- [ ] **Step 2: Run targeted tests and verify failure**

Run:

```bash
node --test tests/provisioning.test.js
```

Expected: assertions fail because identity fields and audit helper are absent.

- [ ] **Step 3: Add identity metadata helpers and audit writer**

In `server.mjs`, add:

```js
function identityLogFields(identity = bootstrapPortalIdentity(), sessionId = "") {
  return {
    userId: identity.userId || "",
    userEmail: identity.userEmail || identity.displayEmail || "",
    authType: identity.authType || "unknown",
    sessionId
  };
}

function recordPortalAuditEvent(event = {}) {
  try {
    const result = callPortalAuthStore("record_event", {
      ...event,
      details: redactForDemoLog(event.details || {})
    });
    if (result.status === "failed") {
      console.warn(`[portal-audit] ${redactSensitiveText(result.error || "audit write failed")}`);
    }
    return result;
  } catch (error) {
    console.warn(`[portal-audit] ${redactSensitiveText(error.message)}`);
    return { ok: false, status: "failed", error: error.message };
  }
}
```

Update `summarizeDemoRunHistory()` run mapping:

```js
      userId: record.userId || "",
      userEmail: record.userEmail || "",
      authType: record.authType || "",
      sessionId: record.sessionId || "",
```

- [ ] **Step 4: Thread identity through demo runs**

Change signature:

```js
export function runFeatureDemo(featureId, payload, { identity = bootstrapPortalIdentity(), sessionId = "" } = {}) {
```

When calling `writeDemoLog()`, include:

```js
          ...identityLogFields(identity, sessionId),
```

After each success or failure result is known, call:

```js
recordPortalAuditEvent({
  sessionId,
  identity,
  eventType: "demo_run",
  featureId,
  action: "run",
  status,
  durationMs,
  details: { request: payload, logFile: parsed.logFile || runError.payload?.logFile || "" }
});
```

In the HTTP route, compute:

```js
      const identity = resolvePortalIdentity(request) || bootstrapPortalIdentity();
      const sessionId = parseCookies(request.headers.cookie || "")[portalSessionCookie] || "";
      const result = await runFeatureDemo(runMatch[1], payload, { identity, sessionId });
```

- [ ] **Step 5: Audit hosted launches**

Update `proxyLangfuseLaunch`, `proxyOpenClawLaunch`, `proxyLlamaIndexControlTowerLaunch`, and `proxyHostedApplicationLaunch` to accept an options object:

```js
async function proxyLangfuseLaunch(request, response, parsedUrl, { identity = bootstrapPortalIdentity(), sessionId = "" } = {}) {
```

At the end of each proxy path, call `recordPortalAuditEvent()` with:

```js
recordPortalAuditEvent({
  sessionId,
  identity,
  eventType: "hosted_launch",
  featureId: "langfuse-hosted-observability",
  action: request.method,
  status: upstream.ok ? "success" : "failed",
  durationMs,
  details: { path: parsedUrl.pathname, upstreamStatus: upstream.status }
});
```

Use the matching feature id for OpenClaw, LlamaIndex, and generic hosted launch routes.

- [ ] **Step 6: Run targeted tests**

Run:

```bash
node --test tests/provisioning.test.js
```

Expected: tests pass.

- [ ] **Step 7: Commit Task 4**

```bash
git add server.mjs tests/provisioning.test.js
git commit -m "Audit portal activity by user"
```

## Task 5: Admin Authorization, Activity Filters, and UI

**Files:**
- Modify: `server.mjs`
- Modify: `admin.html`
- Modify: `src/admin.js`
- Modify: `src/styles.css`
- Modify: `tests/provisioning.test.js`
- Modify: `tests/features.test.js`

- [ ] **Step 1: Add failing tests for admin role guard and filter UI**

Add to `tests/provisioning.test.js`:

```js
test("server guards administration APIs with admin identity", () => {
  const server = readFileSync("server.mjs", "utf8");

  assert.match(server, /requireAdminIdentity/);
  assert.match(server, /requestPath\.startsWith\("\/api\/admin\/"\)/);
  assert.match(server, /sendJson\(response, 403/);
  assert.match(server, /parseAdminActivityFilters/);
});
```

Add to `tests/features.test.js` in the admin route test:

```js
  assert.match(adminHtml, /admin-user-filter/);
  assert.match(adminHtml, /admin-event-type-filter/);
  assert.match(adminHtml, /admin-from-filter/);
  assert.match(adminHtml, /admin-to-filter/);
  assert.match(admin, /URLSearchParams/);
  assert.match(admin, /userEmail/);
  assert.match(admin, /eventType/);
```

- [ ] **Step 2: Run targeted tests and verify failure**

Run:

```bash
node --test tests/provisioning.test.js tests/features.test.js
```

Expected: missing admin guard and filter UI assertions fail.

- [ ] **Step 3: Add admin guard and filter parsing**

In `server.mjs`, add:

```js
function requireAdminIdentity(request, response, identity) {
  if (isAdminIdentity(identity)) {
    return true;
  }
  if ((request.url || "").startsWith("/api/admin/")) {
    sendJson(response, 403, { status: "forbidden", error: "Administrator access is required." });
  } else {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    response.end("Administrator access is required.");
  }
  return false;
}

function parseAdminActivityFilters(searchParams) {
  return {
    userEmail: String(searchParams.get("userEmail") || "").trim(),
    from: String(searchParams.get("from") || "").trim(),
    to: String(searchParams.get("to") || "").trim(),
    featureId: String(searchParams.get("featureId") || "").trim(),
    eventType: String(searchParams.get("eventType") || "").trim(),
    status: String(searchParams.get("status") || "").trim()
  };
}
```

After the auth gate, add:

```js
  const identity = resolvePortalIdentity(request) || bootstrapPortalIdentity();
  const sessionId = parseCookies(request.headers.cookie || "")[portalSessionCookie] || "";

  if ((requestPath === "/admin.html" || requestPath.startsWith("/api/admin/")) && !requireAdminIdentity(request, response, identity)) {
    return;
  }
```

Update admin API handlers:

```js
      const filters = parseAdminActivityFilters(parsedUrl.searchParams);
      sendJson(response, 200, readDemoRunHistory(filters));
```

and:

```js
      const filters = parseAdminActivityFilters(parsedUrl.searchParams);
      sendJson(response, 200, readAdminLogSummary(filters));
```

- [ ] **Step 4: Merge ADB audit events into admin summaries**

Add:

```js
function readPortalAuditActivity(filters = {}) {
  const result = callPortalAuthStore("query_activity", { filters });
  return result.status === "success" ? result : { status: "unavailable", metrics: {}, events: [] };
}
```

In `readAdminLogSummary(filters = {})`, convert audit events into log rows:

```js
  const activity = readPortalAuditActivity(filters);
  const auditLogs = (Array.isArray(activity.events) ? activity.events : []).map((event) => redactForDemoLog({
    source: "audit",
    name: event.featureId || event.eventType || "portal",
    status: event.status || "unknown",
    createdAt: event.createdAt || "",
    path: event.userEmail || "",
    sizeBytes: 0,
    preview: JSON.stringify({
      userEmail: event.userEmail || "",
      eventType: event.eventType || "",
      action: event.action || "",
      durationMs: event.durationMs || 0,
      details: event.details || {}
    }, null, 2)
  }));
```

Merge `auditLogs` with existing logs and add `{ name: "audit", count: auditLogs.length }` to sources.

- [ ] **Step 5: Add compact admin filters**

In `admin.html`, add controls inside `.admin-filter-row`:

```html
                <label>
                  <span>User</span>
                  <input id="admin-user-filter" type="email" placeholder="user@example.com" aria-label="Filter logs by user email" />
                </label>
                <label>
                  <span>From</span>
                  <input id="admin-from-filter" type="datetime-local" aria-label="Filter logs from time" />
                </label>
                <label>
                  <span>To</span>
                  <input id="admin-to-filter" type="datetime-local" aria-label="Filter logs to time" />
                </label>
                <label>
                  <span>Event</span>
                  <select id="admin-event-type-filter" aria-label="Filter logs by event type">
                    <option value="all">All</option>
                    <option value="signup">Signup</option>
                    <option value="login">Login</option>
                    <option value="login_failed">Login failed</option>
                    <option value="logout">Logout</option>
                    <option value="demo_run">Demo run</option>
                    <option value="hosted_launch">Hosted launch</option>
                    <option value="admin_query">Admin query</option>
                  </select>
                </label>
```

In `src/admin.js`, add:

```js
function adminActivityQuery() {
  const params = new URLSearchParams();
  const userEmail = document.getElementById("admin-user-filter")?.value.trim() || "";
  const from = document.getElementById("admin-from-filter")?.value || "";
  const to = document.getElementById("admin-to-filter")?.value || "";
  const eventType = document.getElementById("admin-event-type-filter")?.value || "all";
  if (userEmail) params.set("userEmail", userEmail);
  if (from) params.set("from", new Date(from).toISOString());
  if (to) params.set("to", new Date(to).toISOString());
  if (eventType !== "all") params.set("eventType", eventType);
  const query = params.toString();
  return query ? `?${query}` : "";
}
```

Change fetches:

```js
      fetchJson(`/api/admin/demo-runs${adminActivityQuery()}`),
      fetchJson(`/api/admin/logs${adminActivityQuery()}`),
```

Add event listeners:

```js
["admin-user-filter", "admin-from-filter", "admin-to-filter", "admin-event-type-filter"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", loadAdministrationDashboard);
});
```

In `src/styles.css`, extend `.admin-run-log-heading input` with the same sizing as selects.

- [ ] **Step 6: Run targeted tests**

Run:

```bash
node --test tests/provisioning.test.js tests/features.test.js
```

Expected: targeted tests pass.

- [ ] **Step 7: Commit Task 5**

```bash
git add server.mjs admin.html src/admin.js src/styles.css tests/provisioning.test.js tests/features.test.js
git commit -m "Add user activity filters to administration"
```

## Task 6: Resource Manager and DevOps ADB Wiring

**Files:**
- Modify: `infra/nl2sql-sql-search/outputs.tf`
- Modify: `infra/devops-hosted-image-build/variables.tf`
- Modify: `infra/devops-hosted-image-build/main.tf`
- Modify: `infra/devops-hosted-image-build/scripts/deploy_portal_container.sh`
- Modify: `infra/resource-manager-demo/main.tf`
- Modify: `infra/resource-manager-demo/outputs.tf`
- Modify: `tests/terraformInfra.test.js`

- [ ] **Step 1: Write failing Terraform contract tests**

Add to `tests/terraformInfra.test.js`:

```js
test("portal protected users reuse the nl2sql autonomous database", () => {
  const nl2sqlOutputs = read("infra/nl2sql-sql-search/outputs.tf");
  const resourceManagerMain = read("infra/resource-manager-demo/main.tf");
  const devopsVariables = read("infra/devops-hosted-image-build/variables.tf");
  const devopsMain = read("infra/devops-hosted-image-build/main.tf");
  const deployScript = read("infra/devops-hosted-image-build/scripts/deploy_portal_container.sh");

  assert.match(nl2sqlOutputs, /output "autonomous_database_connection_string"/);
  assert.match(nl2sqlOutputs, /value\s+=\s+local\.sql_search_connection_string/);
  assert.match(nl2sqlOutputs, /output "database_user_name"/);
  assert.match(resourceManagerMain, /portal_auth_db_dsn\s+=\s+module\.nl2sql_sql_search\.autonomous_database_connection_string/);
  assert.match(resourceManagerMain, /portal_auth_db_user\s+=\s+module\.nl2sql_sql_search\.database_user_name/);
  assert.match(resourceManagerMain, /portal_auth_db_password_secret_id\s+=\s+module\.nl2sql_sql_search\.database_password_secret_id/);
  assert.match(devopsVariables, /variable "portal_auth_db_dsn"/);
  assert.match(devopsVariables, /variable "portal_auth_db_password_secret_id"/);
  assert.match(devopsMain, /PORTAL_AUTH_DB_DSN/);
  assert.match(devopsMain, /PORTAL_AUTH_DB_PASSWORD_SECRET_ID/);
  assert.match(deployScript, /OCI_PORTAL_AUTH_DB_DSN/);
  assert.match(deployScript, /OCI_PORTAL_AUTH_DB_PASSWORD_SECRET_ID/);
  assert.doesNotMatch(resourceManagerMain, /module "portal_auth_database"/);
});
```

- [ ] **Step 2: Run Terraform contract tests and verify failure**

Run:

```bash
node --test tests/terraformInfra.test.js
```

Expected: missing output and variable assertions fail.

- [ ] **Step 3: Add NL2SQL module outputs**

In `infra/nl2sql-sql-search/outputs.tf`, add:

```hcl
output "autonomous_database_connection_string" {
  description = "TLS connection string for the NL2SQL Autonomous Database reused by the portal auth store."
  value       = local.sql_search_connection_string
}

output "database_user_name" {
  description = "Database user name for Database Tools and portal auth store access."
  value       = var.database_user_name
}
```

- [ ] **Step 4: Add DevOps variables and environment items**

In `infra/devops-hosted-image-build/variables.tf`, add:

```hcl
variable "portal_auth_db_dsn" {
  description = "NL2SQL Autonomous Database connection string used by portal protected-user auth."
  type        = string
  default     = ""
}

variable "portal_auth_db_user" {
  description = "NL2SQL Autonomous Database user for portal protected-user auth."
  type        = string
  default     = "ADMIN"
}

variable "portal_auth_db_password_secret_id" {
  description = "OCI Vault secret OCID containing the NL2SQL Autonomous Database password."
  type        = string
  sensitive   = true
  default     = ""
}
```

In `infra/devops-hosted-image-build/main.tf`, add build stage parameters near existing portal settings:

```hcl
    items {
      name  = "PORTAL_AUTH_DB_DSN"
      value = var.portal_auth_db_dsn
    }
    items {
      name  = "PORTAL_AUTH_DB_USER"
      value = var.portal_auth_db_user
    }
    items {
      name  = "PORTAL_AUTH_DB_PASSWORD_SECRET_ID"
      value = var.portal_auth_db_password_secret_id
    }
```

- [ ] **Step 5: Inject container env vars in the deploy script**

In `infra/devops-hosted-image-build/scripts/deploy_portal_container.sh`, add to the Python `env = {}` map:

```python
    "OCI_PORTAL_AUTH_STORE_MODE": "adb" if os.environ.get("PORTAL_AUTH_DB_DSN") else "",
    "OCI_PORTAL_AUTH_DB_DSN": os.environ.get("PORTAL_AUTH_DB_DSN", ""),
    "OCI_PORTAL_AUTH_DB_USER": os.environ.get("PORTAL_AUTH_DB_USER", "ADMIN"),
    "OCI_PORTAL_AUTH_DB_PASSWORD_SECRET_ID": os.environ.get("PORTAL_AUTH_DB_PASSWORD_SECRET_ID", ""),
```

- [ ] **Step 6: Pass NL2SQL outputs from Resource Manager to DevOps**

In `infra/resource-manager-demo/main.tf`, add module inputs:

```hcl
  portal_auth_db_dsn                = module.nl2sql_sql_search.autonomous_database_connection_string
  portal_auth_db_user               = module.nl2sql_sql_search.database_user_name
  portal_auth_db_password_secret_id = module.nl2sql_sql_search.database_password_secret_id
```

In `infra/resource-manager-demo/outputs.tf`, add:

```hcl
output "portal_auth_database_id" {
  description = "NL2SQL Autonomous Database reused by the portal protected-user auth store."
  value       = module.nl2sql_sql_search.autonomous_database_id
}

output "portal_auth_database_name" {
  description = "NL2SQL Autonomous Database name reused by the portal protected-user auth store."
  value       = module.nl2sql_sql_search.autonomous_database_name
}
```

- [ ] **Step 7: Run Terraform contract tests and formatting**

Run:

```bash
node --test tests/terraformInfra.test.js
terraform -chdir=infra/nl2sql-sql-search fmt
terraform -chdir=infra/devops-hosted-image-build fmt
terraform -chdir=infra/resource-manager-demo fmt
```

Expected: tests pass and Terraform fmt exits 0.

- [ ] **Step 8: Commit Task 6**

```bash
git add infra/nl2sql-sql-search/outputs.tf infra/devops-hosted-image-build/variables.tf infra/devops-hosted-image-build/main.tf infra/devops-hosted-image-build/scripts/deploy_portal_container.sh infra/resource-manager-demo/main.tf infra/resource-manager-demo/outputs.tf tests/terraformInfra.test.js
git commit -m "Wire portal auth to nl2sql autonomous database"
```

## Task 7: Version, Changelog, Full Verification, and Deployment

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/version.json`
- Modify: `index.html`
- Modify: `admin.html`
- Modify: `change-log.json`

- [ ] **Step 1: Bump portal version**

Run:

```bash
npm run version:set -- 0.0.26
```

Update `index.html` and `admin.html` asset query strings from `v=0.0.25` to `v=0.0.26`.

- [ ] **Step 2: Add changelog entry**

Prepend this entry to `change-log.json`:

```json
{
  "version": "0.0.26",
  "releasedAt": "2026-06-08T00:00:00Z",
  "localTime": "2026-06-08T00:00:00+0530",
  "summary": "Add protected users and user-aware audit logs backed by the NL2SQL Autonomous Database.",
  "changes": [
    "The default oci bootstrap credentials remain available for admin login and deployment smoke tests.",
    "Protected users can sign up and sign in with email/password credentials stored as salted hashes in the existing NL2SQL Autonomous Database.",
    "Demo runs and hosted UI launches now record user identity, event type, status, and duration for administration filtering.",
    "Resource Manager and DevOps pass NL2SQL Autonomous Database connection metadata into the portal container without creating a second database.",
    "Portal and administration assets now use version 0.0.26."
  ]
}
```

Replace the timestamps with the actual UTC and local timestamps at implementation time before committing.

- [ ] **Step 3: Run full local verification**

Run:

```bash
python3 -m unittest tests/test_portal_auth_store.py -v
node --test
npm run build
env/bin/python -m py_compile backend/portal_auth_store.py
terraform -chdir=infra/nl2sql-sql-search validate
terraform -chdir=infra/devops-hosted-image-build validate
terraform -chdir=infra/resource-manager-demo validate
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 4: Commit Task 7**

```bash
git add package.json package-lock.json src/version.json index.html admin.html change-log.json
git commit -m "Prepare protected users portal release"
```

- [ ] **Step 5: Push and deploy through Resource Manager**

Run:

```bash
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u no_proxy -u NO_PROXY git push origin HEAD:oci-rms
```

Create a new Resource Manager stack package and apply job using variables derived from the current commit:

```bash
COMMIT_SHORT="$(git rev-parse --short HEAD)"
STACK_PACKAGE="/tmp/enterprise-ai-demo-resource-manager-stack-${COMMIT_SHORT}.zip"
zip -qr "$STACK_PACKAGE" . -x '.git/*' 'node_modules/*' 'release/*'
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u no_proxy -u NO_PROXY env/bin/oci resource-manager stack update --stack-id ocid1.ormstack.oc1.us-chicago-1.amaaaaaafigrwqyadgf4o2ktscpeex2o2bsrh4d2q2zzfvtgkkc7he63guwa --config-source "$STACK_PACKAGE" --force
JOB_JSON="$(env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u no_proxy -u NO_PROXY env/bin/oci resource-manager job create-apply-job --stack-id ocid1.ormstack.oc1.us-chicago-1.amaaaaaafigrwqyadgf4o2ktscpeex2o2bsrh4d2q2zzfvtgkkc7he63guwa --display-name "enterprise-ai-demo-portal-0.0.26-${COMMIT_SHORT}")"
NEW_JOB_ID="$(printf '%s' "$JOB_JSON" | node -e 'let s=""; process.stdin.on("data", c => s += c); process.stdin.on("end", () => console.log(JSON.parse(s).data.id));')"
printf '%s\n' "$NEW_JOB_ID" > /tmp/enterprise-ai-demo-portal-0.0.26-job-id.txt
```

Keep secrets out of terminal output and use the existing stack variables already stored on the stack.

- [ ] **Step 6: Verify live deployment**

Run these checks with the portal password read from the existing local vars file and never printed:

```bash
NEW_JOB_ID="$(cat /tmp/enterprise-ai-demo-portal-0.0.26-job-id.txt)"
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u no_proxy -u NO_PROXY env/bin/oci resource-manager job get --job-id "$NEW_JOB_ID"
NEW_BUILD_RUN_ID="$(env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u no_proxy -u NO_PROXY env/bin/oci resource-manager job get --job-id "$NEW_JOB_ID" --query 'data."apply-job-plan-resolution"."build-run-id"' --raw-output)"
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u no_proxy -u NO_PROXY env/bin/oci devops build-run get --build-run-id "$NEW_BUILD_RUN_ID"
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u no_proxy -u NO_PROXY env/bin/oci lb backend list --load-balancer-id ocid1.loadbalancer.oc1.us-chicago-1.aaaaaaaazbz5oy7uffihka5xz5iluyicw3y4a3ebngn4gasrzvpnspxztt4a --backend-set-name portal-backend --all
curl --noproxy '*' --silent --show-error --max-time 30 --netrc-file /tmp/portal-smoke.netrc http://207.211.186.38/login
curl --noproxy '*' --silent --show-error --max-time 30 --netrc-file /tmp/portal-smoke.netrc http://207.211.186.38/api/admin/logs
```

Expected:

- RMS job lifecycle state is `SUCCEEDED`.
- DevOps build run lifecycle state is `SUCCEEDED`.
- Active load balancer backend points to the new container private IP and health is `OK`.
- `/login` returns HTTP 200.
- `/api/admin/logs` returns audit/log JSON for the `oci` admin path.

## Self-Review Checklist

- Spec coverage: tasks cover protected signup/signin, salted hashes, default `oci`, NL2SQL ADB reuse, audit logs, admin filters, version/changelog, and RMS deployment.
- Test coverage: Python tests cover credential safety and command actions; Node tests cover server identity, admin role checks, UI contracts, and Terraform wiring.
- Rollout safety: `oci` Basic Auth remains available for smoke tests and protected-user ADB failures do not block bootstrap admin access.
