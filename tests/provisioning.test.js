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
  n8nExecutionListFallbackPayload,
  n8nForwardedCookieHeader,
  n8nPushStreamFallbackPayload,
  rewriteN8nLaunchJson,
  rewriteN8nLaunchHtml,
  summarizeDemoRunHistory
} from "../server.mjs";

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
    clientId: "enterprise-ai-demo-n8n-launch-ab12cd",
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

test("n8n launch proxy rewrites root-relative UI assets through the proxy path", () => {
  const html = `<!doctype html><script>window.BASE_PATH = '/';</script><script src="/assets/index.js"></script><link href="/assets/main.css"><link rel="icon" href="/favicon.ico">`;
  const rewritten = rewriteN8nLaunchHtml(html);

  assert.match(rewritten, /window\.BASE_PATH = '\/api\/n8n\/launch\/';/);
  assert.match(rewritten, /src="\/api\/n8n\/launch\/assets\/index\.js"/);
  assert.match(rewritten, /href="\/api\/n8n\/launch\/assets\/main\.css"/);
  assert.match(rewritten, /href="\/api\/n8n\/launch\/favicon\.ico"/);
});

test("n8n launch proxy forwards n8n cookies but strips the portal session", () => {
  const cookie = n8nForwardedCookieHeader("oci_portal_session=portal-token; n8n-auth=n8n-token; theme=dark");

  assert.equal(cookie, "n8n-auth=n8n-token; theme=dark");
});

test("n8n launch proxy can mask empty execution-list upstream failures", () => {
  assert.deepEqual(n8nExecutionListFallbackPayload("/api/n8n/launch/rest/executions"), { data: [] });
  assert.deepEqual(n8nExecutionListFallbackPayload("/api/n8n/launch/rest/executions-current"), { data: [] });
  assert.equal(n8nExecutionListFallbackPayload("/api/n8n/launch/rest/workflows"), null);
});

test("n8n launch proxy rewrites advertised editor URLs to the local proxy", () => {
  const payload = {
    data: {
      urlBaseEditor: "http://0.0.0.0:8080",
      urlBaseWebhook: "http://0.0.0.0:8080/",
      oauthCallbackUrls: {
        oauth1: "http://0.0.0.0:8080/rest/oauth1-credential/callback",
        oauth2: "http://0.0.0.0:8080/rest/oauth2-credential/callback"
      },
      pushBackend: "sse"
    }
  };

  const rewritten = JSON.parse(rewriteN8nLaunchJson(JSON.stringify(payload), "/api/n8n/launch/rest/settings", "http://127.0.0.1:5175"));

  assert.equal(rewritten.data.urlBaseEditor, "http://127.0.0.1:5175/api/n8n/launch");
  assert.equal(rewritten.data.urlBaseWebhook, "http://127.0.0.1:5175/api/n8n/launch/");
  assert.equal(rewritten.data.oauthCallbackUrls.oauth1, "http://127.0.0.1:5175/api/n8n/launch/rest/oauth1-credential/callback");
  assert.equal(rewritten.data.oauthCallbackUrls.oauth2, "http://127.0.0.1:5175/api/n8n/launch/rest/oauth2-credential/callback");
});

test("n8n launch proxy preserves hosted onboarding and template settings", () => {
  const settings = {
    data: {
      personalizationSurveyEnabled: true,
      onboardingCallPromptEnabled: true,
      templates: {
        enabled: true,
        host: "https://api.n8n.io/api/"
      }
    }
  };
  const newWorkflow = {
    data: {
      name: "My workflow",
      onboardingFlowEnabled: true
    }
  };

  const rewrittenSettings = JSON.parse(rewriteN8nLaunchJson(JSON.stringify(settings), "/api/n8n/launch/rest/settings", "http://127.0.0.1:5175"));
  const rewrittenNewWorkflow = JSON.parse(rewriteN8nLaunchJson(JSON.stringify(newWorkflow), "/api/n8n/launch/rest/workflows/new", "http://127.0.0.1:5175"));

  assert.equal(rewrittenSettings.data.personalizationSurveyEnabled, true);
  assert.equal(rewrittenSettings.data.onboardingCallPromptEnabled, true);
  assert.equal(rewrittenSettings.data.templates.enabled, true);
  assert.equal(rewrittenNewWorkflow.data.onboardingFlowEnabled, true);
});

test("n8n launch proxy provides a local SSE fallback for the push stream", () => {
  assert.match(n8nPushStreamFallbackPayload("/api/n8n/launch/rest/push"), /^: connected\n\n/);
  assert.equal(n8nPushStreamFallbackPayload("/api/n8n/launch/rest/settings"), null);
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
            address: "terraform_data.n8n_hosted_workflow_automation",
            type: "terraform_data",
            name: "n8n_hosted_workflow_automation",
            values: {
              input: {
                hosted_application_display_name: "enterprise-ai-demo-n8n-ab12cd",
                n8n_basic_auth_password: "do-not-expose"
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
      ["N8N Hosted Workflow Automation Module", "created"],
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

  assert.match(main, /vectorStoreId: ""/);
  assert.match(main, /codeInterpreterContainerId: ""/);
  assert.match(main, /infraState\.vectorStoreId = values\.vectorStoreId/);
  assert.match(main, /infraState\.codeInterpreterContainerId = values\.codeInterpreterContainerId/);
  assert.match(main, /featureId === "file-search-vector-store-rag"[\s\S]*infraState\.vectorStoreId/);
  assert.match(main, /toolResourceId \|\| infraState\.vectorStoreId/);
  assert.match(main, /toolResourceId \|\| infraState\.codeInterpreterContainerId/);
});
