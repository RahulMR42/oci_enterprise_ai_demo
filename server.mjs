import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import { appVersion } from "./src/version.js";

const port = Number.parseInt(process.env.PORT ?? "5173", 10);
const host = process.env.HOST ?? "127.0.0.1";
const root = process.cwd();
const portalAuthUser = "oci";
const portalAuthPasswordFile = process.env.OCI_PORTAL_PASSWORD_FILE || join(root, ".oci-portal-password");
const portalAuthPasswordConfig = resolvePortalAuthPassword();
const portalAuthPassword = portalAuthPasswordConfig.password;
const portalSessionCookie = "oci_portal_session";
const portalSessionTokens = new Set();
let idcsTokenCache = {
  value: "",
  expiresAt: 0
};
const defaultCompartmentId = "ocid1.compartment.oc1..aaaaaaaazx44wly3e4yextfibunmi2bgoibkdupj2opadokvllf4scgaybmq";
const baseProjectDisplayName = "enterprise-ai-demo-responses-api";
const defaultResponsesModel = "openai.gpt-oss-120b";
const terraformGeneratedDir = join(root, "infra/responses-api/.terraform/generated");
const demoGeneratedDirs = {
  "file-search-vector-store-rag": join(root, "infra/file-search-vector-store-rag/.terraform/generated"),
  "code-interpreter": join(root, "infra/code-interpreter/.terraform/generated"),
  "hosted-agentic-applications": join(root, "infra/hosted-agentic-applications/.terraform/generated")
};
const pythonExecutable = existsSync(join(root, "env/bin/python")) ? join(root, "env/bin/python") : "python3";
const demoScripts = {
  "responses-api": "responses_api.py",
  "conversation-store": "conversation_store.py",
  guardrails: "guardrails.py",
  "file-search-vector-store-rag": "file_search_vector_store_rag.py",
  "code-interpreter": "code_interpreter.py",
  "function-calling": "function_calling.py",
  "remote-mcp-calling": "remote_mcp_calling.py",
  "nl2sql-sql-search": "nl2sql_sql_search.py",
  "long-term-memory": "long_term_memory.py",
  "multi-model-routing": "multi_model_routing.py",
  "hosted-agentic-applications": "hosted_agentic_applications.py",
  "langgraph-hosted-agent-mcp": "langgraph_hosted_agent_mcp.py",
  "a2a-agent-collaboration": "a2a_agent_collaboration.py",
  "agentic-control-tower": "agentic_control_tower.py",
  "agentic-rag-planner": "agentic_rag_planner.py",
  "human-approval-agent": "human_approval_agent.py",
  "governance-center": "governance_center.py",
  "document-understanding-genai": "document_understanding_genai.py",
  "batch-inference": "batch_inference.py",
  "model-evaluation": "model_evaluation.py",
  "multimodal-vision": "multimodal_vision.py",
  "ai-workflow-orchestration": "ai_workflow_orchestration.py"
};

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".drawio": "application/xml; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

export function demoProcessEnv(baseEnv = process.env, overrides = {}) {
  const env = { ...baseEnv, ...overrides };
  for (const key of ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "no_proxy", "NO_PROXY"]) {
    delete env[key];
  }
  return env;
}

function persistLocalSecret(filePath, value) {
  writeFileSync(filePath, `${value}\n`, { mode: 0o600 });
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // File mode hardening is best-effort on filesystems that do not support chmod.
  }
}

function safeLogName(value = "demo") {
  return String(value || "demo").replace(/[^a-z0-9-]/gi, "-").toLowerCase().slice(0, 80);
}

function redactForDemoLog(value) {
  if (Array.isArray(value)) {
    return value.map(redactForDemoLog);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (/secret|password|token|authorization|apiKey|clientSecret/i.test(key)) {
          return [key, "<redacted>"];
        }
        return [key, redactForDemoLog(item)];
      })
    );
  }
  return value;
}

function writeDemoLog(featureId, payload = {}) {
  const logDir = join(root, "logs/demos", safeLogName(featureId));
  mkdirSync(logDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = join(logDir, `${timestamp}-${randomBytes(4).toString("hex")}.json`);
  writeFileSync(logFile, JSON.stringify(redactForDemoLog({ featureId, ...payload }), null, 2));
  return logFile;
}

function resolvePortalAuthPassword() {
  if (existsSync(portalAuthPasswordFile)) {
    const password = readFileSync(portalAuthPasswordFile, "utf8").trim();
    if (password) {
      return { password, source: "local-file" };
    }
  }

  const envPassword = String(process.env.OCI_PORTAL_PASSWORD || "").trim();
  const password = envPassword || randomBytes(9).toString("base64url");
  persistLocalSecret(portalAuthPasswordFile, password);
  return { password, source: envPassword ? "env-file" : "generated-file" };
}

export function resolvePath(urlPath) {
  const cleanPath = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const filePath = cleanPath === "/" ? "index.html" : cleanPath.replace(/^[/\\]/, "");
  return join(root, filePath);
}

export function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

export function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

export function parseBasicAuthHeader(header = "") {
  const [scheme, token] = String(header).split(" ");
  if (scheme?.toLowerCase() !== "basic" || !token) {
    return null;
  }

  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

export function parseCookies(header = "") {
  return String(header)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) {
        return cookies;
      }

      const name = decodeURIComponent(part.slice(0, separatorIndex).trim());
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      cookies[name] = value;
      return cookies;
    }, {});
}

export function createPortalSession(sessions = portalSessionTokens) {
  const token = randomBytes(18).toString("base64url");
  sessions.add(token);
  return token;
}

export function isAuthorizedRequest(request, password = portalAuthPassword, sessions = portalSessionTokens) {
  const sessionToken = parseCookies(request.headers.cookie || "")[portalSessionCookie];
  if (sessionToken && sessions.has(sessionToken)) {
    return true;
  }

  const credentials = parseBasicAuthHeader(request.headers.authorization || "");
  return credentials?.username === portalAuthUser && credentials.password === password;
}

