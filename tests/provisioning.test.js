import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createResourceSuffix,
  createPortalSession,
  extractProvisionedValues,
  fileSearchRuntimeComponents,
  hasAllRequiredTerraformResources,
  mergeInfrastructureComponents,
  parseBasicAuthHeader,
  parseCookies,
  parseTerraformStateResources,
  demoProcessEnv,
  isAuthorizedRequest,
  idcsDemoCredentialPosture,
  llamaIndexControlTowerProxyTargetUrl,
  sharedResponsesDemoComponents,
  summarizeInfrastructureState,
  normalizeProvisionConfig,
  rewriteLangfuseLaunchJson,
  rewriteLangfuseLaunchHtml,
  proxyResponseHeaders,
  resolvePayloadHostedRuntime,
  readAdminLogSummary,
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
  const token = createPortalSession(sessions);

  assert.deepEqual(parseBasicAuthHeader(authorization), {
    username: "oci",
    password: "test-password"
  });
  assert.equal(parseCookies(`oci_portal_session=${token}`).oci_portal_session, token);
  assert.equal(isAuthorizedRequest({ headers: { cookie: `oci_portal_session=${token}` } }, "test-password", sessions), true);
  assert.equal(isAuthorizedRequest({ headers: { authorization } }, "test-password"), true);
  assert.equal(isAuthorizedRequest({ headers: { authorization } }, "different-password"), false);
  assert.equal(isAuthorizedRequest({ headers: {} }, "test-password", sessions), false);
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
        address: "oci_core_vcn.portal[0]",
        name: "Portal VCN",
        status: "created",
        value: "enterprise-ai-demo-vcn"
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
  assert.equal(infra.schema.resourceTypes.some((item) => item.type === "oci_core_vcn"), true);
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

test("run dialog exposes editable hosted app references for hosted-backed demos", () => {
  const main = readFileSync("src/main.js", "utf8");
  const styles = readFileSync("src/styles.css", "utf8");
  const server = readFileSync("server.mjs", "utf8");

  assert.match(main, /hostedReferenceVisible/);
  assert.match(main, /responses-hosted-reference-field/);
  assert.match(main, /responses-hosted-reference-value/);
  assert.match(main, /shouldSendHostedAppReference/);
  assert.match(main, /hostedRuntimeReferences/);
  assert.match(main, /langfuse-hosted-observability/);
  assert.match(main, /agentic-control-tower/);
  assert.match(styles, /\.demo-dialog\.is-launch-demo \.hosted-reference-field/);
  assert.match(server, /resolvePayloadHostedRuntime/);
  assert.match(server, /OCI_HOSTED_AGENT_URL: hostedRuntime\.hostedUrl/);
  assert.match(server, /OCI_HOSTED_LANGGRAPH_DEPLOYMENT_ID: hostedRuntime\.hostedDeploymentId/);
});

test("hosted application references are displayed on hosted cards instead of generic run payloads", () => {
  const main = readFileSync("src/main.js", "utf8");

  assert.match(main, /hostedReferenceDetails/);
  assert.match(main, /class="hosted-card-reference"/);
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
