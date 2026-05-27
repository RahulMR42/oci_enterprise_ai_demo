import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { aiFeatures } from "../src/data/aiFeatures.js";

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

test("demo features provide card and flip-side content", () => {
  assert.equal(aiFeatures.length, 25);

  const featureIds = aiFeatures.map((feature) => feature.id);
  assert.deepEqual(featureIds, [
    "responses-api",
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

test("Agentic Control Tower demo describes LlamaIndex and IDCS posture", () => {
  const feature = aiFeatures.find((item) => item.id === "agentic-control-tower");

  assert.ok(feature);
  assert.equal(feature.title, "Agentic Control Tower");
  assert.equal(feature.sdkModule, "backend/demos/agentic_control_tower.py");
  assert.match(feature.summary, /LlamaIndex/);
  assert.match(feature.details, /IDCS proxy/);
  assert.match(feature.provisioningDetails, /Terraform-generated IDCS launch client/);
  assert.deepEqual(feature.capabilities, ["Hosted LlamaIndex runtime", "Tool critique loop", "IDCS proxy launch"]);
});

test("portal exposes mermaid-style flow diagrams for feature cards", () => {
  const main = readFileSync("src/main.js", "utf8");

  assert.match(main, /const flowDiagrams = \{/);
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

test("portal replaces infrastructure panel with administration run history", () => {
  const main = readFileSync("src/main.js", "utf8");
  const styles = readFileSync("src/styles.css", "utf8");

  assert.match(main, /href="#administration"/);
  assert.match(main, /id="administration"/);
  assert.match(main, /Administration/);
  assert.match(main, /admin-metric-grid/);
  assert.match(main, /admin-demo-table/);
  assert.match(main, /loadAdministrationMetrics/);
  assert.match(main, /\/api\/admin\/demo-runs/);
  assert.match(main, /recordClientRunSummary/);
  assert.doesNotMatch(main, /id="infra-panel"/);
  assert.doesNotMatch(main, /id="infra-refresh-button"/);
  assert.doesNotMatch(main, /id="infra-action-logs"/);
  assert.match(styles, /\.admin-section/);
  assert.match(styles, /\.admin-demo-row/);
});