function sessionCookie(token, maxAgeSeconds = 8 * 60 * 60) {
  return `${portalSessionCookie}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

function clearSessionCookie() {
  return `${portalSessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function renderLoginPage({ error = "", notice = "" } = {}) {
  const errorMarkup = error ? `<p class="error">${error}</p>` : "";
  const noticeMarkup = notice ? `<p class="notice">${notice}</p>` : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OCI Enterprise AI Portal Login</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        display: grid;
        min-height: 100vh;
        margin: 0;
        place-items: center;
        color: #111827;
        background:
          radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.13), transparent 28%),
          linear-gradient(135deg, #f8fafc 0%, #eef2f7 48%, #f9fafb 100%);
      }
      main {
        width: min(100% - 32px, 420px);
        padding: 28px;
        border: 1px solid rgba(15, 23, 42, 0.1);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.14);
      }
      .eyebrow {
        margin: 0 0 8px;
        color: #475569;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0 0 8px;
        color: #0f172a;
        font-size: 1.45rem;
        line-height: 1.2;
      }
      .subtext {
        margin: 0 0 22px;
        color: #64748b;
        font-size: 0.92rem;
        line-height: 1.5;
      }
      label {
        display: grid;
        gap: 7px;
        margin: 0 0 14px;
        color: #334155;
        font-size: 0.82rem;
        font-weight: 800;
      }
      input {
        min-height: 42px;
        padding: 0 12px;
        border: 1px solid rgba(15, 23, 42, 0.16);
        border-radius: 8px;
        color: #0f172a;
        background: #ffffff;
        font: inherit;
      }
      input:focus {
        border-color: #2563eb;
        outline: 3px solid rgba(37, 99, 235, 0.16);
      }
      button {
        width: 100%;
        min-height: 42px;
        border: 0;
        border-radius: 8px;
        color: #ffffff;
        cursor: pointer;
        background: #1d4ed8;
        font-size: 0.9rem;
        font-weight: 900;
      }
      button:hover,
      button:focus-visible {
        background: #1e40af;
      }
      .error {
        margin: 0 0 14px;
        padding: 10px 12px;
        border: 1px solid rgba(185, 28, 28, 0.24);
        border-radius: 8px;
        color: #991b1b;
        background: #fef2f2;
        font-size: 0.84rem;
        font-weight: 760;
      }
      .notice {
        margin: 0 0 14px;
        padding: 10px 12px;
        border: 1px solid rgba(37, 99, 235, 0.2);
        border-radius: 8px;
        color: #1e3a8a;
        background: #eff6ff;
        font-size: 0.84rem;
        font-weight: 760;
      }
      .forgot-password {
        margin-top: 12px;
      }
      .forgot-password button {
        color: #1e293b;
        background: transparent;
        box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.14);
      }
      .forgot-password button:hover,
      .forgot-password button:focus-visible {
        background: #f8fafc;
      }
      .version {
        margin: 18px 0 0;
        color: #64748b;
        font-size: 0.78rem;
        font-weight: 800;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Secure Access</p>
      <h1>OCI Enterprise AI Portal</h1>
      <p class="subtext">Sign in to access the demo portal and OCI Enterprise AI workflows.</p>
      ${noticeMarkup}
      ${errorMarkup}
      <form method="post" action="/login">
        <label>
          Username
          <input name="username" value="oci" autocomplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autocomplete="current-password" required autofocus />
        </label>
        <button type="submit">Sign in</button>
      </form>
      <form class="forgot-password" method="post" action="/forgot-password">
        <button type="submit">Forgot password</button>
      </form>
      <p class="version">Version ${appVersion}</p>
    </main>
  </body>
</html>`;
}

function sendLoginPage(response, statusCode = 200, options = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(renderLoginPage(options));
}

function requestLogin(request, response, requestPath) {
  if (requestPath.startsWith("/api/")) {
    sendJson(response, 401, {
      status: "unauthorized",
      error: "Sign in to access the OCI Enterprise AI Portal."
    });
    return;
  }

  response.writeHead(302, {
    Location: "/login",
    "Cache-Control": "no-store"
  });
  response.end();
}

function printCurrentPasswordToConsole() {
  console.log(`Current OCI Enterprise AI Portal password: ${portalAuthPassword}`);
}

export function normalizeProvisionConfig(payload = {}) {
  const projectDisplayName = String(payload.projectDisplayName || baseProjectDisplayName).trim();
  const resourceSuffix = String(payload.resourceSuffix || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6);

  return {
    compartmentId: String(payload.compartmentId || defaultCompartmentId).trim(),
    region: String(payload.region || "us-chicago-1").trim(),
    profile: String(payload.profile || "DEFAULT").trim(),
    resourceSuffix,
    projectDisplayName
  };
}

export function createResourceSuffix() {
  return Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(2, 8).padEnd(6, "0");
}

export function extractProvisionedValues(logs = []) {
  for (const log of logs) {
    const stdout = log.stdout || "";
    const jsonStart = stdout.indexOf("{");
    const jsonEnd = stdout.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      continue;
    }

    try {
      const parsed = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
      const data = parsed.data || parsed;
      const projectId = data.id || data.projectId;
      const projectDisplayName = data["display-name"] || data.displayName || data.name;

      if (projectId || projectDisplayName) {
        return {
          projectId: projectId || "",
          projectDisplayName: projectDisplayName || ""
        };
      }
    } catch {
      // Continue scanning other logs.
    }
  }

  return {
    projectId: "",
    projectDisplayName: ""
  };
}

export function buildTerraformStateCommand() {
  return buildTerraformStateCommandForModule("infra/responses-api");
}

export function buildTerraformStateCommandForModule(modulePath) {
  return {
    label: "terraform state",
    cmd: "terraform",
    args: [`-chdir=${modulePath}`, "show", "-json"]
  };
}

function buildHostedTerraformRefreshCommand() {
  const hostedInput = readHostedTerraformInput("hosted_agentic_application");
  const langGraphInput = readHostedTerraformInput("langgraph_hosted_agentic_application");
  const n8nInput = readHostedTerraformInput("n8n_hosted_workflow_automation");
  const langfuseInput = readHostedTerraformInput("langfuse_hosted_observability");
  const openclawInput = readHostedTerraformInput("openclaw_hosted_agent_gateway");
  const input = { ...hostedInput, ...langGraphInput, ...n8nInput, ...langfuseInput, ...openclawInput };
  return {
    label: "infra/hosted-agentic-applications refresh",
    cmd: "terraform",
    args: [
      "-chdir=infra/hosted-agentic-applications",
      "refresh",
      "-input=false",
      `-var=compartment_id=${input.compartment_id || defaultCompartmentId}`,
      `-var=region=${input.region || "us-chicago-1"}`,
      `-var=profile=${input.profile || "DEFAULT"}`,
      `-var=resource_suffix=${input.resource_suffix || "fd2ed9"}`,
      `-var=container_cli=${input.container_cli || "podman"}`,
      `-var=ocir_region_key=${input.ocir_region_key || "ord"}`,
      `-var=idcs_domain_url=${input.idcs_domain_url || "unused"}`,
      `-var=idcs_audience=${input.idcs_audience || "unused"}`,
      `-var=idcs_scope=${input.idcs_scope || "unused"}`,
      `-var=n8n_basic_auth_user=${input.n8n_basic_auth_user || "admin"}`,
      `-var=n8n_image_repository_uri=${input.n8n_image_repository_uri || ""}`,
      `-var=n8n_basic_auth_password=${process.env.OCI_HOSTED_N8N_BASIC_AUTH_PASSWORD || readLocalN8nPassword()}`,
      `-var=langfuse_image_repository_uri=${input.langfuse_image_repository_uri || ""}`,
      `-var=langfuse_database_url=${process.env.LANGFUSE_DATABASE_URL || ""}`,
      `-var=langfuse_clickhouse_url=${process.env.LANGFUSE_CLICKHOUSE_URL || ""}`,
      `-var=langfuse_clickhouse_migration_url=${process.env.LANGFUSE_CLICKHOUSE_MIGRATION_URL || ""}`,
      `-var=langfuse_clickhouse_user=${process.env.LANGFUSE_CLICKHOUSE_USER || ""}`,
      `-var=langfuse_clickhouse_password=${process.env.LANGFUSE_CLICKHOUSE_PASSWORD || ""}`,
      `-var=langfuse_redis_connection_string=${process.env.LANGFUSE_REDIS_CONNECTION_STRING || ""}`,
      `-var=langfuse_s3_event_upload_bucket=${process.env.LANGFUSE_S3_EVENT_UPLOAD_BUCKET || ""}`,
      `-var=langfuse_s3_media_upload_bucket=${process.env.LANGFUSE_S3_MEDIA_UPLOAD_BUCKET || ""}`,
      `-var=langfuse_s3_upload_region=${process.env.LANGFUSE_S3_UPLOAD_REGION || "auto"}`,
      `-var=langfuse_s3_upload_endpoint=${process.env.LANGFUSE_S3_UPLOAD_ENDPOINT || ""}`,
      `-var=langfuse_s3_upload_access_key_id=${process.env.LANGFUSE_S3_UPLOAD_ACCESS_KEY_ID || ""}`,
      `-var=langfuse_s3_upload_secret_access_key=${process.env.LANGFUSE_S3_UPLOAD_SECRET_ACCESS_KEY || ""}`,
      `-var=langfuse_nextauth_secret=${process.env.LANGFUSE_NEXTAUTH_SECRET || ""}`,
      `-var=langfuse_salt=${process.env.LANGFUSE_SALT || ""}`,
      `-var=langfuse_encryption_key=${process.env.LANGFUSE_ENCRYPTION_KEY || ""}`,
      `-var=langfuse_init_user_email=${process.env.LANGFUSE_INIT_USER_EMAIL || ""}`,
      `-var=langfuse_init_user_password=${process.env.LANGFUSE_INIT_USER_PASSWORD || ""}`,
      `-var=openclaw_image_repository_uri=${input.openclaw_image_repository_uri || ""}`,
      `-var=openclaw_gateway_token=${process.env.OPENCLAW_GATEWAY_TOKEN || ""}`
    ]
  };
}

function readJsonFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    const text = readFileSync(filePath, "utf8");
    try {
      return JSON.parse(text);
    } catch {
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      }
      return {};
    }
  } catch {
    return {};
  }
}

function readHostedTerraformInput(resourceName) {
  const state = readJsonFile(join(root, "infra/hosted-agentic-applications/terraform.tfstate"));
  const resource = (state.resources || []).find((candidate) => candidate.type === "terraform_data" && candidate.name === resourceName);
  return resource?.instances?.[0]?.attributes?.input || {};
}

function readLocalN8nPassword() {
  try {
    return readFileSync(join(root, ".n8n-hosted-password"), "utf8").trim();
  } catch {
    return "";
  }
}

export function readProvisionedDetails() {
  const projectJson = readJsonFile(join(terraformGeneratedDir, "project.json"));
  const apiKeyJson = readJsonFile(join(terraformGeneratedDir, "api_key.json"));
  const project = projectJson.data || {};
  const apiKey = apiKeyJson.data || {};
  const primaryKey = Array.isArray(apiKey.keys) ? apiKey.keys[0] || {} : {};

  return {
    projectId: process.env.OCI_GENAI_PROJECT_ID || project.id || "",
    projectDisplayName: project["display-name"] || project.displayName || "",
    apiKeyId: apiKey.id || "",
    apiKeyDisplayName: apiKey["display-name"] || apiKey.displayName || "",
    apiKeySecret: process.env.OCI_GENAI_API_KEY || primaryKey.key || "",
    apiKeyMask: primaryKey["key-mask"] || "",
    apiKeyState: primaryKey.state || apiKey["lifecycle-state"] || ""
  };
}

export function parseTerraformStateResources(stateJson = {}) {
  const resources = stateJson.values?.root_module?.resources || [];

  return resources.flatMap((resource) => {
    if (resource.type === "random_password") {
      return [];
    }

    const input = resource.values?.input || {};
    const output = resource.values?.output || {};
    const normalizedAddress = resource.address.replace(/\[\d+\]/g, "");
    const value =
      resource.values?.display_name ||
      resource.values?.name ||
      resource.values?.secret_name ||
      input.project_display_name ||
      input.api_key_display_name ||
      input.resource_suffix ||
      input.display_name ||
      output.project_display_name ||
      output.api_key_display_name ||
      output.resource_suffix ||
      output.display_name ||
      resource.values?.id ||
      resource.address;
    const labelByAddress = {
      "terraform_data.generative_ai_project": "GenAI Project",
      "terraform_data.generative_ai_api_key": "GenAI API Key",
      "terraform_data.resource_suffix": "Resource Suffix",
      "terraform_data.file_search_vector_store": "File Search Vector Store",
      "terraform_data.file_search_seed_documents": "File Search Seed Documents",
      "terraform_data.code_interpreter_container": "Code Interpreter Container",
      "terraform_data.hosted_agentic_application": "Hosted Agentic Application Module",
      "terraform_data.n8n_hosted_workflow_automation": "N8N Hosted Workflow Automation Module",
      "terraform_data.langfuse_hosted_observability": "Langfuse Hosted Observability Module",
      "terraform_data.openclaw_hosted_agent_gateway": "OpenClaw Hosted Agent Gateway Module",
      "oci_core_vcn.langfuse": "Langfuse VCN",
      "oci_core_subnet.langfuse_private": "Langfuse Private Subnet",
      "oci_core_nat_gateway.langfuse": "Langfuse NAT Gateway",
      "oci_core_service_gateway.langfuse": "Langfuse Service Gateway",
      "oci_core_network_security_group.langfuse_hosted_app": "Langfuse Hosted App NSG",
      "oci_core_network_security_group.langfuse_dependencies": "Langfuse Dependencies NSG",
      "oci_psql_db_system.langfuse": "Langfuse PostgreSQL",
      "oci_container_instances_container_instance.langfuse_clickhouse": "Langfuse ClickHouse Container",
      "oci_container_instances_container_instance.langfuse_redis": "Langfuse Redis Container",
      "oci_objectstorage_bucket.langfuse": "Langfuse Object Storage Bucket",
      "oci_kms_vault.sql_search": "SQL Search Vault",
      "oci_kms_key.sql_search": "SQL Search Vault Key",
      "oci_vault_secret.sql_search_admin_password": "SQL Search DB Password Secret",
      "oci_database_autonomous_database.sql_search": "Autonomous Database",
      "oci_database_tools_database_tools_connection.enrichment": "Database Tools Enrichment Connection",
      "oci_database_tools_database_tools_connection.query": "Database Tools Query Connection",
      "oci_identity_dynamic_group.enterprise_ai_demo": "Shared Demo Dynamic Group",
      "oci_identity_policy.enterprise_ai_demo": "Shared Demo IAM Policy"
    };
    const label = labelByAddress[normalizedAddress] || resource.name;

    return [{
      address: resource.address,
      name: label,
      status: resource.tainted ? "failed" : "created",
      value
    }];
  });
}

export function hasAllRequiredTerraformResources(resources = []) {
  const addresses = new Set(resources.filter((resource) => resource.status === "created").map((resource) => resource.address));
  return (
    addresses.has("terraform_data.resource_suffix") &&
    addresses.has("terraform_data.generative_ai_project") &&
    addresses.has("terraform_data.generative_ai_api_key")
  );
}

export function summarizeInfrastructureState(resources = [], provisionedDetails = {}) {
  const suffix = resources.find((resource) => resource.address === "terraform_data.resource_suffix");
  const project = resources.find((resource) => resource.address === "terraform_data.generative_ai_project");
  const apiKey = resources.find((resource) => resource.address === "terraform_data.generative_ai_api_key");
  const isCreated = hasAllRequiredTerraformResources(resources);
  const hasFailedResources = resources.some((resource) => resource.status === "failed");

  return {
    status: hasFailedResources ? "failed" : isCreated ? "created" : "not-created",
    values: {
      resourceSuffix: suffix?.value || "",
      projectId: provisionedDetails.projectId,
      projectDisplayName: provisionedDetails.projectDisplayName || project?.value || "",
      apiKeyId: provisionedDetails.apiKeyId,
      apiKeyDisplayName: provisionedDetails.apiKeyDisplayName || apiKey?.value || "",
      apiKeyMask: provisionedDetails.apiKeyMask,
      apiKeyAvailable: Boolean(provisionedDetails.apiKeySecret)
    },
    components: resources
  };
}

function runCommand({ label, cmd, args }) {
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      resolve({
        label,
        startedAt,
        finishedAt: new Date().toISOString(),
        command: [cmd, ...args].join(" "),
        status: "error",
        exitCode: null,
        stdout,
        stderr: error.message
      });
    });

    child.on("close", (exitCode) => {
      resolve({
        label,
        startedAt,
        finishedAt: new Date().toISOString(),
        command: [cmd, ...args].join(" "),
        status: exitCode === 0 ? "success" : "failed",
        exitCode,
        stdout,
        stderr
      });
    });
  });
}

async function readTerraformState(modulePath = "infra/responses-api") {
  const result = await runCommand(buildTerraformStateCommandForModule(modulePath));
  if (result.status !== "success" || !result.stdout.trim()) {
    return {
      result,
      resources: []
    };
  }

  try {
    const resources = parseTerraformStateResources(JSON.parse(result.stdout));
    return {
      result: {
        ...result,
        stdout: `Terraform state read: ${resources.length} resources.`,
        stderr: result.stderr
      },
      resources
    };
  } catch (error) {
    return {
      result: {
        ...result,
        status: "failed",
        stderr: `${result.stderr}\nFailed to parse Terraform state JSON: ${error.message}`.trim()
      },
      resources: []
    };
  }
}

function ociGetCommand(label, args) {
  return {
    label,
    cmd: "oci",
    args: [
      ...args,
      "--profile",
      process.env.OCI_PROFILE || "DEFAULT",
      "--region",
      process.env.OCI_GENAI_REGION || "us-chicago-1",
      "--output",
      "json"
    ]
  };
}

async function refreshHostedJsonFile({ label, id, targetFile, commandArgs, runtimeFile, runtimeKey }) {
  if (!id) {
    return null;
  }

  const result = await runCommand(ociGetCommand(label, commandArgs(id)));
  if (result.status !== "success" || !result.stdout.trim()) {
    return result;
  }

  writeFileSync(targetFile, result.stdout);
  if (runtimeFile && runtimeKey) {
    const payload = JSON.parse(result.stdout).data || {};
    const runtime = readJsonFile(runtimeFile);
    runtime[runtimeKey] = payload["lifecycle-state"] || payload.lifecycleState || payload.status || runtime[runtimeKey] || "";
    writeFileSync(runtimeFile, JSON.stringify(runtime, null, 2));
  }

  return {
    ...result,
    stdout: `Refreshed ${targetFile}`
  };
}

async function refreshGeneratedRuntimeState() {
  const hostedDir = demoGeneratedDirs["hosted-agentic-applications"];
  const hostedRuntimeFile = join(hostedDir, "hosted_agent.json");
  const langGraphRuntimeFile = join(hostedDir, "langgraph_hosted_agent.json");
  const n8nRuntimeFile = join(hostedDir, "n8n_hosted_workflow.json");
  const langfuseRuntimeFile = join(hostedDir, "langfuse_hosted_observability.json");
  const openclawRuntimeFile = join(hostedDir, "openclaw_hosted_gateway.json");
  const hostedAgent = readJsonFile(hostedRuntimeFile);
  const langGraphAgent = readJsonFile(langGraphRuntimeFile);
  const n8nWorkflow = readJsonFile(n8nRuntimeFile);
  const langfuseObservability = readJsonFile(langfuseRuntimeFile);
  const openclawGateway = readJsonFile(openclawRuntimeFile);

  const refreshLogs = await Promise.all([
    refreshHostedJsonFile({
      label: "OCI hosted application refresh",
      id: hostedAgent.hostedApplicationId,
      targetFile: join(hostedDir, "hosted_application.json"),
      commandArgs: (id) => ["generative-ai", "hosted-application", "get", "--hosted-application-id", id],
      runtimeFile: hostedRuntimeFile,
      runtimeKey: "hostedApplicationLifecycleState"
    }),
    refreshHostedJsonFile({
      label: "OCI hosted deployment refresh",
      id: hostedAgent.hostedDeploymentId,
      targetFile: join(hostedDir, "hosted_deployment.json"),
      commandArgs: (id) => ["generative-ai", "hosted-deployment", "get", "--hosted-deployment-id", id],
      runtimeFile: hostedRuntimeFile,
      runtimeKey: "hostedDeploymentLifecycleState"
    }),
    refreshHostedJsonFile({
      label: "OCI LangGraph hosted application refresh",
      id: langGraphAgent.hostedApplicationId,
      targetFile: join(hostedDir, "langgraph_hosted_application.json"),
      commandArgs: (id) => ["generative-ai", "hosted-application", "get", "--hosted-application-id", id],
      runtimeFile: langGraphRuntimeFile,
      runtimeKey: "hostedApplicationLifecycleState"
    }),
    refreshHostedJsonFile({
      label: "OCI LangGraph hosted deployment refresh",
      id: langGraphAgent.hostedDeploymentId,
      targetFile: join(hostedDir, "langgraph_hosted_deployment.json"),
      commandArgs: (id) => ["generative-ai", "hosted-deployment", "get", "--hosted-deployment-id", id],
      runtimeFile: langGraphRuntimeFile,
      runtimeKey: "hostedDeploymentLifecycleState"
    }),
    refreshHostedJsonFile({
      label: "OCI n8n hosted application refresh",
      id: n8nWorkflow.hostedApplicationId,
      targetFile: join(hostedDir, "n8n_hosted_application.json"),
      commandArgs: (id) => ["generative-ai", "hosted-application", "get", "--hosted-application-id", id],
      runtimeFile: n8nRuntimeFile,
      runtimeKey: "hostedApplicationLifecycleState"
    }),
    refreshHostedJsonFile({
      label: "OCI n8n hosted deployment refresh",
      id: n8nWorkflow.hostedDeploymentId,
      targetFile: join(hostedDir, "n8n_hosted_deployment.json"),
      commandArgs: (id) => ["generative-ai", "hosted-deployment", "get", "--hosted-deployment-id", id],
      runtimeFile: n8nRuntimeFile,
      runtimeKey: "hostedDeploymentLifecycleState"
    }),
    refreshHostedJsonFile({
      label: "OCI Langfuse hosted application refresh",
      id: langfuseObservability.hostedApplicationId,
      targetFile: join(hostedDir, "langfuse_hosted_application.json"),
      commandArgs: (id) => ["generative-ai", "hosted-application", "get", "--hosted-application-id", id],
      runtimeFile: langfuseRuntimeFile,
      runtimeKey: "hostedApplicationLifecycleState"
    }),
    refreshHostedJsonFile({
      label: "OCI Langfuse hosted deployment refresh",
      id: langfuseObservability.hostedDeploymentId,
      targetFile: join(hostedDir, "langfuse_hosted_deployment.json"),
      commandArgs: (id) => ["generative-ai", "hosted-deployment", "get", "--hosted-deployment-id", id],
      runtimeFile: langfuseRuntimeFile,
      runtimeKey: "hostedDeploymentLifecycleState"
    }),
    refreshHostedJsonFile({
      label: "OCI OpenClaw hosted application refresh",
      id: openclawGateway.hostedApplicationId,
      targetFile: join(hostedDir, "openclaw_hosted_application.json"),
      commandArgs: (id) => ["generative-ai", "hosted-application", "get", "--hosted-application-id", id],
      runtimeFile: openclawRuntimeFile,
      runtimeKey: "hostedApplicationLifecycleState"
    }),
    refreshHostedJsonFile({
      label: "OCI OpenClaw hosted deployment refresh",
      id: openclawGateway.hostedDeploymentId,
      targetFile: join(hostedDir, "openclaw_hosted_deployment.json"),
      commandArgs: (id) => ["generative-ai", "hosted-deployment", "get", "--hosted-deployment-id", id],
      runtimeFile: openclawRuntimeFile,
      runtimeKey: "hostedDeploymentLifecycleState"
    })
  ]);

  return refreshLogs.filter(Boolean);
}

export function statusFromLifecycle(value, fallback = "not-created") {
  const status = String(value || "").toLowerCase();
  if (["active", "available", "completed", "created", "running", "succeeded", "uploaded", "valid"].includes(status)) {
    return "created";
  }
  if (["creating", "in_progress", "in-progress", "updating"].includes(status)) {
    return "creating";
  }
  if (["deleting", "deleted"].includes(status)) {
    return "deleting";
  }
  if (["failed", "inactive", "invalid", "unknown_enum_value"].includes(status)) {
    return "failed";
  }
  return fallback;
}

function component(address, name, status, value) {
  return {
    address,
    name,
    status,
    value
  };
}

function hostedApplicationInvokeUrl(hostedApplicationId, region = "us-chicago-1") {
  return hostedApplicationId
    ? `https://application.generativeai.${region}.oci.oraclecloud.com/20251112/hostedApplications/${hostedApplicationId}/actions/invoke/`
    : "";
}

