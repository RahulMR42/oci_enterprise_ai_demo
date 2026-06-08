import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { aiFeatures } from "../src/data/aiFeatures.js";

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

test("demo features provide card and flip-side content", () => {
  assert.equal(aiFeatures.length, 27);

  const featureIds = aiFeatures.map((feature) => feature.id);
  assert.deepEqual(featureIds, [
    "responses-api",
    "openai-compatible-chat",
    "responses-streaming-structured-output",
    "conversation-store",
    "guardrails",
    "file-search-vector-store-rag",
    "code-interpreter",
    "function-calling",
    "remote-mcp-calling",
    "nl2sql-sql-search",
    "long-term-memory",
    "multi-model-routing",
    "hosted-agentic-applications",
    "langgraph-hosted-agent-mcp",
    "a2a-agent-collaboration",
    "langfuse-hosted-observability",
    "openclaw-hosted-agent-gateway",
    "agentic-control-tower",
    "agentic-rag-planner",
    "locus-sdk-agentic-workflows",
    "human-approval-agent",
    "governance-center",
    "document-understanding-genai",
    "batch-inference",
    "model-evaluation",
    "multimodal-vision",
    "ai-workflow-orchestration"
  ]);

  for (const feature of aiFeatures) {
    assert.ok(feature.id);
    assert.ok(feature.title);
    assert.ok(feature.summary);
    assert.ok(feature.details);
    assert.ok(feature.serviceArea);
    assert.ok(feature.status);
    assert.ok(feature.demoHref);
    assert.ok(feature.docsHref);
    assert.ok(
        feature.docsHref.startsWith("https://docs.oracle.com/") ||
        feature.docsHref.startsWith("https://docs.openclaw.ai/") ||
        feature.docsHref.startsWith("https://docs.llamaindex.ai/") ||
        feature.docsHref.startsWith("https://locusagents.oracle.com/")
    );
    assert.ok(feature.terraformPath);
    assert.ok(feature.sdkModule);
    assert.ok(feature.sampleUseCase);
    assert.ok(feature.provisioningDetails);
    assert.ok(Array.isArray(feature.capabilities));
    assert.ok(feature.capabilities.length >= 3);
    assert.deepEqual(feature.actions, ["Provision Infra", "Run Demo", "Delete Infra"]);
  }
});

test("demo catalog does not expose n8n demos or documentation", () => {
  const catalogText = JSON.stringify(aiFeatures);

  assert.equal(aiFeatures.some((feature) => /n8n/i.test(feature.id)), false);
  assert.equal(aiFeatures.some((feature) => /n8n/i.test(feature.title)), false);
  assert.equal(aiFeatures.some((feature) => /docs\.n8n\.io/i.test(feature.docsHref)), false);
  assert.doesNotMatch(catalogText, /n8n/i);
});

