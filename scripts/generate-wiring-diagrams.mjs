import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { aiFeatures } from "../src/data/aiFeatures.js";

const outputDir = join(process.cwd(), "docs/wiring");

const serviceProfiles = {
  "OCI Generative AI": {
    core: "OCI Generative AI Responses API",
    data: "Model endpoint, project, API key",
    governance: "IAM policy, API key scope, server-side secret handling"
  },
  "OCI Generative AI Agents": {
    core: "OCI Generative AI agent or tool runtime",
    data: "Tool metadata, hosted app metadata, managed runtime state",
    governance: "IAM policy, hosted auth, approved tool boundary"
  },
  "OCI App Layer": {
    core: "Application orchestration layer",
    data: "Local app state, tools, documents, workflow data",
    governance: "Policy checks, audit trail, scoped application access"
  },
  "Enterprise AI Governance": {
    core: "Governed AI control plane",
    data: "Policy rules, evaluation data, audit records",
    governance: "Risk checks, redaction, approval or promotion gates"
  }
};

const featureOverrides = {
  "openai-compatible-chat": {
    core: "OCI Chat Completions API",
    data: "OpenAI-compatible messages, OCI project, API key",
    response: "Assistant message from OCI model"
  },
  "responses-streaming-structured-output": {
    core: "OCI Responses API streaming",
    data: "Prompt, stream events, JSON schema contract",
    response: "Aggregated structured JSON output"
  },
  "conversation-store": {
    core: "OCI Responses API with OCI Conversations API",
    data: "Generated conversation ID and OCI-managed turn state",
    response: "Assistant response plus updated OCI conversation state"
  },
  guardrails: {
    core: "Policy gate before OCI Responses API",
    data: "PII patterns, injection checks, sanitized prompt",
    response: "Blocked request or sanitized model response"
  },
  "file-search-vector-store-rag": {
    core: "OCI Responses API with File Search",
    data: "OCI Vector Store and seeded enterprise documents",
    response: "Grounded answer with retrieved context"
  },
  "code-interpreter": {
    core: "OCI Responses API with Code Interpreter",
    data: "Managed code container and generated artifacts",
    response: "Computed analysis and artifact summary"
  },
  "function-calling": {
    core: "OCI Responses API with typed functions",
    data: "Approved backend functions and tool results",
    response: "Final model answer after tool handoff"
  },
  "remote-mcp-calling": {
    core: "OCI Responses API with MCP-style gateway",
    data: "Remote tool registry, JSON-RPC tool result",
    response: "Agent answer with remote tool trace"
  },
  "nl2sql-sql-search": {
    core: "OCI Responses API plus SQL validation",
    data: "Autonomous Database, Database Tools, sample dataset",
    response: "Validated rows and business summary"
  },
  "long-term-memory": {
    core: "OCI Responses API with memory retrieval",
    data: "Subject-scoped durable memory store",
    response: "Personalized answer with retrieved facts"
  },
  "multi-model-routing": {
    core: "Model route scoring and OCI Responses API",
    data: "Candidate model outputs, latency, route policy",
    response: "Selected answer with routing metadata"
  },
  "hosted-agentic-applications": {
    core: "OCI Generative AI Hosted Application",
    data: "OCIR image, hosted deployment metadata, agent manifest",
    response: "Hosted agent health and action result"
  },
  "langgraph-hosted-agent-mcp": {
    core: "LangGraph StateGraph runtime on OCI",
    data: "OCIR image, MCP tool path, hosted metadata, local graph plan",
    response: "Governed agent response after MCP tool call"
  },
  "a2a-agent-collaboration": {
    core: "A2A-style coordination across hosted agents",
    data: "Agent cards, task handoff, hosted endpoints",
    response: "Coordinated incident outcome"
  },
  "openclaw-hosted-agent-gateway": {
    core: "OCI Hosted Application running OpenClaw",
    data: "OCIR OpenClaw image, hosted URL, gateway token",
    response: "Hosted OpenClaw Control UI in a browser tab"
  },
  "agentic-rag-planner": {
    core: "OCI Responses API with retrieval planning",
    data: "Retrieval queries, evidence sufficiency policy",
    response: "Grounded answer plan and final answer policy"
  },
  "locus-sdk-agentic-workflows": {
    core: "Oracle Locus SDK Agent and tools",
    data: "Tool registry, SDK contract, memory, checkpoints, streaming events",
    response: "Production agent workflow plan"
  },
  "human-approval-agent": {
    core: "OCI Responses API with approval classification",
    data: "Risk rules, action proposal, approval checkpoint",
    response: "Governed proposal ready for human review"
  },
  "governance-center": {
    core: "Governance policy controls and OCI Responses API",
    data: "Audit records, access posture, retention controls",
    response: "Production readiness decision"
  },
  "document-understanding-genai": {
    core: "Document extraction plus OCI Responses API",
    data: "Bundled PDFs, extracted fields, document signals",
    response: "Document-grounded finance summary"
  },
  "batch-inference": {
    core: "Batch-style prompt processing",
    data: "Input manifest, prompt set, output review target",
    response: "Bulk generated outputs for downstream review"
  },
  "model-evaluation": {
    core: "Evaluation workflow and OCI Responses API",
    data: "Prompt set, rubric, safety and quality scores",
    response: "Promotion gate recommendation"
  },
  "multimodal-vision": {
    core: "Multimodal request pattern",
    data: "Approved visual asset manifest",
    response: "Structured visual triage summary"
  },
  "ai-workflow-orchestration": {
    core: "Workflow layer over models and tools",
    data: "Workflow manifest, approvals, audit handoff",
    response: "Durable process outcome"
  }
};

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrapText(value, maxLength = 38, maxLines = 4) {
  const words = String(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines.slice(0, maxLines);
}

function textBlock(lines, x, y, options = {}) {
  const { anchor = "middle", className = "box-text", lineHeight = 19 } = options;
  return lines
    .map((line, index) => `<text class="${className}" x="${x}" y="${y + index * lineHeight}" text-anchor="${anchor}">${escapeXml(line)}</text>`)
    .join("\n");
}

function box({ x, y, width, height, className, title, lines }) {
  return `
  <rect class="box-outline ${className}" x="${x}" y="${y}" width="${width}" height="${height}"/>
  <text class="box-title" x="${x + width / 2}" y="${y + 30}" text-anchor="middle">${escapeXml(title)}</text>
${textBlock(lines, x + width / 2, y + 56)}`;
}

function featureProfile(feature) {
  return {
    ...serviceProfiles[feature.serviceArea],
    ...featureOverrides[feature.id]
  };
}

function renderDiagram(feature) {
  const profile = featureProfile(feature);
  const capabilities = feature.capabilities.join(", ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(feature.title)} OCI wiring diagram</title>
  <desc id="desc">OCI component wiring for the ${escapeXml(feature.title)} demo card.</desc>
  <defs>
    <marker id="arrow-blue" markerWidth="11" markerHeight="8" refX="10" refY="4" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 11 4 L 0 8 z" fill="#2563eb"/>
    </marker>
    <marker id="arrow-green" markerWidth="11" markerHeight="8" refX="10" refY="4" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 11 4 L 0 8 z" fill="#15803d"/>
    </marker>
    <style>
      .page { fill: #ffffff; }
      .title { font: 700 24px Arial, sans-serif; fill: #0f172a; }
      .subtitle { font: 14px Arial, sans-serif; fill: #475569; }
      .lane-title { font: 700 15px Arial, sans-serif; fill: #0f172a; }
      .box-title { font: 700 14px Arial, sans-serif; fill: #111827; }
      .box-text { font: 12px Arial, sans-serif; fill: #334155; }
      .note-text { font: 12px Arial, sans-serif; fill: #475569; }
      .edge-label { font: 700 12px Arial, sans-serif; fill: #334155; }
      .lane { stroke-width: 2; rx: 4; ry: 4; }
      .lane-portal { fill: #eef6ff; stroke: #6c8ebf; }
      .lane-runtime { fill: #f3f0ff; stroke: #9673a6; }
      .lane-oci { fill: #eef9f0; stroke: #82b366; }
      .lane-controls { fill: #fff7ed; stroke: #f59e0b; }
      .box-outline { stroke-width: 2; rx: 8; ry: 8; }
      .box-blue { fill: #dae8fc; stroke: #6c8ebf; }
      .box-purple { fill: #e9d5ff; stroke: #9673a6; }
      .box-green { fill: #dcfce7; stroke: #82b366; }
      .box-orange { fill: #ffedd5; stroke: #d79b00; }
      .box-gray { fill: #f8fafc; stroke: #94a3b8; }
      .edge-blue { stroke: #2563eb; stroke-width: 3; fill: none; marker-end: url(#arrow-blue); }
      .edge-green { stroke: #15803d; stroke-width: 3; fill: none; marker-end: url(#arrow-green); }
    </style>
  </defs>
  <rect class="page" width="1400" height="900"/>
  <text class="title" x="700" y="44" text-anchor="middle">${escapeXml(feature.title)} - OCI Wiring Diagram</text>
  <text class="subtitle" x="700" y="69" text-anchor="middle">${escapeXml(feature.serviceArea)} | ${escapeXml(feature.status)}</text>

  <rect class="lane lane-portal" x="50" y="105" width="280" height="610"/>
  <rect class="lane lane-runtime" x="370" y="105" width="330" height="610"/>
  <rect class="lane lane-oci" x="740" y="105" width="330" height="610"/>
  <rect class="lane lane-controls" x="1110" y="105" width="240" height="610"/>
  <text class="lane-title" x="190" y="132" text-anchor="middle">User and Portal</text>
  <text class="lane-title" x="535" y="132" text-anchor="middle">Demo Runtime</text>
  <text class="lane-title" x="905" y="132" text-anchor="middle">OCI Services and Data</text>
  <text class="lane-title" x="1230" y="132" text-anchor="middle">Controls</text>

${box({
  x: 85,
  y: 170,
  width: 210,
  height: 92,
  className: "box-blue",
  title: "Demo card",
  lines: wrapText(feature.sampleUseCase, 32, 3)
})}
${box({
  x: 85,
  y: 330,
  width: 210,
  height: 112,
  className: "box-blue",
  title: "Portal run window",
  lines: ["Documentation", "OCI wiring diagram", "Run, trace, and output panels"]
})}
${box({
  x: 415,
  y: 170,
  width: 240,
  height: 112,
  className: "box-purple",
  title: "Server route",
  lines: wrapText(feature.sdkModule, 34, 3)
})}
${box({
  x: 415,
  y: 350,
  width: 240,
  height: 124,
  className: "box-purple",
  title: profile.core,
  lines: wrapText(feature.details, 38, 4)
})}
${box({
  x: 785,
  y: 170,
  width: 240,
  height: 112,
  className: "box-green",
  title: "Terraform module",
  lines: wrapText(feature.terraformPath, 34, 3)
})}
${box({
  x: 785,
  y: 350,
  width: 240,
  height: 124,
  className: "box-green",
  title: "Data and OCI resources",
  lines: wrapText(profile.data, 36, 4)
})}
${box({
  x: 1145,
  y: 170,
  width: 170,
  height: 112,
  className: "box-orange",
  title: "Security",
  lines: wrapText(profile.governance, 24, 4)
})}
${box({
  x: 1145,
  y: 350,
  width: 170,
  height: 124,
  className: "box-orange",
  title: "Capabilities",
  lines: wrapText(capabilities, 24, 4)
})}

  <rect class="box-outline box-gray" x="110" y="760" width="1180" height="82"/>
  <text class="box-title" x="135" y="790">Response path</text>
${textBlock(wrapText(profile.response || "The portal renders relevant output, trace steps, technical details, logs, and raw JSON for the run.", 150, 2), 135, 816, { anchor: "start", className: "note-text", lineHeight: 20 })}

  <path class="edge-blue" d="M190 262 L190 330"/>
  <path class="edge-blue" d="M295 386 C350 386 358 226 415 226"/>
  <text class="edge-label" x="328" y="303">run request</text>
  <path class="edge-green" d="M655 226 C710 226 728 226 785 226"/>
  <text class="edge-label" x="678" y="213">runtime config</text>
  <path class="edge-green" d="M655 412 C710 412 728 412 785 412"/>
  <text class="edge-label" x="680" y="400">service call</text>
  <path class="edge-green" d="M1025 412 C1080 412 1092 412 1145 412"/>
  <path class="edge-green" d="M1025 226 C1080 226 1092 226 1145 226"/>
  <path class="edge-blue" d="M535 474 C535 695 1170 690 1170 760"/>
  <path class="edge-blue" d="M1170 842 C760 875 275 825 190 442"/>
</svg>
`;
}

mkdirSync(outputDir, { recursive: true });

const expectedFiles = new Set(aiFeatures.map((feature) => `${feature.id}.svg`));
for (const fileName of readdirSync(outputDir)) {
  if (fileName.endsWith(".svg") && !expectedFiles.has(fileName)) {
    rmSync(join(outputDir, fileName));
  }
}

for (const feature of aiFeatures) {
  const target = join(outputDir, `${feature.id}.svg`);
  writeFileSync(target, renderDiagram(feature));
}

console.log(`Generated ${aiFeatures.length} wiring diagrams in ${outputDir}`);