function readN8nLaunchUrl() {
  const workflow = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "n8n_hosted_workflow.json"));
  return workflow.url || workflow.endpoint || hostedApplicationInvokeUrl(workflow.hostedApplicationId, process.env.OCI_GENAI_REGION || "us-chicago-1");
}

function readLangfuseLaunchUrl() {
  const observability = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "langfuse_hosted_observability.json"));
  return observability.url || observability.endpoint || hostedApplicationInvokeUrl(observability.hostedApplicationId, process.env.OCI_GENAI_REGION || "us-chicago-1");
}

function readOpenClawLaunchUrl() {
  const gateway = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "openclaw_hosted_gateway.json"));
  return gateway.url || gateway.endpoint || hostedApplicationInvokeUrl(gateway.hostedApplicationId, process.env.OCI_GENAI_REGION || "us-chicago-1");
}

function readLlamaIndexControlTowerMetadata() {
  return readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "llamaindex_control_tower.json"));
}

function readLlamaIndexControlTowerLaunchUrl() {
  const controlTower = readLlamaIndexControlTowerMetadata();
  return controlTower.url || controlTower.endpoint || hostedApplicationInvokeUrl(controlTower.hostedApplicationId, process.env.OCI_GENAI_REGION || "us-chicago-1");
}

function readN8nIdcsLaunchConfig() {
  const config = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "n8n_idcs_client.json"));
  return {
    domainUrl: String(config.domainUrl || "").replace(/\/+$/, ""),
    tokenUrl: String(config.tokenUrl || ""),
    clientId: String(config.clientId || ""),
    clientSecret: String(config.clientSecret || ""),
    audience: String(config.audience || ""),
    scope: String(config.scope || config.scopeFqs || ""),
    source: config.clientId || config.clientSecret ? "terraform-generated" : "not-configured"
  };
}

function idcsConfig() {
  const generated = readN8nIdcsLaunchConfig();
  const hasGeneratedCredentials = Boolean(generated.clientId || generated.clientSecret);
  return {
    domainUrl: String(generated.domainUrl || process.env.IDCS_DOMAIN_URL || process.env.OCI_HOSTED_APP_IDCS_DOMAIN_URL || "").replace(/\/+$/, ""),
    tokenUrl: String(generated.tokenUrl || process.env.IDCS_TOKEN_URL || process.env.OCI_HOSTED_APP_IDCS_TOKEN_URL || ""),
    clientId: String(generated.clientId || process.env.IDCS_CLIENT_ID || process.env.OCI_HOSTED_APP_IDCS_CLIENT_ID || ""),
    clientSecret: String(generated.clientSecret || process.env.IDCS_CLIENT_SECRET || process.env.OCI_HOSTED_APP_IDCS_CLIENT_SECRET || ""),
    audience: String(generated.audience || process.env.IDCS_AUDIENCE || process.env.OCI_HOSTED_APP_IDCS_AUDIENCE || ""),
    scope: String(generated.scope || process.env.IDCS_SCOPE || process.env.OCI_HOSTED_APP_IDCS_SCOPE || "read"),
    source: hasGeneratedCredentials ? "terraform-generated" : "environment"
  };
}

export function idcsDemoCredentialPosture(config = idcsConfig()) {
  const source = config.source || (config.clientId || config.clientSecret ? "env-or-generated" : "not-configured");
  return {
    configured: Boolean(config.domainUrl && config.tokenUrl && config.clientId && config.clientSecret),
    source,
    domainUrl: config.domainUrl || "",
    tokenUrlConfigured: Boolean(config.tokenUrl),
    clientIdConfigured: Boolean(config.clientId),
    clientSecretConfigured: Boolean(config.clientSecret),
    audience: config.audience || "",
    scope: config.scope || ""
  };
}

function idcsScopeCandidates({ audience, scope }) {
  const scopes = [];
  if (audience && scope && !scope.startsWith("http")) {
    scopes.push(`${audience.replace(/\/?$/, "/")}${scope.replace(/^\//, "")}`);
  }
  scopes.push(scope);
  return [...new Set(scopes.filter(Boolean))];
}

export async function getIdcsAccessToken() {
  if (idcsTokenCache.value && Date.now() < idcsTokenCache.expiresAt) {
    return idcsTokenCache.value;
  }

  const config = idcsConfig();
  const requiredConfig = {
    domainUrl: config.domainUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    scope: config.scope
  };
  const missing = Object.entries(requiredConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`Missing IDCS launch configuration: ${missing.join(", ")}`);
  }

  const attempts = [];
  for (const scope of idcsScopeCandidates(config)) {
    attempts.push({
      label: "basic",
      body: new URLSearchParams({ grant_type: "client_credentials", scope }),
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });
    attempts.push({
      label: "form",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope,
        client_id: config.clientId,
        client_secret: config.clientSecret
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });
  }

  let lastFailure = "";
  let payload = null;
  const tokenUrl = config.tokenUrl || `${config.domainUrl}/oauth2/v1/token`;
  for (const attempt of attempts) {
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: attempt.headers,
      body: attempt.body
    });
    const text = await tokenResponse.text();
    if (tokenResponse.ok) {
      payload = JSON.parse(text);
      break;
    }
    lastFailure = `${attempt.label} auth returned HTTP ${tokenResponse.status}: ${text.slice(0, 240)}`;
  }

  if (!payload) {
    const credentialHint = lastFailure.includes("invalid_client")
      ? " IDCS rejected the client credentials. Verify the app is a confidential application in the same IDCS domain, Client Credentials is enabled, the client secret is current, and the token endpoint matches the domain."
      : "";
    throw new Error(`IDCS token request failed: ${lastFailure}.${credentialHint}`);
  }
  if (!payload.access_token) {
    throw new Error("IDCS token response did not include an access token.");
  }

  const expiresInSeconds = Number(payload.expires_in || 300);
  idcsTokenCache = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(30, expiresInSeconds - 30) * 1000
  };
  return idcsTokenCache.value;
}

function n8nProxyTargetUrl(requestPath, search = "") {
  const launchUrl = readN8nLaunchUrl();
  if (!launchUrl) {
    throw new Error("n8n hosted URL is not available. Provision hosted application infrastructure and refresh Resources first.");
  }

  const base = new URL(launchUrl);
  const suffix = requestPath.replace(/^\/api\/n8n\/launch\/?/, "");
  const basePath = base.pathname.replace(/\/?$/, "/");
  base.pathname = suffix ? `${basePath}${suffix}` : basePath;
  base.search = search || base.search;
  return base;
}

function langfuseProxyTargetUrl(requestPath, search = "") {
  const launchUrl = readLangfuseLaunchUrl();
  if (!launchUrl) {
    throw new Error("Langfuse hosted URL is not available. Provision hosted application infrastructure and refresh Resources first.");
  }

  const base = new URL(launchUrl);
  const suffix = requestPath.startsWith("/api/langfuse/launch")
    ? requestPath.replace(/^\/api\/langfuse\/launch\/?/, "")
    : requestPath.replace(/^\/+/, "");
  const basePath = base.pathname.replace(/\/?$/, "/");
  base.pathname = suffix ? `${basePath}${suffix}` : basePath;
  base.search = search || base.search;
  return base;
}

function openclawProxyTargetUrl(requestPath, search = "") {
  const launchUrl = readOpenClawLaunchUrl();
  if (!launchUrl) {
    throw new Error("OpenClaw hosted URL is not available. Provision hosted application infrastructure and refresh Resources first.");
  }

  const base = new URL(launchUrl);
  const suffix = requestPath.replace(/^\/api\/openclaw\/launch\/?/, "");
  const basePath = base.pathname.replace(/\/?$/, "/");
  base.pathname = suffix ? `${basePath}${suffix}` : basePath;
  base.search = search || base.search;
  return base;
}

