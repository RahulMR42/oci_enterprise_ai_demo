import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  bootstrapPortalIdentity,
  callPortalAuthStore,
  createResourceSuffix,
  createPortalSession,
  createPortalSessionForIdentity,
  devopsHostedDeploymentComponents,
  extractProvisionedValues,
  fileSearchRuntimeComponents,
  hasAllRequiredTerraformResources,
  mergeInfrastructureComponents,
  parseBasicAuthHeader,
  parseCookies,
  parseTerraformStateResources,
  demoProcessEnv,
  isAdminIdentity,
  isAuthorizedRequest,
  resolvePortalIdentity,
  idcsDemoCredentialPosture,
  hostedLaunchProxyTargetUrl,
  llamaIndexControlTowerProxyTargetUrl,
  sharedResponsesDemoComponents,
  summarizeInfrastructureState,
  normalizeProvisionConfig,
  rewriteLangfuseLaunchJson,
  rewriteLangfuseLaunchHtml,
  proxyResponseHeaders,
  resolvePayloadHostedRuntime,
  hostedRuntimeUrl,
  hostedApplicationIdFromInvokeUrl,
  readAdminLogSummary,
  resolvePortalAuthPasswordValue,
  resolveSecretReferenceValue,
  safeEnvironmentSnapshot,
  selectHostedRuntimeCandidate,
  summarizeAdminInfrastructureState,
  summarizeDemoRunHistory
} from "../server.mjs";
import * as serverModule from "../server.mjs";

test("normalizes provisioning config with OCI defaults", () => {
  const config = normalizeProvisionConfig({});

  assert.equal(config.compartmentId, "ocid1.compartment.oc1..aaaaaaaazx44wly3e4yextfibunmi2bgoibkdupj2opadokvllf4scgaybmq");
  assert.equal(config.region, "us-chicago-1");
  assert.equal(config.profile, "DEFAULT");
  assert.equal(config.resourceSuffix, "");
  assert.equal(config.projectDisplayName, "enterprise-ai-demo-responses-api");
});

test("creates a six character resource suffix", () => {
  assert.match(createResourceSuffix(), /^[a-z0-9]{6}$/);
});

test("protects portal requests with login session and username oci", () => {
  const authorization = `Basic ${Buffer.from("oci:test-password").toString("base64")}`;
  const sessions = new Set();
  const identities = new Map();
  const token = createPortalSessionForIdentity(bootstrapPortalIdentity(), sessions, identities);

  assert.deepEqual(parseBasicAuthHeader(authorization), {
    username: "oci",
    password: "test-password"
  });
  assert.equal(parseCookies(`oci_portal_session=${token}`).oci_portal_session, token);
  assert.equal(isAuthorizedRequest({ headers: { cookie: `oci_portal_session=${token}` } }, "test-password", sessions, identities), true);
  assert.equal(isAuthorizedRequest({ headers: { authorization } }, "test-password"), true);
  assert.equal(isAuthorizedRequest({ headers: { authorization } }, "different-password"), false);
  assert.equal(isAuthorizedRequest({ headers: {} }, "test-password", sessions), false);
});

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

test("unmapped portal session tokens do not authorize as admin", () => {
  const sessions = new Set();
  const identities = new Map();
  const token = createPortalSession(sessions);
  const request = { headers: { cookie: `oci_portal_session=${token}` } };
  const resolved = resolvePortalIdentity(request, {
    password: "test-password",
    sessions,
    sessionIdentities: identities
  });

  assert.equal(resolved, null);
  assert.equal(isAuthorizedRequest(request, "test-password", sessions, identities), false);
  assert.equal(isAdminIdentity(resolved), false);
});