test("portal stylesheet uses Oracle Cloud palette tokens", () => {
  const styles = readFileSync("src/styles.css", "utf8");
  const server = readFileSync("server.mjs", "utf8");

  assert.match(styles, /--oci-brand-red:\s*#c74634;/);
  assert.match(styles, /--oci-cloud-ink:\s*#1f1f1f;/);
  assert.match(styles, /--oci-console-bg:\s*#f8f7f4;/);
  assert.match(styles, /--oci-cyan:\s*#00758f;/);
  assert.match(server, /--oci-brand-red:\s*#c74634;/);
  assert.match(server, /Oracle Cloud/);
  assert.doesNotMatch(styles, /#1d4ed8/);
  assert.doesNotMatch(server, /#1d4ed8/);
});

test("Agentic Control Tower demo describes LlamaIndex and IDCS posture", () => {
  const feature = aiFeatures.find((item) => item.id === "agentic-control-tower");

  assert.ok(feature);
  assert.equal(feature.title, "Agentic Control Tower");
  assert.equal(feature.sdkModule, "backend/demos/agentic_control_tower.py");
  assert.match(feature.summary, /LlamaIndex/);
  assert.match(feature.details, /IDCS proxy/);
  assert.match(feature.provisioningDetails, /Terraform-generated IDCS client/);
  assert.deepEqual(feature.capabilities, ["Hosted LlamaIndex runtime", "Tool critique loop", "IDCS proxy execution"]);
});

test("Conversation Store demo describes OCI-managed Conversations API state", () => {
  const feature = aiFeatures.find((item) => item.id === "conversation-store");

  assert.ok(feature);
  assert.equal(feature.title, "Conversation Store");
  assert.equal(feature.terraformPath, "infra/conversation-store");
  assert.match(feature.details, /OCI Conversations API/);
  assert.match(feature.provisioningDetails, /generated conversation ID/);
  assert.deepEqual(feature.capabilities, ["OCI conversation object", "Context replay", "Live OCI Responses API call"]);
});

test("File Search demo states that vector store provisioning is required by default", () => {
  const feature = aiFeatures.find((item) => item.id === "file-search-vector-store-rag");

  assert.ok(feature);
  assert.match(feature.provisioningDetails, /provisioned by default/);
  assert.match(feature.provisioningDetails, /OCI_GENAI_VECTOR_STORE_ID/);
  assert.deepEqual(feature.capabilities, ["File ingestion", "Vector retrieval", "Grounded answers"]);
});

test("new OCI Generative AI cards use exact documented API features and shared infra", () => {
  const chat = aiFeatures.find((item) => item.id === "openai-compatible-chat");
  const streaming = aiFeatures.find((item) => item.id === "responses-streaming-structured-output");

  assert.ok(chat);
  assert.equal(chat.title, "OpenAI-Compatible Chat Completions");
  assert.equal(chat.terraformPath, "infra/responses-api");
  assert.equal(chat.sdkModule, "backend/demos/openai_compatible_chat.py");
  assert.equal(chat.docsHref, "https://docs.oracle.com/en-us/iaas/Content/generative-ai/chat-completions-api.htm");
  assert.match(chat.details, /Chat Completions/);
  assert.deepEqual(chat.capabilities, [
    "Chat Completions API",
    "OpenAI-compatible client",
    "OCI project-scoped execution"
  ]);

  assert.ok(streaming);
  assert.equal(streaming.title, "Responses Streaming + Structured Output");
  assert.equal(streaming.terraformPath, "infra/responses-api");
  assert.equal(streaming.sdkModule, "backend/demos/responses_streaming_structured_output.py");
  assert.equal(streaming.docsHref, "https://docs.oracle.com/en-us/iaas/Content/generative-ai/responses-api.htm");
  assert.match(streaming.details, /streaming enabled and a JSON schema output contract/);
  assert.deepEqual(streaming.capabilities, [
    "Streaming events",
    "Structured JSON schema",
    "Responses API event trace"
  ]);
});

test("LangGraph and Locus executable demos load their SDKs", () => {
  const langgraphBackend = readFileSync("backend/demos/langgraph_hosted_agent_mcp.py", "utf8");
  const langgraphHosted = readFileSync("apps/hosted-langgraph-agent/app.py", "utf8");
  const locusBackend = readFileSync("backend/demos/locus_sdk_agentic_workflows.py", "utf8");
  const requirements = readFileSync("requirements.txt", "utf8");

  assert.match(langgraphHosted, /from langgraph\.graph import END, StateGraph/);
  assert.match(langgraphBackend, /from langgraph\.graph import END, StateGraph/);
  assert.match(langgraphBackend, /StateGraph\(_LangGraphState\)/);
  assert.match(requirements, /langgraph==0\.2\.76/);

  assert.match(locusBackend, /from locus\.agent import Agent/);
  assert.match(locusBackend, /from locus\.tools import tool/);
  assert.match(locusBackend, /@tool/);
  assert.match(requirements, /locus-sdk\[oci\]==0\.2\.0b26/);
});

test("Responses streaming demo does not mix reasoning deltas into structured output", () => {
  const streamingBackend = readFileSync("backend/demos/responses_streaming_structured_output.py", "utf8");

  assert.match(streamingBackend, /event_type == "response\.output_text\.delta"/);
  assert.match(streamingBackend, /def _parse_structured_output\(output\):/);
  assert.doesNotMatch(streamingBackend, /"delta" in event_json/);
  assert.doesNotMatch(streamingBackend, /response\.reasoning_text\.delta/);
});

test("portal exposes mermaid-style flow diagrams for feature cards", () => {
  const main = readFileSync("src/main.js", "utf8");

  assert.match(main, /const flowDiagrams = \{/);
  assert.match(main, /"openai-compatible-chat"[\s\S]*OpenAI-compatible OCI endpoint/);
  assert.match(main, /"responses-streaming-structured-output"[\s\S]*JSON schema/);
  assert.match(main, /"file-search-vector-store-rag"[\s\S]*Bundled Oracle PDFs/);
  assert.match(main, /"batch-inference"[\s\S]*Async processing/);
  assert.match(main, /"model-evaluation"[\s\S]*Promotion gate/);
  assert.match(main, /"multimodal-vision"[\s\S]*Visual asset/);
  assert.match(main, /"ai-workflow-orchestration"[\s\S]*Audited outcome/);
  assert.match(main, /"langgraph-hosted-agent-mcp"[\s\S]*MCP tool call/);
  assert.match(main, /"a2a-agent-collaboration"[\s\S]*Agent card discovery/);
  assert.match(main, /"agentic-rag-planner"[\s\S]*Evidence check/);
  assert.match(main, /"locus-sdk-agentic-workflows"[\s\S]*Locus SDK Agentic Workflow/);
  assert.match(main, /"human-approval-agent"[\s\S]*Approval checkpoint/);
  assert.match(main, /flowchart LR/);
  assert.match(main, /data-show-flow/);
  assert.match(main, /flow-dialog/);
  assert.match(main, /openFlowDiagram/);
});

test("Langfuse demo describes managed OCI dependencies", () => {
  const feature = aiFeatures.find((item) => item.id === "langfuse-hosted-observability");

  assert.ok(feature);
  assert.match(feature.details, /managed OCI PostgreSQL, ClickHouse, Redis, and Object Storage/);
  assert.match(feature.provisioningDetails, /private networking, managed dependencies/);
  assert.deepEqual(feature.capabilities, ["Real Langfuse UI", "Managed OCI dependencies", "Separate hosted deployment"]);
});

test("OpenClaw demo describes hosted gateway constraints", () => {
  const feature = aiFeatures.find((item) => item.id === "openclaw-hosted-agent-gateway");

  assert.ok(feature);
  assert.equal(feature.title, "OpenClaw Hosted Agent Gateway");
  assert.equal(feature.sdkModule, "apps/hosted-openclaw/Dockerfile");
  assert.match(feature.summary, /OpenClaw/);
  assert.match(feature.details, /OCI Generative AI Hosted Applications/);
  assert.match(feature.provisioningDetails, /Control UI/);
  assert.deepEqual(feature.capabilities, ["OpenClaw Control UI", "Hosted gateway URL", "Constrained agent runtime"]);
});

test("every demo card has a generated OCI wiring picture", () => {
  const main = readFileSync("src/main.js", "utf8");
  const generator = readFileSync("scripts/generate-wiring-diagrams.mjs", "utf8");

  assert.match(main, /function defaultWiringHref\(featureId\)/);
  assert.match(main, /docs\/wiring\/\$\{featureId\}\.svg/);
  assert.match(generator, /Generated \$\{aiFeatures\.length\} wiring diagrams/);
  assert.match(generator, /langfuse-hosted-observability/);

  for (const feature of aiFeatures) {
    const diagramPath = `docs/wiring/${feature.id}.svg`;
    assert.ok(existsSync(diagramPath), `${diagramPath} should exist`);
    const diagram = readFileSync(diagramPath, "utf8");
    assert.match(diagram, /<svg /);
    assert.match(diagram, /OCI/);
    assert.match(diagram, new RegExp(escapeXml(feature.title).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("portal stores star-only ratings and card run counts locally", () => {
  const main = readFileSync("src/main.js", "utf8");
  const styles = readFileSync("src/styles.css", "utf8");

  assert.match(main, /demoRatingsStorageKey = "enterprise-ai-demo-ratings-v1"/);
  assert.match(main, /demoRunCountsStorageKey = "enterprise-ai-demo-run-counts-v1"/);
  assert.match(main, /minInitialRunCount = 20/);
  assert.match(main, /maxInitialRunCount = 35/);
  assert.match(main, /randomInitialRunCount\(\)/);
  assert.match(main, /defaultDemoRating = 2/);
  assert.match(main, /maxDemoRating = 3/);
  assert.match(main, /localStorage\.setItem\(demoRatingsStorageKey/);
  assert.match(main, /localStorage\.setItem\(demoRunCountsStorageKey/);
  assert.match(main, /data-rating-feature="\$\{featureId\}"/);
  assert.match(main, /data-rating-value="\$\{value\}"/);
  assert.match(main, /id="demo-rating-control"/);
  assert.match(main, /renderDemoRatingControl\(featureId, "dialog"\)/);
  assert.match(main, /updateFeatureRating\(featureId, value\)/);
  assert.match(main, /renderRunCountBadge\(feature\.id\)/);
  assert.match(main, /incrementFeatureRunCount\(button\.dataset\.runDemo\)/);
  assert.doesNotMatch(main, /<span class="rating-result">/);
  assert.match(styles, /\.demo-rating/);
  assert.match(styles, /\.rating-star\.is-active/);
  assert.match(styles, /\.run-count-badge/);
  assert.match(styles, /border-radius: 999px/);
});

test("portal opens administration as a separate page", () => {
  const main = readFileSync("src/main.js", "utf8");
  const indexHtml = readFileSync("index.html", "utf8");
  const adminHtml = readFileSync("admin.html", "utf8");
  const admin = readFileSync("src/admin.js", "utf8");
  const styles = readFileSync("src/styles.css", "utf8");

  assert.match(main, /href="\/admin\.html"/);
  assert.match(main, /target="_blank"/);
  assert.doesNotMatch(main, /id="administration"/);
  assert.match(indexHtml, /href="\/src\/styles\.css\?v=0\.0\.25"/);
  assert.match(indexHtml, /src="\/src\/main\.js\?v=0\.0\.25"/);
  assert.match(adminHtml, /id="administration"/);
  assert.match(adminHtml, /href="\/src\/styles\.css\?v=0\.0\.25"/);
  assert.match(adminHtml, /src="\/src\/admin\.js\?v=0\.0\.25"/);
  assert.match(admin, /loadAdministrationDashboard/);
  assert.match(main, /Administration/);
  assert.match(admin, /admin-metric-grid/);
  assert.doesNotMatch(admin, /admin-connection-grid/);
  assert.match(adminHtml, /admin-tab-runs/);
  assert.match(adminHtml, /admin-tab-infra/);
  assert.match(adminHtml, /admin-tab-logs/);
  assert.match(adminHtml, /admin-tab-changes/);
  assert.match(adminHtml, /admin-panel-runs/);
  assert.match(adminHtml, /admin-panel-infra/);
  assert.match(adminHtml, /admin-panel-logs/);
  assert.match(adminHtml, /admin-panel-changes/);
  assert.match(adminHtml, /admin-demo-table/);
  assert.match(adminHtml, /admin-change-log/);
  assert.match(admin, /\/api\/admin\/demo-runs/);
  assert.match(admin, /\/api\/admin\/infra/);
  assert.match(admin, /\/api\/admin\/logs/);
  assert.match(admin, /\/api\/admin\/change-log/);
  assert.doesNotMatch(admin, /\/api\/features\/responses-api\/state/);
  assert.doesNotMatch(adminHtml, /Hosted application references/);
  assert.match(adminHtml, /admin-run-status-filter/);
  assert.match(adminHtml, /admin-log-source-filter/);
  assert.match(adminHtml, /admin-infra-status-filter/);
  assert.match(adminHtml, /admin-resource-list/);
  assert.match(adminHtml, /admin-schema-grid/);
  assert.match(adminHtml, /admin-container-log-note/);
  assert.match(admin, /admin-run-status-filter/);
  assert.match(admin, /entry\.preview \|\| ""/);
  assert.match(admin, /component\.value \|\| ""/);
  assert.match(adminHtml, /Usage summary/);
  assert.doesNotMatch(admin, /clientSecret|apiKey|password/i);
  assert.doesNotMatch(main, /id="infra-panel"/);
  assert.doesNotMatch(main, /id="infra-refresh-button"/);
  assert.doesNotMatch(main, /id="infra-action-logs"/);
  assert.match(styles, /\.admin-section/);
  assert.match(styles, /\.admin-demo-row/);
  assert.match(styles, /\.admin-change-entry/);
});