export function llamaIndexControlTowerProxyTargetUrl(requestPath, search = "", launchUrl = readLlamaIndexControlTowerLaunchUrl()) {
  if (!launchUrl) {
    throw new Error("LlamaIndex control tower hosted URL is not available. Provision hosted application infrastructure and refresh Resources first.");
  }

  const base = new URL(launchUrl);
  const suffix = requestPath.replace(/^\/api\/llamaindex\/launch\/?/, "");
  const basePath = base.pathname.replace(/\/?$/, "/");
  base.pathname = suffix ? `${basePath}${suffix}` : basePath;
  base.search = search || base.search;
  return base;
}

function isLangfusePassthroughPath(requestPath = "") {
  return [
    "/_next/",
    "/account/",
    "/api/admin/",
    "/api/auth/",
    "/api/dashboard/",
    "/api/feedback",
    "/api/public/",
    "/api/trpc/",
    "/assets/",
    "/auth/",
    "/favicon.ico",
    "/icon.svg",
    "/onboarding",
    "/organization/",
    "/project/",
    "/setup"
  ].some((prefix) => requestPath === prefix.replace(/\/$/, "") || requestPath.startsWith(prefix));
}

export function n8nForwardedCookieHeader(cookieHeader = "") {
  return String(cookieHeader)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !part.startsWith(`${portalSessionCookie}=`))
    .join("; ");
}

export function n8nExecutionListFallbackPayload(requestPath = "") {
  const path = String(requestPath).split("?")[0].replace(/\/+$/, "");
  return path === "/api/n8n/launch/rest/executions" || path === "/api/n8n/launch/rest/executions-current"
    ? { data: [] }
    : null;
}

export function n8nPushStreamFallbackPayload(requestPath = "") {
  const path = String(requestPath).split("?")[0].replace(/\/+$/, "");
  return path === "/api/n8n/launch/rest/push" ? ": connected\n\n" : null;
}

function forwardedHeaders(sourceHeaders, token) {
  const blocked = new Set(["authorization", "connection", "content-length", "host", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);
  const headers = {};
  for (const [name, value] of Object.entries(sourceHeaders)) {
    if (!blocked.has(name.toLowerCase()) && value !== undefined) {
      headers[name] = value;
    }
  }
  const cookie = n8nForwardedCookieHeader(sourceHeaders.cookie || "");
  if (cookie) {
    headers.cookie = cookie;
  } else {
    delete headers.cookie;
  }
  return {
    ...headers,
    Authorization: `Bearer ${token}`
  };
}

function proxyResponseHeaders(headers, requestPath, { launchUrl = readN8nLaunchUrl(), proxyBase = "/api/n8n/launch/" } = {}) {
  const blocked = new Set(["connection", "content-encoding", "content-length", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);
  const result = {};
  for (const [name, value] of headers.entries()) {
    if (blocked.has(name.toLowerCase())) {
      continue;
    }
    if (name.toLowerCase() === "location") {
      if (proxyBase === "/api/langfuse/launch/" && value.startsWith("http://0.0.0.0:3000")) {
        result[name] = value.replace("http://0.0.0.0:3000", "");
      } else if (value.startsWith(launchUrl)) {
        result[name] = value.replace(launchUrl, proxyBase);
      } else if (proxyBase === "/api/langfuse/launch/" && value.startsWith("/")) {
        result[name] = value;
      } else {
        result[name] = value;
      }
      continue;
    }
    result[name] = value;
  }
  result["Cache-Control"] = requestPath === proxyBase ? "no-store" : result["Cache-Control"] || "no-store";
  return result;
}

export function rewriteN8nLaunchHtml(html) {
  const proxyBase = "/api/n8n/launch/";
  return String(html)
    .replace(/window\.BASE_PATH\s*=\s*['"]\/['"];/g, `window.BASE_PATH = '${proxyBase}';`)
    .replace(/\b(src|href)=["']\/(?!\/)([^"']*)["']/g, (_match, attribute, path) => `${attribute}="${proxyBase}${path}"`);
}

function n8nProxyOrigin(request) {
  const host = request?.headers?.host || "127.0.0.1:5175";
  const protocol = request?.headers?.["x-forwarded-proto"] || "http";
  return `${protocol}://${host}`;
}

function langfuseProxyOrigin(request) {
  return n8nProxyOrigin(request);
}

export function rewriteN8nLaunchJson(jsonText, requestPath = "", proxyOrigin = "") {
  const path = String(requestPath).split("?")[0].replace(/\/+$/, "");
  if (path !== "/api/n8n/launch/rest/settings") {
    return jsonText;
  }

  const payload = JSON.parse(jsonText);
  if (!payload?.data || !proxyOrigin) {
    return jsonText;
  }

  const proxyBase = `${proxyOrigin}/api/n8n/launch`;
  payload.data.urlBaseEditor = proxyBase;
  payload.data.urlBaseWebhook = `${proxyBase}/`;
  if (payload.data.oauthCallbackUrls) {
    payload.data.oauthCallbackUrls.oauth1 = `${proxyBase}/rest/oauth1-credential/callback`;
    payload.data.oauthCallbackUrls.oauth2 = `${proxyBase}/rest/oauth2-credential/callback`;
  }
  return JSON.stringify(payload);
}

export async function proxyN8nLaunch(request, response, parsedUrl) {
  const startedAt = Date.now();
  const featureId = "n8n-hosted-workflow-automation";
  try {
    const pushFallbackPayload = n8nPushStreamFallbackPayload(parsedUrl.pathname);
    if (request.method === "GET" && pushFallbackPayload) {
      const logFile = writeDemoLog(featureId, {
        action: "launch",
        status: "success",
        durationMs: Date.now() - startedAt,
        request: {
          method: request.method,
          path: parsedUrl.pathname
        },
        upstream: {
          status: 200,
          statusText: "Local SSE fallback",
          contentType: "text/event-stream"
        }
      });
      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "X-Demo-Log-File": logFile
      });
      response.write(pushFallbackPayload);
      const heartbeat = setInterval(() => {
        response.write(": heartbeat\n\n");
      }, 25000);
      request.on("close", () => {
        clearInterval(heartbeat);
        response.end();
      });
      return;
    }

    const targetUrl = n8nProxyTargetUrl(parsedUrl.pathname, parsedUrl.search);
    const token = await getIdcsAccessToken();
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await readRequestBody(request);
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: forwardedHeaders(request.headers, token),
      body,
      redirect: "manual"
    });
    if (request.method === "HEAD") {
      const logFile = writeDemoLog("n8n-hosted-workflow-automation", {
        action: "launch",
        status: upstream.ok ? "success" : "failed",
        durationMs: Date.now() - startedAt,
        request: {
          method: request.method,
          path: parsedUrl.pathname
        },
        upstream: {
          status: upstream.status,
          statusText: upstream.statusText,
          opcRequestId: upstream.headers.get("opc-request-id") || "",
          target: `${targetUrl.origin}${targetUrl.pathname}`
        }
      });
      response.writeHead(upstream.status, {
        ...proxyResponseHeaders(upstream.headers, parsedUrl.pathname),
        "X-Demo-Log-File": logFile
      });
      response.end();
      return;
    }
    const contentType = upstream.headers.get("content-type") || "";
    const arrayBuffer = await upstream.arrayBuffer();
    const upstreamBody = Buffer.from(arrayBuffer);
    const fallbackPayload = upstream.status >= 500 ? n8nExecutionListFallbackPayload(parsedUrl.pathname) : null;
    const responseBody = fallbackPayload
      ? Buffer.from(JSON.stringify(fallbackPayload))
      : contentType.includes("text/html")
      ? Buffer.from(rewriteN8nLaunchHtml(upstreamBody.toString("utf8")))
      : contentType.includes("application/json")
      ? Buffer.from(rewriteN8nLaunchJson(upstreamBody.toString("utf8"), parsedUrl.pathname, n8nProxyOrigin(request)))
      : upstreamBody;
    const logFile = writeDemoLog(featureId, {
      action: "launch",
      status: upstream.ok ? "success" : "failed",
      durationMs: Date.now() - startedAt,
      request: {
        method: request.method,
        path: parsedUrl.pathname
      },
      upstream: {
        status: upstream.status,
        statusText: upstream.statusText,
        contentType,
        opcRequestId: upstream.headers.get("opc-request-id") || "",
        target: `${targetUrl.origin}${targetUrl.pathname}`,
        bodyPreview: responseBody.toString("utf8", 0, Math.min(responseBody.length, 2000))
      }
    });
    response.writeHead(fallbackPayload ? 200 : upstream.status, {
      ...proxyResponseHeaders(upstream.headers, parsedUrl.pathname),
      ...(fallbackPayload ? { "Content-Type": "application/json; charset=utf-8" } : {}),
      "X-Demo-Log-File": logFile
    });
    response.end(responseBody);
  } catch (error) {
    const logFile = writeDemoLog(featureId, {
      action: "launch",
      status: "failed",
      durationMs: Date.now() - startedAt,
      request: {
        method: request.method,
        path: parsedUrl.pathname
      },
      error: error.message || String(error)
    });
    response.writeHead(502, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Demo-Log-File": logFile
    });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>n8n launch failed</title></head><body><h1>n8n launch failed</h1><p>${String(error.message || error).replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" })[char])}</p><p>Log file: ${logFile.replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" })[char])}</p></body></html>`);
  }
}

export async function proxyOpenClawLaunch(request, response, parsedUrl) {
  const startedAt = Date.now();
  const featureId = "openclaw-hosted-agent-gateway";
  try {
    const targetUrl = openclawProxyTargetUrl(parsedUrl.pathname, parsedUrl.search);
    const token = await getIdcsAccessToken();
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await readRequestBody(request);
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: forwardedHeaders(request.headers, token),
      body,
      redirect: "manual"
    });
    const contentType = upstream.headers.get("content-type") || "";
    const responseBody = request.method === "HEAD" ? Buffer.from("") : Buffer.from(await upstream.arrayBuffer());
    const logFile = writeDemoLog(featureId, {
      action: "launch",
      status: upstream.ok ? "success" : "failed",
      durationMs: Date.now() - startedAt,
      request: {
        method: request.method,
        path: parsedUrl.pathname
      },
      upstream: {
        status: upstream.status,
        statusText: upstream.statusText,
        contentType,
        opcRequestId: upstream.headers.get("opc-request-id") || "",
        target: `${targetUrl.origin}${targetUrl.pathname}`,
        bodyPreview: responseBody.toString("utf8", 0, Math.min(responseBody.length, 2000))
      }
    });
    response.writeHead(upstream.status, {
      ...proxyResponseHeaders(upstream.headers, parsedUrl.pathname, {
        launchUrl: readOpenClawLaunchUrl(),
        proxyBase: "/api/openclaw/launch/"
      }),
      "X-Demo-Log-File": logFile
    });
    response.end(responseBody);
  } catch (error) {
    const logFile = writeDemoLog(featureId, {
      action: "launch",
      status: "failed",
      durationMs: Date.now() - startedAt,
      request: {
        method: request.method,
        path: parsedUrl.pathname
      },
      error: error.message || String(error)
    });
    response.writeHead(502, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Demo-Log-File": logFile
    });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>OpenClaw launch failed</title></head><body><h1>OpenClaw launch failed</h1><p>${String(error.message || error).replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" })[char])}</p><p>Log file: ${logFile.replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" })[char])}</p></body></html>`);
  }
}