test("auth store command failures return generic client-safe errors", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "portal-auth-store-"));
  const nonzeroScript = join(tempDir, "nonzero.py");
  const invalidJsonScript = join(tempDir, "invalid-json.py");
  const logs = [];
  const originalError = console.error;

  writeFileSync(
    nonzeroScript,
    [
      "import sys",
      "print('password=raw-stdout-secret')",
      "print('client_secret=raw-stderr-secret', file=sys.stderr)",
      "sys.exit(2)",
      ""
    ].join("\n")
  );
  writeFileSync(invalidJsonScript, "print('password=raw-json-secret')\n");
  console.error = (...args) => logs.push(args.join(" "));

  try {
    const nonzero = callPortalAuthStore(
      "login",
      { email: "user@example.com", password: "request-password-secret" },
      { env: process.env, script: nonzeroScript }
    );
    const invalidJson = callPortalAuthStore("login", {}, { env: process.env, script: invalidJsonScript });
    const clientOutput = JSON.stringify([nonzero, invalidJson]);

    assert.equal(nonzero.status, "failed");
    assert.equal(invalidJson.status, "failed");
    assert.equal(nonzero.error, invalidJson.error);
    assert.match(nonzero.error, /authentication is unavailable/i);
    assert.doesNotMatch(clientOutput, /raw-stdout-secret|raw-stderr-secret|raw-json-secret|request-password-secret/);
    assert.doesNotMatch(logs.join("\n"), /raw-stdout-secret|raw-stderr-secret|raw-json-secret|request-password-secret/);
  } finally {
    console.error = originalError;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("server exposes login, forgot password, and logout routes", () => {
  const server = readFileSync("server.mjs", "utf8");
  const gitignore = readFileSync(".gitignore", "utf8");

  assert.match(server, /requestPath === "\/login"/);
  assert.match(server, /requestPath === "\/forgot-password"/);
  assert.match(server, /requestPath === "\/logout"/);
  assert.match(server, /clearSessionCookie/);
  assert.match(server, /portalSessionTokens\.delete/);
  assert.match(server, /portalAuthPasswordFile/);
  assert.match(server, /resolvePortalAuthPassword/);
  assert.match(server, /OCI_PORTAL_PASSWORD_FILE/);
  assert.match(server, /writeFileSync\(filePath, `\$\{value\}\\n`, \{ mode: 0o600 \}\)/);
  assert.match(gitignore, /^\.oci-portal-password$/m);
});

test("portal auth password from environment does not write a local secret file", () => {
  const persistedSecrets = [];
  const result = resolvePortalAuthPasswordValue({
    passwordFile: "/read-only/.oci-portal-password",
    envPassword: " vault-password ",
    exists: () => false,
    persist: (...args) => persistedSecrets.push(args),
    generate: () => {
      throw new Error("environment password should not generate a fallback password");
    }
  });

  assert.deepEqual(result, { password: "vault-password", source: "env" });
  assert.deepEqual(persistedSecrets, []);
});

test("portal auth password resolves Vault secret references before use", () => {
  const persistedSecrets = [];
  const result = resolvePortalAuthPasswordValue({
    passwordFile: "/read-only/.oci-portal-password",
    envPassword: " ocid1.vaultsecret.oc1.us-chicago-1.testsecret ",
    exists: () => false,
    persist: (...args) => persistedSecrets.push(args),
    resolveSecret: (value) => {
      assert.equal(value, "ocid1.vaultsecret.oc1.us-chicago-1.testsecret");
      return "resolved-vault-password";
    }
  });

  assert.deepEqual(result, { password: "resolved-vault-password", source: "env" });
  assert.deepEqual(persistedSecrets, []);
});

test("Vault secret references resolve through a cache-backed fetcher", () => {
  const calls = [];
  const cache = new Map();
  const fetchSecret = (secretId) => {
    calls.push(secretId);
    return "secret-value";
  };

  assert.equal(
    resolveSecretReferenceValue(" ocid1.vaultsecret.oc1.us-chicago-1.testsecret ", { cache, fetchSecret }),
    "secret-value"
  );
  assert.equal(resolveSecretReferenceValue("ocid1.vaultsecret.oc1.us-chicago-1.testsecret", { cache, fetchSecret }), "secret-value");
  assert.equal(resolveSecretReferenceValue("plain-value", { cache, fetchSecret }), "plain-value");
  assert.deepEqual(calls, ["ocid1.vaultsecret.oc1.us-chicago-1.testsecret"]);
});

test("server exposes unauthenticated readiness responses for hosted runtimes", async () => {
  const app = serverModule.server;
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = app.address();
    const rootResponse = await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual" });
    const healthResponse = await fetch(`http://127.0.0.1:${port}/health`, { redirect: "manual" });

    assert.equal(rootResponse.status, 200);
    const rootHtml = await rootResponse.text();
    assert.match(rootHtml, /OCI Enterprise AI Portal Login/);
    assert.match(rootHtml, /action="\.\/login"/);
    assert.doesNotMatch(rootHtml, /action="\//);
    assert.equal(healthResponse.status, 200);
    assert.deepEqual(await healthResponse.json(), { status: "ok" });
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("server uses document-relative redirects for hosted runtime paths", async () => {
  const app = serverModule.server;
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = app.address();
    const protectedResponse = await fetch(`http://127.0.0.1:${port}/admin.html`, { redirect: "manual" });
    const logoutResponse = await fetch(`http://127.0.0.1:${port}/logout`, {
      method: "POST",
      redirect: "manual"
    });

    assert.equal(protectedResponse.status, 302);
    assert.equal(protectedResponse.headers.get("location"), "./login");
    assert.equal(logoutResponse.status, 302);
    assert.equal(logoutResponse.headers.get("location"), "./login");
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("browser entrypoints use relative URLs for hosted invoke prefixes", () => {
  const index = readFileSync("index.html", "utf8");
  const adminHtml = readFileSync("admin.html", "utf8");
  const main = readFileSync("src/main.js", "utf8");
  const admin = readFileSync("src/admin.js", "utf8");

  assert.match(index, /href="\.\/src\/styles\.css/);
  assert.match(index, /src="\.\/src\/main\.js/);
  assert.doesNotMatch(index, /\b(?:href|src)="\//);
  assert.match(adminHtml, /href="\.\/src\/styles\.css/);
  assert.match(adminHtml, /src="\.\/src\/admin\.js/);
  assert.match(adminHtml, /href="\.\/"/);
  assert.doesNotMatch(adminHtml, /\b(?:href|src)="\//);
  assert.doesNotMatch(main, /(?:href|action)="\/(?:admin\.html|logout)|window\.open\("\/admin\.html"|fetch\(`\/api|fetch\("\/api|launchUrl: "\/api/);
  assert.doesNotMatch(admin, /fetchJson\(`\/api|fetchJson\("\/api|fetch\(`\/api|fetch\("\/api/);
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

test("server exposes redacted administration demo run history", () => {
  const server = readFileSync("server.mjs", "utf8");
  const history = summarizeDemoRunHistory([
    {
      featureId: "responses-api",
      status: "success",
      durationMs: 1200,
      createdAt: "2026-05-27T10:00:00.000Z",
      request: { apiKey: "secret-api-key", prompt: "hello" },
      stdout: "ok"
    },
    {
      featureId: "responses-api",
      status: "failed",
      durationMs: 800,
      createdAt: "2026-05-27T10:02:00.000Z",
      error: "boom",
      request: { clientSecret: "secret-client" },
      stderr: "stack"
    },
    {
      featureId: "guardrails",
      status: "success",
      durationMs: 500,
      createdAt: "2026-05-27T10:03:00.000Z"
    }
  ]);

  assert.equal(history.metrics.totalRuns, 3);
  assert.equal(history.metrics.successfulRuns, 2);
  assert.equal(history.metrics.failedRuns, 1);
  assert.equal(history.metrics.averageDurationMs, 833);
  assert.equal(history.demos.find((demo) => demo.featureId === "responses-api").runs, 2);
  assert.equal(history.demos.find((demo) => demo.featureId === "responses-api").lastStatus, "failed");
  assert.equal(JSON.stringify(history).includes("secret-api-key"), false);
  assert.equal(JSON.stringify(history).includes("secret-client"), false);
  assert.match(server, /requestPath === "\/api\/admin\/demo-runs"/);
  assert.match(server, /readDemoRunHistory/);
  assert.match(server, /writePersistentDemoRunRecord/);
  assert.match(server, /portalRunHistoryObject/);
  assert.match(server, /OCI_PORTAL_RUN_HISTORY_OBJECT/);
});

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

test("portal audit session ids use public ids instead of raw cookie tokens", () => {
  const rawCookieToken = "raw-cookie-token-password=super-secret-token";
  const publicSessionId = "sess_public123";
  const request = {
    headers: {
      cookie: `oci_portal_session=${encodeURIComponent(rawCookieToken)}`
    }
  };
  const sessionAuditIds = new Map([[rawCookieToken, publicSessionId]]);
  const sessionId = serverModule.portalAuditSessionIdForRequest?.(request, { sessionAuditIds }) || "";
  const history = summarizeDemoRunHistory([
    {
      featureId: "responses-api",
      status: "success",
      durationMs: 100,
      createdAt: "2026-06-08T12:00:00.000Z",
      userId: "usr_123",
      userEmail: "user@example.com",
      authType: "protected_user",
      sessionId,
      request: { password: rawCookieToken, prompt: "hello" }
    }
  ]);
  const rawSessionHistory = summarizeDemoRunHistory([
    {
      featureId: "responses-api",
      status: "success",
      durationMs: 100,
      createdAt: "2026-06-08T12:00:00.000Z",
      sessionId: rawCookieToken,
      request: { prompt: "hello" }
    }
  ]);

  assert.equal(sessionId, publicSessionId);
  assert.equal(history.runs[0].sessionId, publicSessionId);
  assert.equal(JSON.stringify(history).includes(rawCookieToken), false);
  assert.equal(rawSessionHistory.runs[0].sessionId, "");
  assert.equal(JSON.stringify(rawSessionHistory).includes(rawCookieToken), false);
});

test("server records audit events for demo runs and hosted launches", () => {
  const server = readFileSync("server.mjs", "utf8");

  assert.match(server, /recordPortalAuditEvent/);
  assert.match(server, /eventType: "demo_run"/);
  assert.match(server, /eventType: "hosted_launch"/);
  assert.match(server, /runFeatureDemo\(runMatch\[1\], payload, \{ identity/);
});

test("server stores public audit session ids returned by open_session", () => {
  const server = readFileSync("server.mjs", "utf8");

  assert.match(server, /const portalSessionAuditIds = new Map\(\)/);
  assert.match(server, /storePortalSessionAuditId\(token, .*openSession/);
  assert.match(server, /portalAuditSessionIdForRequest\(request\)/);
  assert.match(server, /portalSessionAuditIds\.delete\(sessionToken\)/);
  assert.doesNotMatch(server, /const sessionId = parseCookies\(request\.headers\.cookie \|\| ""\)\[portalSessionCookie\] \|\| ""/);
});

test("server guards administration APIs with admin identity", () => {
  const server = readFileSync("server.mjs", "utf8");

  assert.match(server, /requireAdminIdentity/);
  assert.match(server, /accessControlPath\.startsWith\("\/api\/admin\/"\)/);
  assert.match(server, /sendJson\(response, 403/);
  assert.match(server, /parseAdminActivityFilters/);
});

test("server normalizes encoded administration paths before access control", () => {
  const server = readFileSync("server.mjs", "utf8");
  const normalizePath = serverModule.normalizedRequestPathForAccessControl;

  assert.equal(typeof normalizePath, "function");
  assert.equal(normalizePath("/%61dmin.html"), "/admin.html");
  assert.equal(normalizePath("/admin%2ehtml"), "/admin.html");
  assert.equal(normalizePath("/api%2Fadmin%2Flogs"), "/api/admin/logs");
  assert.equal(normalizePath("api/admin/logs"), "/api/admin/logs");
  assert.equal(normalizePath("/%E0%A4%A"), "/%E0%A4%A");
  assert.match(server, /const accessControlPath = normalizedRequestPathForAccessControl\(requestPath\)/);
  assert.match(server, /accessControlPath === "\/admin\.html"/);
  assert.match(server, /accessControlPath\.startsWith\("\/api\/admin\/"\)/);
});

test("portal audit helper returns sanitized failures without leaking details", () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const result = serverModule.recordPortalAuditEvent?.(
      {
        eventType: "demo_run",
        details: { password: "super-secret-token" }
      },
      {
        writeEvent: () => {
          throw new Error("password=super-secret-token");
        }
      }
    );

    assert.equal(result?.status, "failed");
    assert.equal(result?.error, "Portal audit write failed.");
    assert.equal(JSON.stringify(result).includes("super-secret-token"), false);
  } finally {
    console.warn = originalWarn;
  }
});

test("server exposes non-secret runtime environment variables for administration", () => {
  const server = readFileSync("server.mjs", "utf8");
  const admin = readFileSync("src/admin.js", "utf8");
  const html = readFileSync("admin.html", "utf8");
  const snapshot = safeEnvironmentSnapshot({
    OCI_GENAI_REGION: "us-chicago-1",
    OCI_HOSTED_APP_IDCS_DOMAIN_URL: "https://idcs.example.com",
    OCI_HOSTED_APP_IDCS_CLIENT_SECRET: "secret-client",
    OCI_GENAI_API_KEY: "secret-api-key",
    OCI_PORTAL_PASSWORD: "portal-password",
    PATH: "/usr/bin"
  });

  assert.deepEqual(
    snapshot.variables.map((entry) => entry.key),
    ["OCI_GENAI_REGION", "OCI_HOSTED_APP_IDCS_DOMAIN_URL", "PATH"]
  );
  assert.equal(snapshot.hiddenCount, 3);
  assert.equal(JSON.stringify(snapshot).includes("secret-client"), false);
  assert.equal(JSON.stringify(snapshot).includes("secret-api-key"), false);
  assert.equal(JSON.stringify(snapshot).includes("portal-password"), false);
  assert.match(server, /requestPath === "\/api\/admin\/runtime-env"/);
  assert.match(admin, /\/api\/admin\/runtime-env/);
  assert.match(html, /admin-runtime-env/);
});

test("administration exposes object-storage backed portal change log", () => {
  const server = readFileSync("server.mjs", "utf8");
  const admin = readFileSync("src/admin.js", "utf8");
  const html = readFileSync("admin.html", "utf8");
  const terraform = readFileSync("infra/resource-manager-demo/portal_container.tf", "utf8");
  const moduleMain = readFileSync("infra/resource-manager-demo/main.tf", "utf8");
  const devopsMain = readFileSync("infra/devops-hosted-image-build/main.tf", "utf8");
  const devopsVariables = readFileSync("infra/devops-hosted-image-build/variables.tf", "utf8");
  const portalScript = readFileSync("infra/devops-hosted-image-build/scripts/deploy_portal_hosted_application.sh", "utf8");
  const changeLog = JSON.parse(readFileSync("change-log.json", "utf8"));

  assert.equal(changeLog.name, "OCI Enterprise AI Portal Change Log");
  assert.ok(Array.isArray(changeLog.entries));
  assert.ok(changeLog.entries.some((entry) => /launch/i.test(entry.summary || "")));
  assert.match(server, /portalChangeLogObject/);
  assert.match(server, /readPortalChangeLog/);
  assert.match(server, /requestPath === "\/api\/admin\/change-log"/);
  assert.match(server, /OCI_PORTAL_CHANGE_LOG_OBJECT/);
  assert.match(admin, /\/api\/admin\/change-log/);
  assert.match(admin, /renderChangeLog/);
  assert.match(html, /admin-tab-changes/);
  assert.match(html, /admin-panel-changes/);
  assert.match(html, /admin-change-log/);
  assert.match(terraform, /resource "oci_objectstorage_object" "portal_change_log"/);
  assert.match(terraform, /portal-change-log\.json/);
  assert.match(terraform, /file\("\$\{path\.module\}\/\.\.\/\.\.\/change-log\.json"\)/);
  assert.match(moduleMain, /portal_change_log_namespace/);
  assert.match(moduleMain, /portal_change_log_object\s+=\s+"portal-change-log\.json"/);
  assert.match(devopsMain, /PORTAL_CHANGE_LOG_NAMESPACE/);
  assert.match(devopsVariables, /variable "portal_change_log_object"/);
  assert.match(portalScript, /OCI_PORTAL_CHANGE_LOG_OBJECT/);
});

test("server exposes redacted administration infrastructure and logs", () => {
  const server = readFileSync("server.mjs", "utf8");
  const admin = readFileSync("src/admin.js", "utf8");
  const html = readFileSync("admin.html", "utf8");
  const infra = summarizeAdminInfrastructureState({
    status: "created",
    values: {
      projectId: "ocid1.generativeaiproject.example",
      apiKeyAvailable: true
    },
    components: [
      {
        address: "oci_artifacts_container_repository.portal[0]",
        name: "Portal Repository",
        status: "created",
        value: "enterprise-ai-demo/portal-rm"
      },
      {
        address: "terraform_data.example",
        name: "Generated Example",
        status: "created",
        value: "client_secret=very-sensitive"
      }
    ],
    logs: [
      {
        label: "state",
        status: "success",
        stdout: "token=very-sensitive",
        stderr: "ok"
      }
    ]
  });

  assert.equal(infra.summary.totalResources, 2);
  assert.equal(infra.schema.resourceTypes.some((item) => item.type === "oci_artifacts_container_repository"), true);
  assert.equal(JSON.stringify(infra).includes("very-sensitive"), false);
  assert.match(server, /requestPath === "\/api\/admin\/infra"/);
  assert.match(server, /requestPath === "\/api\/admin\/logs"/);
  assert.match(server, /readAdminLogSummary/);
  assert.match(server, /summarizeAdminInfrastructureState/);
  assert.match(server, /redactSensitiveText/);
  assert.match(admin, /\/api\/admin\/infra/);
  assert.match(admin, /\/api\/admin\/logs/);
  assert.match(html, /admin-panel-infra/);
  assert.match(html, /admin-panel-logs/);
});

test("administration run history keeps failure details available for troubleshooting", () => {
  const history = summarizeDemoRunHistory([
    {
      featureId: "langfuse-hosted-observability",
      action: "launch",
      status: "failed",
      durationMs: 42,
      createdAt: "2026-06-01T09:48:48.630Z",
      error: "IDCS token request failed",
      request: {
        method: "GET",
        path: "/api/langfuse/launch/auth/sign-in",
        headers: { authorization: "Bearer secret-token" }
      },
      diagnostics: {
        stage: "idcs-token",
        config: { clientSecretConfigured: true }
      },
      upstream: {
        target: "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/example/actions/invoke/auth/sign-in"
      },
      stack: "Error: IDCS token request failed\n    at getIdcsAccessToken"
    }
  ]);

  const run = history.runs[0];
  assert.equal(run.error, "IDCS token request failed");
  assert.equal(run.diagnostics.stage, "idcs-token");
  assert.equal(run.upstream.target.includes("/auth/sign-in"), true);
  assert.equal(JSON.stringify(run).includes("secret-token"), false);
});

test("demo run log persistence keeps bucket history when local files are unavailable", () => {
  const records = [];
  const warnings = [];
  assert.equal(typeof serverModule.writeDemoLog, "function");
  const logFile = serverModule.writeDemoLog(
    "responses-api",
    {
      status: "success",
      durationMs: 321,
      request: { apiKey: "secret-api-key", prompt: "hello" },
      stdout: "ok"
    },
    {
      mkdir: () => {
        throw new Error("EROFS: read-only file system, mkdir '/app/logs'");
      },
      writePersistentRecord: (record) => records.push(record),
      warn: (message) => warnings.push(message),
      now: () => new Date("2026-06-10T10:00:00.000Z"),
      randomHex: () => "abcd1234"
    }
  );

  assert.equal(logFile, "");
  assert.equal(records.length, 1);
  assert.equal(records[0].featureId, "responses-api");
  assert.equal(records[0].status, "success");
  assert.equal(records[0].logSource, "object-storage");
  assert.equal(records[0].createdAt, "2026-06-10T10:00:00.000Z");
  assert.equal(JSON.stringify(records[0]).includes("secret-api-key"), false);
  assert.equal(warnings.some((message) => message.includes("local log write skipped")), true);
});

test("object storage run history helpers use the configured region with resource principals", () => {
  const server = readFileSync("server.mjs", "utf8");

  assert.match(server, /region = os\.environ\.get\("OCI_GENAI_REGION"\)/);
  assert.match(server, /ObjectStorageClient\(config=\{"region": region\}, signer=signer\)/);
  assert.match(server, /\[object-storage\] read failed/);
  assert.match(server, /\[object-storage\] write failed/);
});

test("portal admin route is handled before Langfuse passthrough routes", () => {
  const server = readFileSync("server.mjs", "utf8");
  const adminRouteIndex = server.indexOf('requestPath === "/api/admin/demo-runs"');
  const langfusePassthroughIndex = server.indexOf("isLangfusePassthroughPath(requestPath)");

  assert.ok(adminRouteIndex > 0);
  assert.ok(langfusePassthroughIndex > 0);
  assert.ok(adminRouteIndex < langfusePassthroughIndex);
});

test("Langfuse root-relative redirects stay inside the launch proxy", () => {
  const headers = new Headers({ Location: "/" });
  const rewritten = proxyResponseHeaders(headers, "/api/langfuse/launch/api/auth/signin", {
    launchUrl: "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/example/actions/invoke/",
    proxyBase: "/api/langfuse/launch/"
  });

  assert.equal(rewritten.location, "/api/langfuse/launch/");
});

test("Langfuse internal absolute redirects stay inside the launch proxy", () => {
  const headers = new Headers({ Location: "http://0.0.0.0:3000/api/auth/error?error=Invalid%20credentials" });
  const rewritten = proxyResponseHeaders(headers, "/api/langfuse/launch/api/auth/callback/credentials", {
    launchUrl: "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/example/actions/invoke/",
    proxyBase: "/api/langfuse/launch/"
  });

  assert.equal(rewritten.location, "/api/langfuse/launch/api/auth/error?error=Invalid%20credentials");
});

test("Langfuse NextAuth callback URLs stay inside the launch proxy", () => {
  const rewritten = JSON.parse(
    rewriteLangfuseLaunchJson(
      JSON.stringify({ url: "http://0.0.0.0:3000/", callbackUrl: "http://0.0.0.0:3000/api/auth/callback/credentials" }),
      "http://127.0.0.1:5175"
    )
  );

  assert.equal(rewritten.url, "http://127.0.0.1:5175/api/langfuse/launch/");
  assert.equal(rewritten.callbackUrl, "http://127.0.0.1:5175/api/langfuse/launch/api/auth/callback/credentials");
});

test("Langfuse HTML root-relative routes stay inside the launch proxy", () => {
  const rewritten = rewriteLangfuseLaunchHtml(
    `<a href="/">Home</a><form action="/api/auth/callback/credentials"></form><script src="/_next/static/app.js"></script><script>window.location.assign("/project/demo")</script>`,
    "http://127.0.0.1:5175"
  );

  assert.match(rewritten, /href="\/api\/langfuse\/launch\/"/);
  assert.match(rewritten, /action="\/api\/langfuse\/launch\/api\/auth\/callback\/credentials"/);
  assert.match(rewritten, /src="\/api\/langfuse\/launch\/_next\/static\/app\.js"/);
  assert.match(rewritten, /window\.location\.assign\("\/api\/langfuse\/launch\/project\/demo"\)/);
});

test("Langfuse JSON root-relative routes stay inside the launch proxy", () => {
  const rewritten = JSON.parse(
    rewriteLangfuseLaunchJson(
      JSON.stringify({ redirect: "/", nested: { project: "/project/demo" }, keep: "https://example.com/" }),
      "http://127.0.0.1:5175"
    )
  );

  assert.equal(rewritten.redirect, "/api/langfuse/launch/");
  assert.equal(rewritten.nested.project, "/api/langfuse/launch/project/demo");
  assert.equal(rewritten.keep, "https://example.com/");
});

test("hosted runtime discovery ignores deleted exported applications", () => {
  const selected = selectHostedRuntimeCandidate({
    current: {
      hostedApplicationId: "ocid1.generativeaihostedapplication.deleted",
      hostedDeploymentId: "ocid1.generativeaihosteddeployment.deleted",
      url: "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/ocid1.generativeaihostedapplication.deleted/actions/invoke/"
    },
    envUrl: "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/ocid1.generativeaihostedapplication.deleted/actions/invoke/",
    envDeploymentId: "ocid1.generativeaihosteddeployment.deleted",
    applicationResource: null,
    deploymentResource: null,
    applicationDiscoverySucceeded: true,
    deploymentDiscoverySucceeded: true,
    region: "us-chicago-1"
  });

  assert.equal(selected.hostedApplicationId, "");
  assert.equal(selected.hostedDeploymentId, "");
  assert.equal(selected.endpoint, "");
});

test("hosted runtime discovery prefers newest active application over stale exports", () => {
  const selected = selectHostedRuntimeCandidate({
    current: {
      hostedApplicationId: "ocid1.generativeaihostedapplication.deleted",
      hostedDeploymentId: "ocid1.generativeaihosteddeployment.deleted"
    },
    envUrl: "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/ocid1.generativeaihostedapplication.deleted/actions/invoke/",
    envDeploymentId: "ocid1.generativeaihosteddeployment.deleted",
    applicationResource: {
      identifier: "ocid1.generativeaihostedapplication.active",
      "lifecycle-state": "ACTIVE",
      endpoint: "https://active-hosted.example.com/"
    },
    deploymentResource: {
      identifier: "ocid1.generativeaihosteddeployment.active",
      "lifecycle-state": "ACTIVE"
    },
    applicationDiscoverySucceeded: true,
    deploymentDiscoverySucceeded: true,
    region: "us-chicago-1"
  });

  assert.equal(selected.hostedApplicationId, "ocid1.generativeaihostedapplication.active");
  assert.equal(selected.hostedDeploymentId, "ocid1.generativeaihosteddeployment.active");
  assert.equal(selected.endpoint, "https://active-hosted.example.com/");
});

test("hosted runtime discovery does not synthesize OCI API invoke URLs for browser launch", () => {
  const selected = selectHostedRuntimeCandidate({
    current: {
      hostedApplicationId: "ocid1.generativeaihostedapplication.stale",
      hostedDeploymentId: "ocid1.generativeaihosteddeployment.stale",
      endpoint: "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/ocid1.generativeaihostedapplication.stale/actions/invoke/"
    },
    envUrl: "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/ocid1.generativeaihostedapplication.stale/actions/invoke/",
    envDeploymentId: "ocid1.generativeaihosteddeployment.stale",
    applicationResource: {
      identifier: "ocid1.generativeaihostedapplication.active",
      "lifecycle-state": "ACTIVE"
    },
    deploymentResource: {
      identifier: "ocid1.generativeaihosteddeployment.active",
      "lifecycle-state": "ACTIVE"
    },
    applicationDiscoverySucceeded: true,
    deploymentDiscoverySucceeded: true,
    region: "us-chicago-1"
  });

  assert.equal(selected.hostedApplicationId, "ocid1.generativeaihostedapplication.active");
  assert.equal(selected.hostedDeploymentId, "ocid1.generativeaihosteddeployment.active");
  assert.equal(selected.endpoint, "");
});

test("hosted application OCID overrides do not become unauthenticated invoke URLs", () => {
  const runtime = resolvePayloadHostedRuntime("agentic-control-tower", {
    hostedAppReference: "ocid1.generativeaihostedapplication.example",
    region: "us-chicago-1"
  });

  assert.equal(runtime.kind, "llamaindex");
  assert.equal(runtime.hostedApplicationId, "ocid1.generativeaihostedapplication.example");
  assert.equal(runtime.hostedUrl, "");
});

test("hosted runtime discovery accepts direct get id fields and ignores work request status", () => {
  assert.equal(typeof serverModule.hostedResourceIsUsable, "function");
  assert.equal(serverModule.hostedResourceIsUsable({ id: "ocid1.app", status: "SUCCEEDED" }), false);
  assert.equal(serverModule.hostedResourceIsUsable({ id: "ocid1.app", "lifecycle-state": "ACTIVE" }), true);

  const selected = selectHostedRuntimeCandidate({
    applicationResource: {
      id: "ocid1.generativeaihostedapplication.current",
      "lifecycle-state": "ACTIVE"
    },
    deploymentResource: {
      id: "ocid1.generativeaihosteddeployment.current",
      "lifecycle-state": "ACTIVE",
      "hosted-application-id": "ocid1.generativeaihostedapplication.current"
    },
    applicationDiscoverySucceeded: true,
    deploymentDiscoverySucceeded: true,
    region: "us-chicago-1"
  });

  assert.equal(selected.hostedApplicationId, "ocid1.generativeaihostedapplication.current");
  assert.equal(selected.hostedApplicationLifecycleState, "ACTIVE");
  assert.equal(selected.hostedDeploymentId, "ocid1.generativeaihosteddeployment.current");
  assert.equal(selected.hostedDeploymentLifecycleState, "ACTIVE");
});

test("hosted runtime discovery preserves deleted direct get state without launch endpoint", () => {
  const selected = selectHostedRuntimeCandidate({
    current: {
      hostedApplicationId: "ocid1.generativeaihostedapplication.deleted",
      hostedDeploymentId: "ocid1.generativeaihosteddeployment.deleted",
      endpoint:
        "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/ocid1.generativeaihostedapplication.deleted/actions/invoke/"
    },
    applicationResource: {
      id: "ocid1.generativeaihostedapplication.deleted",
      "lifecycle-state": "DELETED"
    },
    deploymentResource: {
      id: "ocid1.generativeaihosteddeployment.deleted",
      "lifecycle-state": "DELETED",
      "hosted-application-id": "ocid1.generativeaihostedapplication.deleted"
    },
    applicationDiscoverySucceeded: true,
    deploymentDiscoverySucceeded: true,
    region: "us-chicago-1"
  });

  assert.equal(selected.hostedApplicationId, "ocid1.generativeaihostedapplication.deleted");
  assert.equal(selected.hostedApplicationLifecycleState, "DELETED");
  assert.equal(selected.hostedDeploymentId, "ocid1.generativeaihosteddeployment.deleted");
  assert.equal(selected.hostedDeploymentLifecycleState, "DELETED");
  assert.equal(selected.endpoint, "");
});

test("hosted runtime launch requires active application and deployment lifecycles", () => {
  assert.equal(typeof serverModule.hostedRuntimeIsLaunchable, "function");
  assert.equal(
    serverModule.hostedRuntimeIsLaunchable({
      hostedApplicationLifecycleState: "ACTIVE",
      hostedDeploymentLifecycleState: "ACTIVE"
    }),
    true
  );
  assert.equal(
    serverModule.hostedRuntimeIsLaunchable({
      hostedApplicationLifecycleState: "DELETED",
      hostedDeploymentLifecycleState: "ACTIVE"
    }),
    false
  );
});

test("server-side hosted runtimes preserve OCI invoke URLs", () => {
  const invokeUrl =
    "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/ocid1.generativeaihostedapplication.example/actions/invoke/";
  const runtime = resolvePayloadHostedRuntime("agentic-control-tower", {
    hostedAppReference: invokeUrl
  });

  assert.equal(runtime.kind, "llamaindex");
  assert.equal(runtime.hostedUrl, invokeUrl);
  assert.equal(hostedRuntimeUrl("", invokeUrl), invokeUrl);
  assert.equal(hostedApplicationIdFromInvokeUrl(invokeUrl), "ocid1.generativeaihostedapplication.example");
});

test("server runtime readers use Resource Manager hosted invoke URLs", () => {
  const server = readFileSync("server.mjs", "utf8");

  assert.match(server, /function readLangfuseLaunchUrl\(\)[\s\S]*return hostedRuntimeUrl\(\s*process\.env\.OCI_HOSTED_LANGFUSE_URL,\s*portalRuntimeHostedValue\("LANGFUSE_URL"\),\s*observability\.url/);
  assert.match(server, /function readOpenClawLaunchUrl\(\)[\s\S]*return hostedRuntimeUrl\(\s*process\.env\.OCI_HOSTED_OPENCLAW_URL,\s*portalRuntimeHostedValue\("OPENCLAW_URL"\),\s*gateway\.url/);
  assert.match(server, /function readLlamaIndexControlTowerLaunchUrl\(\)[\s\S]*process\.env\.OCI_HOSTED_LLAMAINDEX_URL \|\|\s*portalRuntimeHostedValue\("LLAMAINDEX_URL"\) \|\|/);
  assert.match(server, /finalConversationId = process\.env\.OCI_GENAI_CONVERSATION_ID \|\| portalRuntimeConfig\.conversationId \|\| conversation\.id/);
  assert.match(server, /finalVectorStoreId = process\.env\.OCI_GENAI_VECTOR_STORE_ID \|\| portalRuntimeConfig\.vectorStoreId \|\| finalVectorStore\.id/);
  assert.match(server, /runtimeVectorStore = portalRuntimeConfig\.fileSearchVectorStore/);
  assert.match(server, /runtimeVectorStoreFiles = portalRuntimeConfig\.fileSearchSeedDocuments/);
  assert.match(server, /finalCodeInterpreterContainerStatus/);
  assert.match(server, /finalHostedAgentApplicationId = hostedAgentApplicationIdEnv \|\| hostedAgent\.hostedApplicationId/);
  assert.match(server, /finalOpenclawHostedUrl = hostedRuntimeUrl\(openclawHostedUrlEnv, openclawHostedUrl\)/);
});

test("server recovers hosted LlamaIndex metadata and legacy IDCS client exports", () => {
  const server = readFileSync("server.mjs", "utf8");

  assert.match(server, /readLlamaIndexControlTowerMetadata/);
  assert.match(server, /llamaindex_hosted_application\.json/);
  assert.match(server, /llamaindex_hosted_deployment\.json/);
  assert.match(server, /hostedRuntimeIsLaunchable\(metadata\)/);
  assert.match(server, /legacyIdcsClientFile/);
  assert.match(server, /\["n", "8", "n_idcs_client\.json"\]\.join\(""\)/);
});

test("demo process env strips broken proxy variables for OCI Python clients", () => {
  const env = demoProcessEnv(
    {
      http_proxy: "http://bad-proxy.example:80",
      https_proxy: "http://bad-proxy.example:80",
      HTTP_PROXY: "http://bad-proxy.example:80",
      HTTPS_PROXY: "http://bad-proxy.example:80",
      no_proxy: "localhost",
      NO_PROXY: "localhost",
      PATH: "/usr/bin"
    },
    {
      OCI_GENAI_REGION: "us-chicago-1"
    }
  );

  assert.equal(env.http_proxy, undefined);
  assert.equal(env.https_proxy, undefined);
  assert.equal(env.HTTP_PROXY, undefined);
  assert.equal(env.HTTPS_PROXY, undefined);
  assert.equal(env.no_proxy, undefined);
  assert.equal(env.NO_PROXY, undefined);
  assert.equal(env.PATH, "/usr/bin");
  assert.equal(env.OCI_GENAI_REGION, "us-chicago-1");
});

test("IDCS demo credential posture is redacted for Python demos", () => {
  const posture = idcsDemoCredentialPosture({
    domainUrl: "https://idcs.example.com",
    tokenUrl: "https://idcs.example.com/oauth2/v1/token",
    clientId: "enterprise-ai-demo-hosted-launch-ab12cd",
    clientSecret: "super-secret",
    audience: "https://genaisolutions.com/",
    scope: "read",
    source: "terraform-generated"
  });

  assert.deepEqual(posture, {
    configured: true,
    source: "terraform-generated",
    domainUrl: "https://idcs.example.com",
    tokenUrlConfigured: true,
    clientIdConfigured: true,
    clientSecretConfigured: true,
    audience: "https://genaisolutions.com/",
    scope: "read"
  });
  assert.equal(JSON.stringify(posture).includes("super-secret"), false);
});

test("LlamaIndex control tower proxy target preserves hosted app suffixes", () => {
  const target = llamaIndexControlTowerProxyTargetUrl(
    "/api/llamaindex/launch/agent/control-tower/respond",
    "?trace=true",
    "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/ocid1.example/actions/invoke/"
  );

  assert.equal(
    target.toString(),
    "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/ocid1.example/actions/invoke/agent/control-tower/respond?trace=true"
  );
});

test("server exposes LlamaIndex launch proxy route", () => {
  const server = readFileSync("server.mjs", "utf8");

  assert.match(server, /\/api\/llamaindex\/launch/);
  assert.match(server, /proxyLlamaIndexControlTowerLaunch/);
  assert.match(server, /llamaindex_control_tower\.json/);
});

test("extracts project values from OCI provisioning logs", () => {
  const values = extractProvisionedValues([
    {
      label: "oci",
      stdout: JSON.stringify({
        data: {
          id: "ocid1.generativeaiproject.oc1.us-chicago-1.example",
          "display-name": "enterprise-ai-demo-responses-api-ab12cd"
        }
      })
    }
  ]);

  assert.equal(values.projectId, "ocid1.generativeaiproject.oc1.us-chicago-1.example");
  assert.equal(values.projectDisplayName, "enterprise-ai-demo-responses-api-ab12cd");
});

test("parses terraform state resources into component status", () => {
  const resources = parseTerraformStateResources({
    values: {
      root_module: {
        resources: [
          {
            address: "terraform_data.generative_ai_project",
            type: "terraform_data",
            name: "generative_ai_project",
            values: {
              input: {
                project_display_name: "enterprise-ai-demo-responses-api-ab12cd"
              }
            }
          },
          {
            address: "terraform_data.generative_ai_api_key",
            type: "terraform_data",
            name: "generative_ai_api_key",
            tainted: true,
            values: {
              input: {
                api_key_display_name: "enterprise-ai-demo-responses-api-key-ab12cd"
              }
            }
          },
          {
            address: "terraform_data.resource_suffix",
            type: "terraform_data",
            name: "resource_suffix",
            values: {
              input: {
                resource_suffix: "ab12cd"
              }
            }
          }
        ]
      }
    }
  });

  assert.deepEqual(resources, [
    {
      address: "terraform_data.generative_ai_project",
      name: "GenAI Project",
      status: "created",
      value: "enterprise-ai-demo-responses-api-ab12cd"
    },
    {
      address: "terraform_data.generative_ai_api_key",
      name: "GenAI API Key",
      status: "failed",
      value: "enterprise-ai-demo-responses-api-key-ab12cd"
    },
    {
      address: "terraform_data.resource_suffix",
      name: "Resource Suffix",
      status: "created",
      value: "ab12cd"
    }
  ]);
});

test("parses demo terraform resources into infrastructure component labels", () => {
  const resources = parseTerraformStateResources({
    values: {
      root_module: {
        resources: [
          {
            address: "terraform_data.file_search_vector_store",
            type: "terraform_data",
            name: "file_search_vector_store",
            values: {
              input: {
                display_name: "enterprise-ai-demo-file-search-ab12cd"
              }
            }
          },
          {
            address: "terraform_data.file_search_seed_documents",
            type: "terraform_data",
            name: "file_search_seed_documents",
            values: {
              input: {
                display_name: "3 bundled Oracle PDFs"
              }
            }
          },
          {
            address: "terraform_data.code_interpreter_container",
            type: "terraform_data",
            name: "code_interpreter_container",
            values: {
              input: {
                display_name: "enterprise-ai-demo-code-interpreter-ab12cd"
              }
            }
          },
          {
            address: "terraform_data.hosted_agentic_application",
            type: "terraform_data",
            name: "hosted_agentic_application",
            values: {
              input: {
                hosted_application_display_name: "enterprise-ai-demo-hosted-agent-ab12cd"
              }
            }
          },
          {
            address: "terraform_data.langfuse_hosted_observability",
            type: "terraform_data",
            name: "langfuse_hosted_observability",
            values: {
              input: {
                hosted_application_display_name: "enterprise-ai-demo-langfuse-ab12cd",
                langfuse_nextauth_secret: "do-not-expose"
              }
            }
          },
          {
            address: "random_password.sql_search_admin",
            type: "random_password",
            name: "sql_search_admin",
            values: {
              result: "do-not-expose"
            }
          },
          {
            address: "oci_kms_vault.sql_search",
            type: "oci_kms_vault",
            name: "sql_search",
            values: {
              display_name: "enterprise-ai-demo-sql-vault-ab12cd"
            }
          },
          {
            address: "oci_kms_key.sql_search",
            type: "oci_kms_key",
            name: "sql_search",
            values: {
              display_name: "enterprise-ai-demo-sql-key-ab12cd"
            }
          },
          {
            address: "oci_vault_secret.sql_search_admin_password",
            type: "oci_vault_secret",
            name: "sql_search_admin_password",
            values: {
              secret_name: "enterprise-ai-demo-sql-password-ab12cd"
            }
          },
          {
            address: "oci_database_autonomous_database.sql_search",
            type: "oci_database_autonomous_database",
            name: "sql_search",
            values: {
              display_name: "enterprise-ai-demo-sql-search-ab12cd"
            }
          },
          {
            address: "oci_database_tools_database_tools_connection.enrichment",
            type: "oci_database_tools_database_tools_connection",
            name: "enrichment",
            values: {
              display_name: "enterprise-ai-demo-sql-enrichment-ab12cd"
            }
          },
          {
            address: "oci_database_tools_database_tools_connection.query",
            type: "oci_database_tools_database_tools_connection",
            name: "query",
            values: {
              display_name: "enterprise-ai-demo-sql-query-ab12cd"
            }
          },
          {
            address: "oci_identity_dynamic_group.enterprise_ai_demo",
            type: "oci_identity_dynamic_group",
            name: "enterprise_ai_demo",
            values: {
              name: "enterprise-ai-demo-ab12cd"
            }
          },
          {
            address: "oci_identity_policy.enterprise_ai_demo",
            type: "oci_identity_policy",
            name: "enterprise_ai_demo",
            values: {
              name: "enterprise-ai-demo-ab12cd"
            }
          }
        ]
      }
    }
  });

  assert.deepEqual(
    resources.map((resource) => [resource.name, resource.status]),
    [
      ["File Search Vector Store", "created"],
      ["File Search Seed Documents", "created"],
      ["Code Interpreter Container", "created"],
      ["Hosted Agentic Application Module", "created"],
      ["Langfuse Hosted Observability Module", "created"],
      ["SQL Search Vault", "created"],
      ["SQL Search Vault Key", "created"],
      ["SQL Search DB Password Secret", "created"],
      ["Autonomous Database", "created"],
      ["Database Tools Enrichment Connection", "created"],
      ["Database Tools Query Connection", "created"],
      ["Shared Demo Dynamic Group", "created"],
      ["Shared Demo IAM Policy", "created"]
    ]
  );
  assert.equal(resources.some((resource) => resource.value === "do-not-expose"), false);
});

test("collapses file search runtime state into unique up-to-date components", () => {
  const components = fileSearchRuntimeComponents({
    vectorStore: {
      id: "vs_test",
      status: "in_progress"
    },
    vectorStoreFiles: {
      documents: [
        {
          file: { id: "file_1", status: "UPLOADED" },
          vector_store_file: { id: "file_1", status: "completed" }
        },
        {
          file: { id: "file_2", status: "UPLOADED" },
          vector_store_file: { id: "file_2", status: "completed" }
        },
        {
          file: { id: "file_3", status: "UPLOADED" },
          vector_store_file: { id: "file_3", status: "completed" }
        }
      ]
    }
  });

  assert.deepEqual(
    components.map((component) => [component.name, component.status, component.value]),
    [
      ["File Search Vector Store", "created", "vs_test"],
      ["File Search Seed Documents", "created", "3/3 bundled Oracle PDFs completed"]
    ]
  );
});

test("uses exported file search seed counts when document metadata is absent", () => {
  const components = fileSearchRuntimeComponents({
    vectorStoreId: "vs_exported",
    seedDocumentCount: 3,
    seedDocumentCompletedCount: 3
  });

  assert.deepEqual(
    components.map((component) => [component.name, component.status, component.value]),
    [
      ["File Search Vector Store", "created", "vs_exported"],
      ["File Search Seed Documents", "created", "3/3 bundled Oracle PDFs completed"]
    ]
  );
});

test("merges infrastructure components into a unique alphabetical list", () => {
  const components = mergeInfrastructureComponents(
    [
      { address: "terraform.b", name: "Zulu", status: "created", value: "old" },
      { address: "terraform.a", name: "Alpha", status: "created", value: "alpha" }
    ],
    [
      { address: "generated.b", name: "Zulu", status: "created", value: "fresh" },
      { address: "generated.m", name: "Middle", status: "created", value: "middle" }
    ]
  );

  assert.deepEqual(
    components.map((component) => [component.name, component.value]),
    [
      ["Alpha", "alpha"],
      ["Middle", "middle"],
      ["Zulu", "fresh"]
    ]
  );
});

test("reports recently added demos as shared responses api infrastructure consumers", () => {
  const components = sharedResponsesDemoComponents({
    projectId: "ocid1.generativeaiproject.example",
    apiKeyAvailable: true
  });

  assert.deepEqual(
    components.map((component) => [component.name, component.status, component.value]),
    [
      ["Agentic RAG Planner Runtime", "created", "Shared Responses API project/API key"],
      ["AI Workflow Orchestration Runtime", "created", "Shared Responses API project/API key"],
      ["Batch Inference Runtime", "created", "Shared Responses API project/API key"],
      ["Human Approval Agent Runtime", "created", "Shared Responses API project/API key"],
      ["Model Evaluation Runtime", "created", "Shared Responses API project/API key"],
      ["Multimodal Vision Runtime", "created", "Shared Responses API project/API key"]
    ]
  );
});

test("detects when terraform state has all required resources", () => {
  assert.equal(
    hasAllRequiredTerraformResources([
      { address: "terraform_data.resource_suffix", status: "created" },
      { address: "terraform_data.generative_ai_project", status: "created" },
      { address: "terraform_data.generative_ai_api_key", status: "created" }
    ]),
    true
  );

  assert.equal(hasAllRequiredTerraformResources([{ address: "terraform_data.generative_ai_project" }]), false);
  assert.equal(
    hasAllRequiredTerraformResources([
      { address: "terraform_data.resource_suffix", status: "created" },
      { address: "terraform_data.generative_ai_project", status: "failed" },
      { address: "terraform_data.generative_ai_api_key", status: "created" }
    ]),
    false
  );
});

test("summarizes infrastructure state from terraform resources", () => {
  const summary = summarizeInfrastructureState([
    {
      address: "terraform_data.resource_suffix",
      name: "resource_suffix",
      status: "created",
      value: "ab12cd"
    },
    {
      address: "terraform_data.generative_ai_api_key",
      name: "GenAI API Key",
      status: "created",
      value: "enterprise-ai-demo-responses-api-key-ab12cd"
    },
    {
      address: "terraform_data.generative_ai_project",
      name: "GenAI Project",
      status: "created",
      value: "enterprise-ai-demo-responses-api-ab12cd"
    }
  ]);

  assert.equal(summary.status, "created");
  assert.equal(summary.values.resourceSuffix, "ab12cd");
  assert.equal(summary.values.projectDisplayName, "enterprise-ai-demo-responses-api-ab12cd");
  assert.equal(summary.values.apiKeyDisplayName, "enterprise-ai-demo-responses-api-key-ab12cd");
});

test("summarizes tainted terraform resources as failed infrastructure", () => {
  const summary = summarizeInfrastructureState([
    {
      address: "terraform_data.resource_suffix",
      name: "Resource Suffix",
      status: "created",
      value: "ab12cd"
    },
    {
      address: "terraform_data.generative_ai_project",
      name: "GenAI Project",
      status: "failed",
      value: "enterprise-ai-demo-responses-api-ab12cd"
    },
    {
      address: "terraform_data.generative_ai_api_key",
      name: "GenAI API Key",
      status: "failed",
      value: "enterprise-ai-demo-responses-api-key-ab12cd"
    }
  ]);

  assert.equal(summary.status, "failed");
  assert.equal(summary.values.resourceSuffix, "ab12cd");
});

test("summarizes externally provisioned RMS runtime as created infrastructure", () => {
  const summary = summarizeInfrastructureState([], {
    projectId: "ocid1.generativeaiproject.oc1.us-chicago-1.example",
    projectDisplayName: "enterprise-ai-demo-responses-api-fd2ed9",
    apiKeySecret: "configured"
  });

  assert.equal(summary.status, "created");
  assert.equal(summary.values.projectId, "ocid1.generativeaiproject.oc1.us-chicago-1.example");
  assert.equal(summary.values.apiKeyAvailable, true);
});

test("run dialog uses provisioned vector store and code container ids", () => {
  const main = readFileSync("src/main.js", "utf8");

  assert.match(main, /conversationId: ""/);
  assert.match(main, /vectorStoreId: ""/);
  assert.match(main, /codeInterpreterContainerId: ""/);
  assert.match(main, /infraState\.conversationId = values\.conversationId/);
  assert.match(main, /infraState\.vectorStoreId = values\.vectorStoreId/);
  assert.match(main, /infraState\.codeInterpreterContainerId = values\.codeInterpreterContainerId/);
  assert.match(main, /featureId === "conversation-store"[\s\S]*infraState\.conversationId/);
  assert.match(main, /featureId === "file-search-vector-store-rag"[\s\S]*infraState\.vectorStoreId/);
  assert.match(main, /conversationId: activeDemoId === "conversation-store"/);
  assert.match(main, /toolResourceId \|\| infraState\.vectorStoreId/);
  assert.match(main, /toolResourceId \|\| infraState\.codeInterpreterContainerId/);
});

test("run dialog does not expose editable hosted app references", () => {
  const main = readFileSync("src/main.js", "utf8");
  const styles = readFileSync("src/styles.css", "utf8");
  const server = readFileSync("server.mjs", "utf8");

  assert.doesNotMatch(main, /responses-hosted-reference-field/);
  assert.doesNotMatch(main, /responses-hosted-reference-value/);
  assert.doesNotMatch(main, /shouldSendHostedAppReference/);
  assert.doesNotMatch(main, /hostedReferenceVisible/);
  assert.doesNotMatch(main, /hostedRuntimeReferences/);
  assert.doesNotMatch(styles, /\.demo-dialog\.is-launch-demo \.hosted-reference-field/);
  assert.match(main, /langfuse-hosted-observability/);
  assert.match(main, /agentic-control-tower/);
  assert.match(server, /resolvePayloadHostedRuntime/);
  assert.match(server, /OCI_HOSTED_AGENT_URL: hostedRuntime\.hostedUrl/);
  assert.match(server, /OCI_HOSTED_LANGGRAPH_DEPLOYMENT_ID: hostedRuntime\.hostedDeploymentId/);
});

test("hosted UI demos expose launch button inside the run window", () => {
  const main = readFileSync("src/main.js", "utf8");

  assert.match(main, /const hostedApplicationLaunchConfigs = \{/);
  assert.match(main, /id="responses-launch-button"/);
  assert.match(main, /hostedApplicationLaunchConfig\(featureId\)/);
  assert.match(main, /const isLaunchOnly = launchOnlyDemoIds\.has\(featureId\)/);
  assert.match(main, /responses-run-button"\)\.hidden = isLaunchOnly/);
  assert.match(main, /responses-launch-button"\)\.hidden = !launchConfig/);
  assert.match(main, /responses-launch-button"\)\.addEventListener\("click"/);
  assert.match(main, /\/api\/langfuse\/launch\/auth\/sign-in/);
  assert.match(main, /\/api\/openclaw\/launch\//);
  assert.doesNotMatch(main, /\/api\/hosted\/launch\/hosted-agentic-applications\//);
  assert.doesNotMatch(main, /\/api\/hosted\/launch\/langgraph-hosted-agent-mcp\//);
  assert.doesNotMatch(main, /\/api\/hosted\/launch\/a2a-agent-collaboration\//);
  assert.doesNotMatch(main, /\/api\/llamaindex\/launch\//);
  assert.match(main, /return launchOnlyDemoIds\.has\(featureId\) \? "Launch" : "Run"/);
  assert.doesNotMatch(main, /hostedUiLaunchDemoIds\.includes\(activeDemoId\)/);
});

test("hosted UI demos launch directly without synthetic run launch flow", () => {
  const main = readFileSync("src/main.js", "utf8");

  assert.match(main, /const launchOnlyDemoIds = new Set/);
  assert.match(main, /return launchOnlyDemoIds\.has\(featureId\) \? "Launch" : "Run"/);
  assert.match(main, /launchOnlyDemoIds\.has\(activeDemoId\)/);
  assert.match(main, /"langfuse-hosted-observability"[\s\S]*button: "Launch"/);
  assert.match(main, /"openclaw-hosted-agent-gateway"[\s\S]*button: "Launch"/);
  assert.match(main, /launchExternalDemo\(activeDemoId\)/);
  assert.match(main, /window\.open\(launchTarget/);
  assert.doesNotMatch(main, /Run Launch Flow/);
  assert.doesNotMatch(main, /hosted-launch-flow/);
  assert.doesNotMatch(main, /runHostedLaunchFlow/);
});

test("only hosted UI demos expose launch controls and card faces stay compact", () => {
  const main = readFileSync("src/main.js", "utf8");
  const launchConfigSource = main.match(/const hostedApplicationLaunchConfigs = \{([\s\S]*?)\n\};/)?.[1] || "";
  const demoDefaultsSource = main.match(/const demoDefaults = \{([\s\S]*?)\n\};/)?.[1] || "";
  const apiHostedDemoIds = [
    "hosted-agentic-applications",
    "langgraph-hosted-agent-mcp",
    "a2a-agent-collaboration",
    "agentic-control-tower"
  ];
  const uiHostedDemoIds = ["langfuse-hosted-observability", "openclaw-hosted-agent-gateway"];

  for (const featureId of uiHostedDemoIds) {
    assert.match(launchConfigSource, new RegExp(`"${featureId}"[\\s\\S]*launchUrl:`));
    assert.match(launchConfigSource, new RegExp(`"${featureId}"[\\s\\S]*hostedUrlKey:`));
    assert.match(launchConfigSource, new RegExp(`"${featureId}"[\\s\\S]*hostedDeploymentIdKey:`));
    assert.match(demoDefaultsSource, new RegExp(`"${featureId}"[\\s\\S]*button: "Launch"`));
  }

  for (const featureId of apiHostedDemoIds) {
    assert.doesNotMatch(launchConfigSource, new RegExp(`"${featureId}"`));
    assert.match(demoDefaultsSource, new RegExp(`"${featureId}"[\\s\\S]*button: "Run [^"]+"`));
  }

  assert.match(main, /hostedApplicationLaunchConfig\(featureId\)/);
  assert.match(main, /document\.getElementById\("responses-run-button"\)\.hidden = isLaunchOnly/);
  assert.match(main, /document\.getElementById\("responses-launch-button"\)\.hidden = !launchConfig/);
  assert.match(main, /if \(launchOnlyDemoIds\.has\(activeDemoId\)\)[\s\S]*launchExternalDemo\(activeDemoId\)/);
  assert.match(main, /document\.getElementById\("responses-launch-button"\)\.addEventListener\("click"[\s\S]*launchExternalDemo\(activeDemoId\)/);
  assert.doesNotMatch(main, /hostedReferenceDetails\(feature\.id\)/);
  assert.doesNotMatch(main, /class="hosted-card-reference"/);
  assert.match(main, /Launch \$\{launchConfig\.shortLabel\}/);
  assert.doesNotMatch(main, /Run Launch Flow/);
});

test("generic hosted launch proxy routes through IDCS authenticated invoke URL", () => {
  assert.equal(typeof hostedLaunchProxyTargetUrl, "function");

  const target = hostedLaunchProxyTargetUrl(
    "hosted-agentic-applications",
    "/api/hosted/launch/hosted-agentic-applications/health",
    "?ready=1",
    "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/ocid1.generativeaihostedapplication.example/actions/invoke/"
  );

  assert.equal(
    target.toString(),
    "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/ocid1.generativeaihostedapplication.example/actions/invoke/health?ready=1"
  );
});

test("DevOps hosted deployment exports are reported as build-managed infra", () => {
  assert.equal(typeof devopsHostedDeploymentComponents, "function");

  const components = devopsHostedDeploymentComponents({
    buildRunId: "ocid1.devopsbuildrun.oc1.us-chicago-1.example",
    buildPipelineId: "ocid1.devopsbuildpipeline.oc1.us-chicago-1.example",
    deployments: {
      hostedAgent: {
        label: "Hosted Agent",
        url: "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/app/actions/invoke/",
        deploymentId: "ocid1.generativeaihosteddeployment.oc1.us-chicago-1.hosted"
      },
      langGraph: {
        label: "LangGraph",
        url: "",
        deploymentId: ""
      }
    }
  });

  assert.deepEqual(
    components.map((component) => [component.name, component.status, component.value]),
    [
      ["OCI DevOps Hosted Build Run", "created", "ocid1.devopsbuildrun.oc1.us-chicago-1.example"],
      ["OCI DevOps Hosted Build Pipeline", "created", "ocid1.devopsbuildpipeline.oc1.us-chicago-1.example"],
      [
        "Hosted Agent DevOps Deployment Export",
        "created",
        "ocid1.generativeaihosteddeployment.oc1.us-chicago-1.hosted | https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/app/actions/invoke/"
      ],
      ["LangGraph DevOps Deployment Export", "not-created", "OCI DevOps build did not export LangGraph deployment metadata"]
    ]
  );
});

test("hosted application references stay out of card faces and generic run payloads", () => {
  const main = readFileSync("src/main.js", "utf8");

  assert.doesNotMatch(main, /hostedReferenceDetails/);
  assert.doesNotMatch(main, /class="hosted-card-reference"/);
  assert.match(main, /visibleRequestPayload/);
  assert.match(main, /delete visiblePayload\.hostedAppReference/);
  assert.match(main, /delete visiblePayload\.hostedUrl/);
});

test("runtime state values ignore non-created hosted placeholder component text", () => {
  assert.equal(typeof serverModule.componentValueIfCreated, "function");
  assert.equal(
    serverModule.componentValueIfCreated({
      name: "Langfuse Hosted URL",
      status: "not-created",
      value: "Run provisioning to create Langfuse hosted URL"
    }),
    ""
  );
  assert.equal(
    serverModule.componentValueIfCreated({
      name: "OpenClaw OCI Hosted Deployment",
      status: "deleting",
      value: "ocid1.generativeaihosteddeployment.example"
    }),
    ""
  );
  assert.equal(
    serverModule.componentValueIfCreated({
      name: "LlamaIndex Control Tower Hosted URL",
      status: "created",
      value: "https://hosted.example.com/"
    }),
    "https://hosted.example.com/"
  );
});

test("frontend hosted state hydration does not fall back to placeholder component values", () => {
  const main = readFileSync("src/main.js", "utf8");

  assert.match(main, /function provisionedComponentValue/);
  assert.match(main, /provisionedComponentValue\(langfuseUrlComponent\)/);
  assert.doesNotMatch(main, /values\.langfuseHostedUrl \|\| langfuseUrlComponent\?\.value/);
  assert.doesNotMatch(main, /values\.openclawHostedUrl \|\| openclawUrlComponent\?\.value/);
  assert.doesNotMatch(main, /values\.llamaIndexHostedUrl \|\| llamaIndexUrlComponent\?\.value/);
});