export async function proxyLlamaIndexControlTowerLaunch(request, response, parsedUrl) {
  const startedAt = Date.now();
  const featureId = "agentic-control-tower";
  try {
    const targetUrl = llamaIndexControlTowerProxyTargetUrl(parsedUrl.pathname, parsedUrl.search);
    const token = await getIdcsAccessToken();
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await readRequestBody(request);
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: forwardedHeaders(request.headers, token),
      body,
      redirect: "manual"
    });
    const contentType = upstream.headers.get("content-type") || "";
    const responseBody = request.method === "HEAD" ? Buffer.from("") : Buffer.from(await upstream.arrayBuffer());
    const logFile = writeDemoLog(featureId, {
      action: "launch",
      status: upstream.ok ? "success" : "failed",
      durationMs: Date.now() - startedAt,
      request: {
        method: request.method,
        path: parsedUrl.pathname
      },
      upstream: {
        status: upstream.status,
        statusText: upstream.statusText,
        contentType,
        opcRequestId: upstream.headers.get("opc-request-id") || "",
        target: `${targetUrl.origin}${targetUrl.pathname}`,
        bodyPreview: responseBody.toString("utf8", 0, Math.min(responseBody.length, 2000))
      }
    });
    response.writeHead(upstream.status, {
      ...proxyResponseHeaders(upstream.headers, parsedUrl.pathname, {
        launchUrl: readLlamaIndexControlTowerLaunchUrl(),
        proxyBase: "/api/llamaindex/launch/"
      }),
      "X-Demo-Log-File": logFile
    });
    response.end(responseBody);
  } catch (error) {
    const logFile = writeDemoLog(featureId, {
      action: "launch",
      status: "failed",
      durationMs: Date.now() - startedAt,
      request: {
        method: request.method,
        path: parsedUrl.pathname
      },
      error: error.message || String(error)
    });
    response.writeHead(502, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Demo-Log-File": logFile
    });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>LlamaIndex launch failed</title></head><body><h1>LlamaIndex launch failed</h1><p>${String(error.message || error).replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" })[char])}</p><p>Log file: ${logFile.replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" })[char])}</p></body></html>`);
  }
}

export function rewriteLangfuseLaunchHtml(html) {
  return String(html);
}

export function rewriteLangfuseLaunchJson(jsonText, proxyOrigin = "") {
  if (!proxyOrigin || !String(jsonText).includes("http://0.0.0.0:3000")) {
    return jsonText;
  }
  return String(jsonText).replaceAll("http://0.0.0.0:3000", proxyOrigin);
}

export async function proxyLangfuseLaunch(request, response, parsedUrl) {
  const startedAt = Date.now();
  const featureId = "langfuse-hosted-observability";
  try {
    const targetUrl = langfuseProxyTargetUrl(parsedUrl.pathname, parsedUrl.search);
    const token = await getIdcsAccessToken();
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await readRequestBody(request);
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: forwardedHeaders(request.headers, token),
      body,
      redirect: "manual"
    });
    const contentType = upstream.headers.get("content-type") || "";
    const arrayBuffer = request.method === "HEAD" ? new ArrayBuffer(0) : await upstream.arrayBuffer();
    const upstreamBody = Buffer.from(arrayBuffer);
    const responseBody = contentType.includes("text/html")
      ? Buffer.from(rewriteLangfuseLaunchHtml(upstreamBody.toString("utf8")))
      : contentType.includes("application/json")
        ? Buffer.from(rewriteLangfuseLaunchJson(upstreamBody.toString("utf8"), langfuseProxyOrigin(request)))
        : upstreamBody;
    const logFile = writeDemoLog(featureId, {
      action: "launch",
      status: upstream.ok ? "success" : "failed",
      durationMs: Date.now() - startedAt,
      request: {
        method: request.method,
        path: parsedUrl.pathname
      },
      upstream: {
        status: upstream.status,
        statusText: upstream.statusText,
        contentType,
        opcRequestId: upstream.headers.get("opc-request-id") || "",
        target: `${targetUrl.origin}${targetUrl.pathname}`,
        bodyPreview: responseBody.toString("utf8", 0, Math.min(responseBody.length, 2000))
      }
    });
    response.writeHead(upstream.status, {
      ...proxyResponseHeaders(upstream.headers, parsedUrl.pathname, {
        launchUrl: readLangfuseLaunchUrl(),
        proxyBase: "/api/langfuse/launch/"
      }),
      "X-Demo-Log-File": logFile
    });
    response.end(responseBody);
  } catch (error) {
    const logFile = writeDemoLog(featureId, {
      action: "launch",
      status: "failed",
      durationMs: Date.now() - startedAt,
      request: {
        method: request.method,
        path: parsedUrl.pathname
      },
      error: error.message || String(error)
    });
    response.writeHead(502, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Demo-Log-File": logFile
    });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Langfuse launch failed</title></head><body><h1>Langfuse launch failed</h1><p>${String(error.message || error).replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" })[char])}</p><p>Log file: ${logFile.replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" })[char])}</p></body></html>`);
  }
}

export function fileSearchRuntimeComponents({ vectorStore = {}, vectorStoreFiles = {} } = {}) {
  const seedDocuments = Array.isArray(vectorStoreFiles.documents) ? vectorStoreFiles.documents : [];
  const completedSeedDocuments = seedDocuments.filter((document) => {
    const uploadedFile = document.file || {};
    const vectorStoreFile = document.vector_store_file || {};
    return statusFromLifecycle(uploadedFile.status) === "created" && statusFromLifecycle(vectorStoreFile.status) === "created";
  });
  const hasCompletedSeeds = seedDocuments.length > 0 && completedSeedDocuments.length === seedDocuments.length;
  const vectorStoreStatus = vectorStore.id
    ? hasCompletedSeeds
      ? "created"
      : statusFromLifecycle(vectorStore.status, "created")
    : "not-created";

  return [
    component(
      "generated.file_search_vector_store",
      "File Search Vector Store",
      vectorStoreStatus,
      vectorStore.id || "Run provisioning to create vector store"
    ),
    component(
      "generated.file_search_seed_documents",
      "File Search Seed Documents",
      hasCompletedSeeds ? "created" : seedDocuments.length > 0 ? "creating" : "not-created",
      seedDocuments.length > 0
        ? `${completedSeedDocuments.length}/${seedDocuments.length} bundled Oracle PDFs completed`
        : "Bundled PDFs pending"
    )
  ];
}

export function sharedResponsesDemoComponents({ projectId = "", apiKeyAvailable = false } = {}) {
  const status = projectId && apiKeyAvailable ? "created" : "not-created";
  const value = status === "created" ? "Shared Responses API project/API key" : "Provision shared Responses API infra";
  const demos = [
    ["generated.agentic_rag_planner_runtime", "Agentic RAG Planner Runtime"],
    ["generated.ai_workflow_orchestration_runtime", "AI Workflow Orchestration Runtime"],
    ["generated.batch_inference_runtime", "Batch Inference Runtime"],
    ["generated.human_approval_agent_runtime", "Human Approval Agent Runtime"],
    ["generated.model_evaluation_runtime", "Model Evaluation Runtime"],
    ["generated.multimodal_vision_runtime", "Multimodal Vision Runtime"]
  ];

  return demos.map(([address, name]) => component(address, name, status, value));
}

function demoRuntimeComponents() {
  const vectorStore = readJsonFile(join(demoGeneratedDirs["file-search-vector-store-rag"], "vector_store.json"));
  const vectorStoreFiles = readJsonFile(join(demoGeneratedDirs["file-search-vector-store-rag"], "vector_store_files.json"));
  const codeContainer = readJsonFile(join(demoGeneratedDirs["code-interpreter"], "container.json"));
  const hostedAgent = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "hosted_agent.json"));
  const langGraphAgent = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "langgraph_hosted_agent.json"));
  const n8nWorkflow = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "n8n_hosted_workflow.json"));
  const langfuseObservability = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "langfuse_hosted_observability.json"));
  const openclawGateway = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "openclaw_hosted_gateway.json"));
  const llamaIndexControlTower = readLlamaIndexControlTowerMetadata();
  const ocirRepository = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "ocir_repository.json")).data || {};
  const langGraphRepository = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "langgraph_ocir_repository.json")).data || {};
  const n8nRepository = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "n8n_ocir_repository.json")).data || {};
  const langfuseRepository = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "langfuse_ocir_repository.json")).data || {};
  const openclawRepository = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "openclaw_ocir_repository.json")).data || {};
  const llamaIndexRepository = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "llamaindex_ocir_repository.json")).data || {};
  const langfuseRepositoryId = langfuseObservability.repositoryId || langfuseRepository.id || "";
  const hostedApplication = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "hosted_application.json")).data || {};
  const langGraphApplication = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "langgraph_hosted_application.json")).data || {};
  const n8nApplication = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "n8n_hosted_application.json")).data || {};
  const langfuseApplication = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "langfuse_hosted_application.json")).data || {};
  const openclawApplication = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "openclaw_hosted_application.json")).data || {};
  const llamaIndexApplication = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "llamaindex_hosted_application.json")).data || {};
  const hostedDeployment = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "hosted_deployment.json")).data || {};
  const langGraphDeployment = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "langgraph_hosted_deployment.json")).data || {};
  const n8nDeployment = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "n8n_hosted_deployment.json")).data || {};
  const langfuseDeployment = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "langfuse_hosted_deployment.json")).data || {};
  const openclawDeployment = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "openclaw_hosted_deployment.json")).data || {};
  const llamaIndexDeployment = readJsonFile(join(demoGeneratedDirs["hosted-agentic-applications"], "llamaindex_hosted_deployment.json")).data || {};
  const lifecycleValue = (value) => value["lifecycle-state"] || value.lifecycle_state || value.status || "";
  const artifactContainerUri = (artifact) => artifact["container-uri"] || artifact.container_uri || "";
  const hostedArtifact = hostedDeployment["active-artifact"] || hostedDeployment.active_artifact || {};
  const langGraphArtifact = langGraphDeployment["active-artifact"] || langGraphDeployment.active_artifact || {};
  const n8nArtifact = n8nDeployment["active-artifact"] || n8nDeployment.active_artifact || {};
  const langfuseArtifact = langfuseDeployment["active-artifact"] || langfuseDeployment.active_artifact || {};
  const openclawArtifact = openclawDeployment["active-artifact"] || openclawDeployment.active_artifact || {};
  const llamaIndexArtifact = llamaIndexDeployment["active-artifact"] || llamaIndexDeployment.active_artifact || {};
  const n8nHostedUrl = n8nWorkflow.url || n8nWorkflow.endpoint || hostedApplicationInvokeUrl(n8nWorkflow.hostedApplicationId, process.env.OCI_GENAI_REGION || "us-chicago-1");
  const langfuseHostedUrl = langfuseObservability.url || langfuseObservability.endpoint || hostedApplicationInvokeUrl(langfuseObservability.hostedApplicationId, process.env.OCI_GENAI_REGION || "us-chicago-1");
  const openclawHostedUrl = openclawGateway.url || openclawGateway.endpoint || hostedApplicationInvokeUrl(openclawGateway.hostedApplicationId, process.env.OCI_GENAI_REGION || "us-chicago-1");
  const llamaIndexHostedUrl = llamaIndexControlTower.url || llamaIndexControlTower.endpoint || hostedApplicationInvokeUrl(llamaIndexControlTower.hostedApplicationId, process.env.OCI_GENAI_REGION || "us-chicago-1");
  const hostedAgentDeploymentIdEnv = process.env.OCI_HOSTED_AGENT_DEPLOYMENT_ID || "";
  const hostedAgentUrlEnv = process.env.OCI_HOSTED_AGENT_URL || "";
  const langGraphDeploymentIdEnv = process.env.OCI_HOSTED_LANGGRAPH_DEPLOYMENT_ID || "";
  const langGraphHostedUrlEnv = process.env.OCI_HOSTED_LANGGRAPH_URL || "";
  const n8nHostedUrlEnv = process.env.OCI_HOSTED_N8N_URL || "";
  const langfuseHostedUrlEnv = process.env.OCI_HOSTED_LANGFUSE_URL || "";
  const openclawHostedUrlEnv = process.env.OCI_HOSTED_OPENCLAW_URL || "";
  const llamaIndexHostedUrlEnv = process.env.OCI_HOSTED_LLAMAINDEX_URL || "";
  const n8nDeploymentIdEnv = process.env.OCI_HOSTED_N8N_DEPLOYMENT_ID || "";
  const langfuseDeploymentIdEnv = process.env.OCI_HOSTED_LANGFUSE_DEPLOYMENT_ID || "";
  const openclawDeploymentIdEnv = process.env.OCI_HOSTED_OPENCLAW_DEPLOYMENT_ID || "";
  const llamaIndexDeploymentIdEnv = process.env.OCI_HOSTED_LLAMAINDEX_DEPLOYMENT_ID || "";
  const finalHostedAgentDeploymentId = hostedAgent.hostedDeploymentId || hostedAgentDeploymentIdEnv;
  const finalHostedAgentUrl = hostedAgent.endpoint || hostedAgentUrlEnv;
  const finalLangGraphDeploymentId = langGraphAgent.hostedDeploymentId || langGraphDeploymentIdEnv;
  const finalLangGraphHostedUrl = langGraphAgent.endpoint || langGraphHostedUrlEnv;
  const finalN8nDeploymentId = n8nWorkflow.hostedDeploymentId || n8nDeploymentIdEnv;
  const finalLangfuseDeploymentId = langfuseObservability.hostedDeploymentId || langfuseDeploymentIdEnv;
  const finalOpenclawDeploymentId = openclawGateway.hostedDeploymentId || openclawDeploymentIdEnv;
  const finalLlamaIndexDeploymentId = llamaIndexControlTower.hostedDeploymentId || llamaIndexDeploymentIdEnv;
  const finalN8nHostedUrl = n8nHostedUrl || n8nHostedUrlEnv;
  const finalLangfuseHostedUrl = langfuseHostedUrl || langfuseHostedUrlEnv;
  const finalOpenclawHostedUrl = openclawHostedUrl || openclawHostedUrlEnv;
  const finalLlamaIndexHostedUrl = llamaIndexHostedUrl || llamaIndexHostedUrlEnv;

  return [
    ...fileSearchRuntimeComponents({ vectorStore, vectorStoreFiles }),
    component(
      "generated.code_interpreter_container",
      "Code Interpreter Container",
      codeContainer.id ? statusFromLifecycle(codeContainer.status, "created") : "not-created",
      codeContainer.id || "Run provisioning to create code container"
    ),
    component(
      "generated.code_interpreter_container_status",
      "Code Interpreter Container Status",
      codeContainer.id ? statusFromLifecycle(codeContainer.status, "created") : "not-created",
      codeContainer.status || "Run provisioning to create code container"
    ),
    component(
      "generated.hosted_agent_ocir_repository",
      "Hosted Agent OCIR Repository",
      hostedAgent.repositoryId ? "created" : "not-created",
      hostedAgent.repositoryName || "Run provisioning to create OCIR repository"
    ),
    component(
      "generated.hosted_agent_ocir_repository_id",
      "Hosted Agent OCIR Repository ID",
      hostedAgent.repositoryId ? statusFromLifecycle(ocirRepository["lifecycle-state"], "created") : "not-created",
      hostedAgent.repositoryId || "Run provisioning to create OCIR repository"
    ),
    component(
      "generated.hosted_agent_ocir_image_count",
      "Hosted Agent OCIR Image Count",
      ocirRepository.id ? "created" : "not-created",
      ocirRepository.id ? `${ocirRepository["image-count"] || 0} image(s), ${ocirRepository["layer-count"] || 0} layer(s)` : "Run provisioning to push hosted agent image"
    ),
    component(
      "generated.hosted_agent_image",
      "Hosted Agent Image URI",
      hostedAgent.imageUri ? "created" : "not-created",
      hostedAgent.imageUri || "Run provisioning to push hosted agent image"
    ),
    component(
      "generated.llamaindex_control_tower_ocir_repository",
      "LlamaIndex Control Tower OCIR Repository",
      llamaIndexControlTower.repositoryId ? "created" : "not-created",
      llamaIndexControlTower.repositoryName || "Run provisioning to create LlamaIndex OCIR repository"
    ),
    component(
      "generated.llamaindex_control_tower_ocir_repository_id",
      "LlamaIndex Control Tower OCIR Repository ID",
      llamaIndexControlTower.repositoryId ? statusFromLifecycle(llamaIndexRepository["lifecycle-state"], "created") : "not-created",
      llamaIndexControlTower.repositoryId || "Run provisioning to create LlamaIndex OCIR repository"
    ),
    component(
      "generated.llamaindex_control_tower_hosted_application",
      "LlamaIndex Control Tower Hosted Application",
      llamaIndexControlTower.hostedApplicationId ? statusFromLifecycle(lifecycleValue(llamaIndexApplication), "created") : "not-created",
      llamaIndexControlTower.hostedApplicationId || "Run provisioning to create LlamaIndex hosted application"
    ),
    component(
      "generated.llamaindex_control_tower_hosted_deployment",
      "LlamaIndex Control Tower Hosted Deployment",
      finalLlamaIndexDeploymentId ? statusFromLifecycle(lifecycleValue(llamaIndexDeployment), "created") : "not-created",
      finalLlamaIndexDeploymentId || "Run provisioning to create LlamaIndex hosted deployment"
    ),
    component(
      "generated.llamaindex_control_tower_hosted_url",
      "LlamaIndex Control Tower Hosted URL",
      finalLlamaIndexHostedUrl ? "created" : "not-created",
      finalLlamaIndexHostedUrl || "Run provisioning to expose LlamaIndex hosted URL"
    ),
    component(
      "generated.llamaindex_control_tower_image",
      "LlamaIndex Control Tower Image URI",
      llamaIndexControlTower.imageUri || artifactContainerUri(llamaIndexArtifact) ? "created" : "not-created",
      llamaIndexControlTower.imageUri || artifactContainerUri(llamaIndexArtifact) || "Run provisioning to push LlamaIndex image"
    ),
    component(
      "generated.hosted_agent_application",
      "OCI Hosted Application",
      hostedAgent.hostedApplicationId ? statusFromLifecycle(hostedApplication.status, "created") : "not-created",
      hostedAgent.hostedApplicationId || "Run provisioning to create hosted application"
    ),
    component(
      "generated.hosted_agent_application_work_request",
      "OCI Hosted Application Work Request",
      hostedApplication.id ? statusFromLifecycle(hostedApplication.status, "created") : "not-created",
      hostedApplication.id || "Run provisioning to create hosted application"
    ),
    component(
      "generated.hosted_agent_deployment",
      "OCI Hosted Deployment",
      finalHostedAgentDeploymentId ? statusFromLifecycle(lifecycleValue(hostedDeployment), "created") : "not-created",
      finalHostedAgentDeploymentId || "Run provisioning to create hosted deployment"
    ),
    component(
      "generated.hosted_agent_url",
      "OCI Hosted Agent URL",
      finalHostedAgentUrl ? "created" : "not-created",
      finalHostedAgentUrl || "Run provisioning to expose hosted agent URL"
    ),
    component(
      "generated.hosted_agent_deployment_artifact",
      "OCI Hosted Deployment Artifact",
      hostedArtifact.id ? statusFromLifecycle(hostedArtifact.status, "created") : "not-created",
      artifactContainerUri(hostedArtifact) ? `${artifactContainerUri(hostedArtifact)}:${hostedArtifact.tag || ""}` : "Run provisioning to attach hosted deployment artifact"
    ),
    component(
      "generated.langgraph_hosted_agent_ocir_repository",
      "LangGraph Agent OCIR Repository",
      langGraphAgent.repositoryId ? "created" : "not-created",
      langGraphAgent.repositoryName || "Run provisioning to create LangGraph OCIR repository"
    ),
    component(
      "generated.langgraph_hosted_agent_ocir_repository_id",
      "LangGraph Agent OCIR Repository ID",
      langGraphAgent.repositoryId ? statusFromLifecycle(langGraphRepository["lifecycle-state"], "created") : "not-created",
      langGraphAgent.repositoryId || "Run provisioning to create LangGraph OCIR repository"
    ),
    component(
      "generated.langgraph_hosted_agent_image",
      "LangGraph Agent Image URI",
      langGraphAgent.imageUri ? "created" : "not-created",
      langGraphAgent.imageUri || "Run provisioning to push LangGraph hosted agent image"
    ),
    component(
      "generated.langgraph_hosted_agent_application",
      "LangGraph OCI Hosted Application",
      langGraphAgent.hostedApplicationId ? statusFromLifecycle(langGraphApplication.status, "created") : "not-created",
      langGraphAgent.hostedApplicationId || "Run provisioning to create LangGraph hosted application"
    ),
    component(
      "generated.langgraph_hosted_agent_deployment",
      "LangGraph OCI Hosted Deployment",
      finalLangGraphDeploymentId ? statusFromLifecycle(lifecycleValue(langGraphDeployment), "created") : "not-created",
      finalLangGraphDeploymentId || "Run provisioning to create LangGraph hosted deployment"
    ),
    component(
      "generated.langgraph_hosted_agent_url",
      "LangGraph Hosted Agent URL",
      finalLangGraphHostedUrl ? "created" : "not-created",
      finalLangGraphHostedUrl || "Run provisioning to expose LangGraph hosted URL"
    ),
    component(
      "generated.langgraph_hosted_agent_deployment_artifact",
      "LangGraph OCI Hosted Deployment Artifact",
      langGraphArtifact.id ? statusFromLifecycle(langGraphArtifact.status, "created") : "not-created",
      artifactContainerUri(langGraphArtifact)
        ? `${artifactContainerUri(langGraphArtifact)}:${langGraphArtifact.tag || ""}`
        : "Run provisioning to attach LangGraph hosted deployment artifact"
    ),
    component(
      "generated.n8n_hosted_workflow_ocir_repository",
      "n8n OCIR Repository",
      n8nWorkflow.repositoryId ? "created" : "not-created",
      n8nWorkflow.repositoryName || "Run provisioning to create n8n OCIR repository"
    ),
    component(
      "generated.n8n_hosted_workflow_ocir_repository_id",
      "n8n OCIR Repository ID",
      n8nWorkflow.repositoryId ? statusFromLifecycle(n8nRepository["lifecycle-state"], "created") : "not-created",
      n8nWorkflow.repositoryId || "Run provisioning to create n8n OCIR repository"
    ),
    component(
      "generated.n8n_hosted_workflow_image",
      "n8n Image URI",
      n8nWorkflow.imageUri ? "created" : "not-created",
      n8nWorkflow.imageUri || "Run provisioning to push n8n image"
    ),
    component(
      "generated.n8n_hosted_workflow_application",
      "n8n OCI Hosted Application",
      n8nWorkflow.hostedApplicationId ? statusFromLifecycle(n8nApplication.status, "created") : "not-created",
      n8nWorkflow.hostedApplicationId || "Run provisioning to create n8n hosted application"
    ),
    component(
      "generated.n8n_hosted_workflow_deployment",
      "n8n OCI Hosted Deployment",
      finalN8nDeploymentId ? statusFromLifecycle(lifecycleValue(n8nDeployment), "created") : "not-created",
      finalN8nDeploymentId || "Run provisioning to create n8n hosted deployment"
    ),
    component(
      "generated.n8n_hosted_workflow_deployment_artifact",
      "n8n OCI Hosted Deployment Artifact",
      n8nArtifact.id ? statusFromLifecycle(n8nArtifact.status, "created") : "not-created",
      artifactContainerUri(n8nArtifact) ? `${artifactContainerUri(n8nArtifact)}:${n8nArtifact.tag || ""}` : "Run provisioning to attach n8n hosted deployment artifact"
    ),
    component(
      "generated.n8n_hosted_workflow_url",
      "n8n Hosted URL",
      finalN8nHostedUrl ? "created" : "not-created",
      finalN8nHostedUrl || "Run provisioning to create n8n hosted URL"
    ),
    component(
      "generated.langfuse_hosted_observability_ocir_repository",
      "Langfuse OCIR Repository",
      langfuseRepositoryId ? "created" : "not-created",
      langfuseObservability.repositoryName || "Run provisioning to create Langfuse OCIR repository"
    ),
    component(
      "generated.langfuse_hosted_observability_ocir_repository_id",
      "Langfuse OCIR Repository ID",
      langfuseRepositoryId ? statusFromLifecycle(langfuseRepository["lifecycle-state"], "created") : "not-created",
      langfuseRepositoryId || "Run provisioning to create Langfuse OCIR repository"
    ),
    component(
      "generated.langfuse_hosted_observability_image",
      "Langfuse Image URI",
      langfuseObservability.imageUri ? "created" : "not-created",
      langfuseObservability.imageUri || "Run provisioning to push Langfuse image"
    ),
    component(
      "generated.langfuse_hosted_observability_application",
      "Langfuse OCI Hosted Application",
      langfuseObservability.hostedApplicationId ? statusFromLifecycle(langfuseApplication.status, "created") : "not-created",
      langfuseObservability.hostedApplicationId || "Run provisioning to create Langfuse hosted application"
    ),
    component(
      "generated.langfuse_hosted_observability_deployment",
      "Langfuse OCI Hosted Deployment",
      finalLangfuseDeploymentId ? statusFromLifecycle(lifecycleValue(langfuseDeployment), "created") : "not-created",
      finalLangfuseDeploymentId || "Run provisioning to create Langfuse hosted deployment"
    ),
    component(
      "generated.langfuse_hosted_observability_deployment_artifact",
      "Langfuse OCI Hosted Deployment Artifact",
      langfuseArtifact.id ? statusFromLifecycle(langfuseArtifact.status, "created") : "not-created",
      artifactContainerUri(langfuseArtifact) ? `${artifactContainerUri(langfuseArtifact)}:${langfuseArtifact.tag || ""}` : "Run provisioning to attach Langfuse hosted deployment artifact"
    ),
    component(
      "generated.langfuse_hosted_observability_url",
      "Langfuse Hosted URL",
      finalLangfuseHostedUrl ? "created" : "not-created",
      finalLangfuseHostedUrl || "Run provisioning to create Langfuse hosted URL"
    ),
    component(
      "generated.openclaw_hosted_gateway_ocir_repository",
      "OpenClaw OCIR Repository",
      openclawGateway.repositoryId ? "created" : "not-created",
      openclawGateway.repositoryName || "Run provisioning to create OpenClaw OCIR repository"
    ),
    component(
      "generated.openclaw_hosted_gateway_ocir_repository_id",
      "OpenClaw OCIR Repository ID",
      openclawGateway.repositoryId ? statusFromLifecycle(openclawRepository["lifecycle-state"], "created") : "not-created",
      openclawGateway.repositoryId || "Run provisioning to create OpenClaw OCIR repository"
    ),
    component(
      "generated.openclaw_hosted_gateway_image",
      "OpenClaw Image URI",
      openclawGateway.imageUri ? "created" : "not-created",
      openclawGateway.imageUri || "Run provisioning to push OpenClaw image"
    ),
    component(
      "generated.openclaw_hosted_gateway_application",
      "OpenClaw OCI Hosted Application",
      openclawGateway.hostedApplicationId ? statusFromLifecycle(openclawApplication.status, "created") : "not-created",
      openclawGateway.hostedApplicationId || "Run provisioning to create OpenClaw hosted application"
    ),
    component(
      "generated.openclaw_hosted_gateway_deployment",
      "OpenClaw OCI Hosted Deployment",
      finalOpenclawDeploymentId ? statusFromLifecycle(lifecycleValue(openclawDeployment), "created") : "not-created",
      finalOpenclawDeploymentId || "Run provisioning to create OpenClaw hosted deployment"
    ),
    component(
      "generated.openclaw_hosted_gateway_deployment_artifact",
      "OpenClaw OCI Hosted Deployment Artifact",
      openclawArtifact.id ? statusFromLifecycle(openclawArtifact.status, "created") : "not-created",
      artifactContainerUri(openclawArtifact) ? `${artifactContainerUri(openclawArtifact)}:${openclawArtifact.tag || ""}` : "Run provisioning to attach OpenClaw hosted deployment artifact"
    ),
    component(
      "generated.openclaw_hosted_gateway_url",
      "OpenClaw Hosted URL",
      finalOpenclawHostedUrl ? "created" : "not-created",
      finalOpenclawHostedUrl || "Run provisioning to create OpenClaw hosted URL"
    )
  ];
}

export function mergeInfrastructureComponents(terraformComponents = [], runtimeComponents = []) {
  const byName = new Map();
  for (const component of terraformComponents) {
    byName.set(component.name, component);
  }
  for (const component of runtimeComponents) {
    byName.set(component.name, component);
  }
  return [...byName.values()].sort((left, right) =>
    String(left.name || left.address || "").localeCompare(String(right.name || right.address || ""), undefined, {
      sensitivity: "base"
    })
  );
}

export async function readAllTerraformStates() {
  const modules = [
    "infra/responses-api",
    "infra/shared-demo-security",
    "infra/file-search-vector-store-rag",
    "infra/code-interpreter",
    "infra/nl2sql-sql-search",
    "infra/hosted-agentic-applications"
  ];
  const states = await Promise.all(modules.map((modulePath) => readTerraformState(modulePath)));
  const resources = states.flatMap((state) => state.resources);
  const logs = states.map((state, index) => ({
    ...state.result,
    label: `${modules[index]} state`
  }));

  return {
    resources,
    logs
  };
}

export async function getResponsesInfrastructureState({ refresh = false } = {}) {
  const refreshLogs = refresh
    ? [await runCommand(buildHostedTerraformRefreshCommand()), ...(await refreshGeneratedRuntimeState())]
    : [];
  const currentState = await readAllTerraformStates();
  const provisionedDetails = readProvisionedDetails();
  const runtimeComponents = [
    ...demoRuntimeComponents(),
    ...sharedResponsesDemoComponents({
      projectId: provisionedDetails.projectId,
      apiKeyAvailable: Boolean(provisionedDetails.apiKeySecret)
    })
  ];
  const components = mergeInfrastructureComponents(currentState.resources, runtimeComponents);
  return {
    feature: "OCI Responses API",
    action: "state",
    ...summarizeInfrastructureState(currentState.resources, provisionedDetails),
    components,
    values: {
      ...summarizeInfrastructureState(currentState.resources, provisionedDetails).values,
      vectorStoreId: runtimeComponents.find((component) => component.name === "File Search Vector Store")?.value || "",
      codeInterpreterContainerId: runtimeComponents.find((component) => component.name === "Code Interpreter Container")?.value || "",
      n8nHostedUrl: runtimeComponents.find((component) => component.name === "n8n Hosted URL")?.value || "",
      n8nHostedDeploymentId: runtimeComponents.find((component) => component.name === "n8n OCI Hosted Deployment")?.value || "",
      n8nHostedDeploymentStatus: runtimeComponents.find((component) => component.name === "n8n OCI Hosted Deployment")?.status || "",
      langfuseHostedUrl: runtimeComponents.find((component) => component.name === "Langfuse Hosted URL")?.value || "",
      langfuseHostedDeploymentId: runtimeComponents.find((component) => component.name === "Langfuse OCI Hosted Deployment")?.value || "",
      langfuseHostedDeploymentStatus: runtimeComponents.find((component) => component.name === "Langfuse OCI Hosted Deployment")?.status || "",
      openclawHostedUrl: runtimeComponents.find((component) => component.name === "OpenClaw Hosted URL")?.value || "",
      openclawHostedDeploymentId: runtimeComponents.find((component) => component.name === "OpenClaw OCI Hosted Deployment")?.value || "",
      openclawHostedDeploymentStatus: runtimeComponents.find((component) => component.name === "OpenClaw OCI Hosted Deployment")?.status || "",
      llamaIndexHostedUrl: runtimeComponents.find((component) => component.name === "LlamaIndex Control Tower Hosted URL")?.value || "",
      llamaIndexHostedDeploymentId: runtimeComponents.find((component) => component.name === "LlamaIndex Control Tower Hosted Deployment")?.value || "",
      llamaIndexHostedDeploymentStatus: runtimeComponents.find((component) => component.name === "LlamaIndex Control Tower Hosted Deployment")?.status || ""
    },
    logs: [...refreshLogs, ...currentState.logs]
  };
}

function demoCallSnippet(featureId) {
  const snippets = {
    "file-search-vector-store-rag": `tool = {
    "type": "file_search",
    "vector_store_ids": [vector_store_id],
}
response = call_oci_responses_api_with_tools(
    prompt=prompt,
    temperature=temperature,
    model=model,
    config=config,
    tools=[tool],
)`,
    "code-interpreter": `tool = {
    "type": "code_interpreter",
    "container": {"type": "auto"},
}
response = call_oci_responses_api_with_tools(
    prompt=prompt,
    temperature=temperature,
    model=model,
    config=config,
    tools=[tool],
)`,
    "nl2sql-sql-search": `sql = generate_select_statement(prompt, model, config)
validated_sql = validate_select_only(sql)
rows = run_query_against_sample_dataset(validated_sql)
summary = summarize_rows_with_responses_api(rows, config)`,
    "hosted-agentic-applications": `metadata = read_hosted_agent_metadata()
request = build_incident_payload(prompt, metadata)
result = call_hosted_agent_or_return_config(metadata, request)`,
    "langgraph-hosted-agent-mcp": `graph = load_langgraph_runtime()
mcp_tools = graph.discover_mcp_tools()
selected_tool = graph.select_tool(prompt, mcp_tools)
response = call_oci_responses_api(build_agent_prompt(graph, selected_tool), temperature, model, config)`,
    "agentic-control-tower": `workflow = build_llamaindex_control_tower()
workflow_result = run_workflow(workflow, prompt, idcs_posture)
response = call_oci_responses_api(build_control_tower_prompt(workflow_result), temperature, model, config)`,
    "agentic-rag-planner": `plan = build_retrieval_plan(prompt)
queries = plan["retrievalQueries"]
response = call_oci_responses_api(build_grounded_plan_prompt(plan), temperature, model, config)`,
    "human-approval-agent": `approval = classify_agent_action_risk(prompt)
if approval["approvalRequired"]:
    response = call_oci_responses_api(build_approval_prompt(approval), temperature, model, config)`,
    "governance-center": `decision = evaluate_policy(prompt)
audit_event = persist_audit_event(decision)
if decision["allowed"]:
    response = call_oci_responses_api(sanitized_prompt, temperature, model, config)`,
    "document-understanding-genai": `documents = load_bundled_oracle_pdf_metadata()
signals = extract_document_signals(documents)
response = call_oci_responses_api(build_document_prompt(signals), temperature, model, config)`,
    "batch-inference": `job_manifest = build_batch_job_manifest(records)
response = call_oci_responses_api(build_batch_prompt(job_manifest), temperature, model, config)
collect_outputs_for_review(response)`,
    "model-evaluation": `rubric = load_evaluation_rubric()
eval_cases = load_eval_cases()
response = call_oci_responses_api(build_eval_prompt(rubric, eval_cases), temperature, model, config)`,
    "multimodal-vision": `asset_manifest = prepare_visual_asset_manifest()
response = call_oci_responses_api(build_visual_context_prompt(asset_manifest), temperature, model, config)`,
    "ai-workflow-orchestration": `workflow = load_orchestration_plan()
response = call_oci_responses_api(build_workflow_prompt(workflow), temperature, model, config)
persist_audited_outcome(response)`
  };

  return snippets[featureId] || `response = call_oci_responses_api(
    prompt=prompt,
    temperature=temperature,
    model=model,
    config=config,
)`;
}

function buildRunTrace({ featureId, scriptName, payload, runtimeConfig, stdout, stderr, parsed, status, durationMs, error }) {
  const pythonTrace = Array.isArray(parsed?.trace) ? parsed.trace : [];
  const requestSummary = {
    featureId,
    model: payload.model || defaultResponsesModel,
    promptChars: String(payload.prompt || "").length,
    hasProjectId: Boolean(payload.projectId),
    hasVectorStoreId: Boolean(payload.vectorStoreId),
    hasCodeInterpreterContainer: Boolean(payload.codeInterpreterContainer)
  };
  const command = `${pythonExecutable} backend/demos/${scriptName}`;

  return [
    {
      id: "request-prepared",
      label: "Request Prepared",
      status: "success",
      durationMs: 0,
      explanation: "The portal collected the prompt, model, project, and optional tool resource IDs before calling the run API.",
      snippet: `const response = await fetch("/api/features/${featureId}/run", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(requestPayload)
});`,
      details: requestSummary
    },
    {
      id: "runtime-config",
      label: "Runtime Config Resolved",
      status: runtimeConfig.projectConfigured && runtimeConfig.apiKeyConfigured ? "success" : "warning",
      durationMs: 0,
      explanation: "The server merged request values, Terraform-generated values, and environment variables used by the Python demo.",
      snippet: `const runtimeConfig = {
  region: payload.region || process.env.OCI_GENAI_REGION,
  projectConfigured: Boolean(payload.projectId || provisionedDetails.projectId),
  apiKeyConfigured: Boolean(payload.apiKey || provisionedDetails.apiKeySecret),
  vectorStoreConfigured: Boolean(payload.vectorStoreId || process.env.OCI_GENAI_VECTOR_STORE_ID),
  codeInterpreterContainerConfigured: Boolean(payload.codeInterpreterContainer || process.env.OCI_GENAI_CODE_INTERPRETER_CONTAINER)
};`,
      details: runtimeConfig
    },
    {
      id: "python-demo",
      label: "Python Demo Executed",
      status: status === "success" ? "success" : "failed",
      durationMs,
      explanation: "Node launched the feature-specific Python demo and passed the request payload through stdin.",
      command,
      snippet: `const child = spawn(pythonExecutable, [join(root, "backend/demos/${scriptName}")], {
  cwd: root,
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, OCI_GENAI_PROJECT_ID, OCI_GENAI_API_KEY }
});
child.stdin.end(JSON.stringify(payload));`,
      stdout: stdout.trim(),
      stderr: stderr.trim()
    },
    {
      id: "backend-call",
      label: "Backend Call Path",
      status: error ? "failed" : "success",
      durationMs: 0,
      explanation: pythonTrace.length
        ? pythonTrace.join(" -> ")
        : "The Python demo prepared the OCI request path and returned structured JSON.",
      snippet: demoCallSnippet(featureId),
      details: parsed?.request || {}
    },
    {
      id: "response-parsed",
      label: "Response Parsed",
      status: error ? "failed" : "success",
      durationMs: 0,
      explanation: error
        ? "The run returned a structured error payload for the UI instead of raw process output."
        : "The server parsed the Python JSON response and returned it to the browser with the run trace.",
      snippet: `const parsed = JSON.parse(stdout);
parsed.trace = buildRunTrace({ featureId, scriptName, payload, runtimeConfig, stdout, stderr, parsed, status, durationMs });
sendJson(response, 200, parsed);`,
      details: error ? { error } : { outputChars: JSON.stringify(parsed || {}).length }
    }
  ];
}

async function runHostedLlamaIndexControlTower(payload, runtimeConfig, startedAt = Date.now()) {
  const featureId = "agentic-control-tower";
  const targetUrl = llamaIndexControlTowerProxyTargetUrl("/api/llamaindex/launch/agent/control-tower/respond");
  const token = await getIdcsAccessToken();
  const requestPayload = {
    id: payload.sessionId || "portal-control-tower-run",
    prompt: payload.prompt || "Coordinate an enterprise incident response."
  };
  const upstream = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(requestPayload)
  });
  const responseBody = await upstream.text();
  let parsed;
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    throw new Error(`Hosted LlamaIndex response was not JSON: ${responseBody.slice(0, 500)}`);
  }
  const durationMs = Date.now() - startedAt;
  const result = {
    feature: "Agentic Control Tower",
    mode: "agentic-control-tower",
    hosted: true,
    runtime: "llamaindex",
    request: {
      model: payload.model || defaultResponsesModel,
      prompt: requestPayload.prompt,
      hostedUrl: `${targetUrl.origin}${targetUrl.pathname}`
    },
    output: parsed.response || JSON.stringify(parsed.workflow || parsed),
    hostedResponse: parsed,
    trace: [
      "Resolved active OCI hosted LlamaIndex deployment",
      "Fetched IDCS access token with server-side launch client",
      "Called hosted LlamaIndex control tower endpoint",
      "Returned hosted workflow response to portal"
    ],
    status: upstream.ok ? "success" : "failed",
    durationMs
  };
  result.logFile = writeDemoLog(featureId, {
    action: "run-hosted",
    status: upstream.ok ? "success" : "failed",
    durationMs,
    runtimeConfig,
    request: requestPayload,
    response: result
  });
  if (!upstream.ok) {
    const error = new Error(parsed.error || `Hosted LlamaIndex call failed with status ${upstream.status}`);
    error.payload = result;
    throw error;
  }
  return result;
}

export function runFeatureDemo(featureId, payload) {
  const scriptName = demoScripts[featureId];
  if (!scriptName) {
    return Promise.reject(new Error(`No runnable demo is configured for ${featureId}.`));
  }

  const provisionedDetails = readProvisionedDetails();
  const startedAt = Date.now();
  const idcsPosture = idcsDemoCredentialPosture();
  const hostedLlamaIndexMetadata = featureId === "agentic-control-tower" ? readLlamaIndexControlTowerMetadata() : {};
  const hostedLlamaIndexUrl = featureId === "agentic-control-tower" ? readLlamaIndexControlTowerLaunchUrl() : "";
  const runtimeConfig = {
    region: payload.region || process.env.OCI_GENAI_REGION || "",
    projectConfigured: Boolean(payload.projectId || provisionedDetails.projectId || process.env.OCI_GENAI_PROJECT_ID),
    apiKeyConfigured: Boolean(payload.apiKey || provisionedDetails.apiKeySecret || process.env.OCI_GENAI_API_KEY),
    vectorStoreConfigured: Boolean(payload.vectorStoreId || process.env.OCI_GENAI_VECTOR_STORE_ID),
    codeInterpreterContainerConfigured: Boolean(payload.codeInterpreterContainer || process.env.OCI_GENAI_CODE_INTERPRETER_CONTAINER),
    idcsConfigured: idcsPosture.configured,
    hostedLlamaIndexConfigured: Boolean(hostedLlamaIndexUrl),
    hostedLlamaIndexDeploymentStatus: hostedLlamaIndexMetadata.hostedDeploymentLifecycleState || ""
  };
  console.log(`[demo-run] starting feature=${featureId} script=${scriptName} config=${JSON.stringify(runtimeConfig)}`);

  if (
    featureId === "agentic-control-tower" &&
    hostedLlamaIndexUrl &&
    String(hostedLlamaIndexMetadata.hostedDeploymentLifecycleState || "").toUpperCase() === "ACTIVE"
  ) {
    return runHostedLlamaIndexControlTower(payload, runtimeConfig, startedAt);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(pythonExecutable, [join(root, `backend/demos/${scriptName}`)], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      env: demoProcessEnv(process.env, {
        OCI_GENAI_REGION: payload.region || process.env.OCI_GENAI_REGION || "",
        OCI_GENAI_PROJECT_ID: payload.projectId || provisionedDetails.projectId || process.env.OCI_GENAI_PROJECT_ID || "",
        OCI_GENAI_API_KEY: payload.apiKey || provisionedDetails.apiKeySecret || process.env.OCI_GENAI_API_KEY || "",
        OCI_GENAI_VECTOR_STORE_ID: payload.vectorStoreId || process.env.OCI_GENAI_VECTOR_STORE_ID || "",
        OCI_GENAI_CODE_INTERPRETER_CONTAINER: payload.codeInterpreterContainer || process.env.OCI_GENAI_CODE_INTERPRETER_CONTAINER || "",
        OCI_HOSTED_APP_IDCS_POSTURE: JSON.stringify(idcsPosture),
        OCI_HOSTED_APP_IDCS_DOMAIN_URL: idcsPosture.domainUrl,
        OCI_HOSTED_APP_IDCS_AUDIENCE: idcsPosture.audience,
        OCI_HOSTED_APP_IDCS_SCOPE: idcsPosture.scope
      })
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      const durationMs = Date.now() - startedAt;
      const runError = new Error(error.message);
      runError.payload = {
        status: "failed",
        durationMs,
        error: error.message,
        logFile: writeDemoLog(featureId, {
          action: "run",
          status: "failed",
          durationMs,
          runtimeConfig,
          request: payload,
          stdout,
          stderr,
          error: error.message
        })
      };
      reject(runError);
    });
    child.on("close", (code) => {
      const durationMs = Date.now() - startedAt;
      if (code !== 0) {
        try {
          const parsed = JSON.parse(stdout);
          const error = parsed.error || stderr || `Python demo exited with code ${code}`;
          parsed.status = "failed";
          parsed.durationMs = durationMs;
          parsed.trace = buildRunTrace({
            featureId,
            scriptName,
            payload,
            runtimeConfig,
            stdout,
            stderr,
            parsed,
            status: "failed",
            durationMs,
            error
          });
          parsed.logs = [{ label: "python", status: "failed", command: `${pythonExecutable} backend/demos/${scriptName}`, stdout, stderr }];
          parsed.logFile = writeDemoLog(featureId, {
            action: "run",
            status: "failed",
            durationMs,
            runtimeConfig,
            request: payload,
            stdout,
            stderr,
            response: parsed
          });
          console.error(`[demo-run] failed feature=${featureId} exit=${code} durationMs=${durationMs} error=${error}`);
          const runError = new Error(error);
          runError.payload = parsed;
          reject(runError);
        } catch {
          console.error(`[demo-run] failed feature=${featureId} exit=${code} durationMs=${durationMs} error=${stderr || stdout}`);
          const error = stderr || stdout || `Python demo exited with code ${code}`;
          const runError = new Error(error);
          runError.payload = {
            status: "failed",
            durationMs,
            error,
            trace: buildRunTrace({ featureId, scriptName, payload, runtimeConfig, stdout, stderr, parsed: {}, status: "failed", durationMs, error }),
            logs: [{ label: "python", status: "failed", command: `${pythonExecutable} backend/demos/${scriptName}`, stdout, stderr }]
          };
          runError.payload.logFile = writeDemoLog(featureId, {
            action: "run",
            status: "failed",
            durationMs,
            runtimeConfig,
            request: payload,
            stdout,
            stderr,
            error
          });
          reject(runError);
        }
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        parsed.status = "success";
        parsed.durationMs = durationMs;
        parsed.trace = buildRunTrace({ featureId, scriptName, payload, runtimeConfig, stdout, stderr, parsed, status: "success", durationMs });
        parsed.logs = [{ label: "python", status: "success", command: `${pythonExecutable} backend/demos/${scriptName}`, stdout, stderr }];
        parsed.logFile = writeDemoLog(featureId, {
          action: "run",
          status: "success",
          durationMs,
          runtimeConfig,
          request: payload,
          stdout,
          stderr,
          response: parsed
        });
        console.log(`[demo-run] completed feature=${featureId} exit=${code} durationMs=${durationMs}`);
        resolve(parsed);
      } catch (error) {
        console.error(`[demo-run] failed feature=${featureId} exit=${code} durationMs=${durationMs} error=${error.message}`);
        const runError = new Error(`Python demo returned invalid JSON: ${error.message}`);
        runError.payload = {
          status: "failed",
          durationMs,
          error: runError.message,
          logFile: writeDemoLog(featureId, {
            action: "run",
            status: "failed",
            durationMs,
            runtimeConfig,
            request: payload,
            stdout,
            stderr,
            error: runError.message
          })
        };
        reject(runError);
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

export function runResponsesApiDemo(payload) {
  return runFeatureDemo("responses-api", payload);
}

export const server = createServer(async (request, response) => {
  const requestUrl = request.url ?? "/";
  const parsedUrl = new URL(requestUrl, `http://${host}:${port}`);
  const requestPath = parsedUrl.pathname;

  if (request.method === "GET" && requestPath === "/login") {
    if (isAuthorizedRequest(request)) {
      response.writeHead(302, { Location: "/" });
      response.end();
      return;
    }

    sendLoginPage(response);
    return;
  }

  if (request.method === "POST" && requestPath === "/login") {
    const body = await readRequestBody(request);
    const form = new URLSearchParams(body);
    const username = String(form.get("username") || "").trim();
    const password = String(form.get("password") || "");

    if (username === portalAuthUser && password === portalAuthPassword) {
      const token = createPortalSession();
      response.writeHead(302, {
        Location: "/",
        "Set-Cookie": sessionCookie(token),
        "Cache-Control": "no-store"
      });
      response.end();
      return;
    }

    sendLoginPage(response, 401, { error: "Invalid username or password." });
    return;
  }

  if (request.method === "POST" && requestPath === "/forgot-password") {
    printCurrentPasswordToConsole();
    sendLoginPage(response, 200, { notice: "The current password was printed to the server console." });
    return;
  }

  if (request.method === "POST" && requestPath === "/logout") {
    const sessionToken = parseCookies(request.headers.cookie || "")[portalSessionCookie];
    if (sessionToken) {
      portalSessionTokens.delete(sessionToken);
    }

    response.writeHead(302, {
      Location: "/login",
      "Set-Cookie": clearSessionCookie(),
      "Cache-Control": "no-store"
    });
    response.end();
    return;
  }

  if (!isAuthorizedRequest(request)) {
    requestLogin(request, response, requestPath);
    return;
  }

  if (requestPath === "/api/n8n/launch" || requestPath.startsWith("/api/n8n/launch/")) {
    await proxyN8nLaunch(request, response, parsedUrl);
    return;
  }

  if (requestPath === "/api/langfuse/launch" || requestPath.startsWith("/api/langfuse/launch/")) {
    await proxyLangfuseLaunch(request, response, parsedUrl);
    return;
  }

  if (requestPath === "/api/openclaw/launch" || requestPath.startsWith("/api/openclaw/launch/")) {
    await proxyOpenClawLaunch(request, response, parsedUrl);
    return;
  }

  if (requestPath === "/api/llamaindex/launch" || requestPath.startsWith("/api/llamaindex/launch/")) {
    await proxyLlamaIndexControlTowerLaunch(request, response, parsedUrl);
    return;
  }

  if (isLangfusePassthroughPath(requestPath)) {
    await proxyLangfuseLaunch(request, response, parsedUrl);
    return;
  }

  const runMatch = requestPath.match(/^\/api\/features\/([a-z0-9-]+)\/run$/);
  if (request.method === "POST" && runMatch) {
    try {
      const body = await readRequestBody(request);
      const payload = body ? JSON.parse(body) : {};
      const result = await runFeatureDemo(runMatch[1], payload);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 500, {
        error: error.message,
        ...(error.payload || {})
      });
    }
    return;
  }

  if (request.method === "GET" && requestPath === "/api/features/responses-api/state") {
    try {
      const result = await getResponsesInfrastructureState({ refresh: parsedUrl.searchParams.get("refresh") === "true" });
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 500, {
        feature: "OCI Responses API",
        action: "state",
        status: "failed",
        error: error.message,
        components: [],
        logs: []
      });
    }
    return;
  }

  const filePath = resolvePath(requestPath);
  const pathToServe = existsSync(filePath) && statSync(filePath).isFile() ? filePath : join(root, "index.html");
  const extension = extname(pathToServe);

  response.writeHead(200, {
    "Content-Type": contentTypes[extension] ?? "application/octet-stream"
  });

  createReadStream(pathToServe).pipe(response);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Try: PORT=${port + 1} ./bash.sh`);
    process.exit(1);
  }

  if (error.code === "EPERM") {
    console.error(`Cannot bind to ${host}:${port}. Try another port with: PORT=${port + 1} ./bash.sh`);
    process.exit(1);
  }

  throw error;
});

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(port, host, () => {
    console.log(`Enterprise AI demo portal is running at http://localhost:${port}`);
    console.log(`Portal login username: ${portalAuthUser}`);
    if (portalAuthPasswordConfig.source === "local-file") {
      console.log(`Portal login password source: ${portalAuthPasswordFile}`);
    } else if (portalAuthPasswordConfig.source === "env-file") {
      console.log("Portal login password source: OCI_PORTAL_PASSWORD");
    } else {
      console.log(`Generated portal login password: ${portalAuthPassword}`);
      console.log(`Portal login password saved to: ${portalAuthPasswordFile}`);
    }
  });
}
