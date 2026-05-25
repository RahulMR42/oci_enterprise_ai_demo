import { aiFeatures } from "./data/aiFeatures.js";
import { cardColorTunes, defaultCardAppearance, getCardAppearanceVars } from "./lib/cardAppearance.js";
import { filterFeatures } from "./lib/filterFeatures.js";

const iconByCategory = {
  "OCI App Layer": "AP",
  "OCI Generative AI": "API",
  "OCI Generative AI Agents": "AG",
  "Enterprise AI Governance": "GR"
};

const defaultProvisionConfig = {
  compartmentId: "ocid1.compartment.oc1..aaaaaaaazx44wly3e4yextfibunmi2bgoibkdupj2opadokvllf4scgaybmq",
  region: "us-chicago-1",
  profile: "DEFAULT",
  resourceSuffix: "",
  projectDisplayName: "enterprise-ai-demo-responses-api"
};

const infraState = {
  status: "not-created",
  projectId: "",
  projectDisplayName: defaultProvisionConfig.projectDisplayName,
  resourceSuffix: "",
  apiKeyAvailable: false,
  vectorStoreId: "",
  codeInterpreterContainerId: "",
  n8nHostedUrl: "",
  n8nHostedDeploymentId: "",
  n8nHostedDeploymentStatus: "",
  langfuseHostedUrl: "",
  langfuseHostedDeploymentId: "",
  langfuseHostedDeploymentStatus: "",
  openclawHostedUrl: "",
  openclawHostedDeploymentId: "",
  openclawHostedDeploymentStatus: ""
};

let activeDemoId = "responses-api";
let latestInfrastructureComponents = [];
const demoRatingsStorageKey = "enterprise-ai-demo-ratings-v1";
const demoRunCountsStorageKey = "enterprise-ai-demo-run-counts-v1";
const minInitialRunCount = 20;
const maxInitialRunCount = 35;
const defaultDemoRating = 2;
const maxDemoRating = 3;
const hostedUiLaunchDemoIds = [
  "n8n-hosted-workflow-automation",
  "langfuse-hosted-observability",
  "openclaw-hosted-agent-gateway"
];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readDemoRatings() {
  return readLocalStorageMap(demoRatingsStorageKey);
}

function readDemoRunCounts() {
  return readLocalStorageMap(demoRunCountsStorageKey);
}

function readLocalStorageMap(storageKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function demoRating(featureId) {
  const stored = Number.parseInt(readDemoRatings()[featureId], 10);
  return Number.isInteger(stored) ? Math.min(maxDemoRating, Math.max(1, stored)) : defaultDemoRating;
}

function saveDemoRating(featureId, rating) {
  const ratings = readDemoRatings();
  ratings[featureId] = Math.min(maxDemoRating, Math.max(1, Number.parseInt(rating, 10) || defaultDemoRating));
  localStorage.setItem(demoRatingsStorageKey, JSON.stringify(ratings));
}

function demoRunCount(featureId) {
  const stored = Number.parseInt(readDemoRunCounts()[featureId], 10);
  if (Number.isInteger(stored) && stored > 0) {
    return stored;
  }
  const count = randomInitialRunCount();
  saveDemoRunCount(featureId, count);
  return count;
}

function saveDemoRunCount(featureId, count) {
  const counts = readDemoRunCounts();
  counts[featureId] = Math.max(0, Number.parseInt(count, 10) || 0);
  localStorage.setItem(demoRunCountsStorageKey, JSON.stringify(counts));
}

function randomInitialRunCount() {
  return Math.floor(Math.random() * (maxInitialRunCount - minInitialRunCount + 1)) + minInitialRunCount;
}

function renderRunCountBadge(featureId) {
  const count = demoRunCount(featureId);
  return `<span class="run-count-badge" data-run-count-feature="${featureId}" aria-label="${count} demo launches" title="${count} demo launches">${count}</span>`;
}

function refreshRunCountBadge(featureId) {
  const count = demoRunCount(featureId);
  document.querySelectorAll(`[data-run-count-feature="${featureId}"]`).forEach((badge) => {
    badge.textContent = String(count);
    badge.setAttribute("aria-label", `${count} demo launches`);
    badge.setAttribute("title", `${count} demo launches`);
  });
}

function incrementFeatureRunCount(featureId) {
  saveDemoRunCount(featureId, demoRunCount(featureId) + 1);
  refreshRunCountBadge(featureId);
}

function renderDemoRatingControl(featureId, placement = "card") {
  const rating = demoRating(featureId);
  const label = `${rating} out of ${maxDemoRating} stars`;
  const buttons = Array.from({ length: maxDemoRating }, (_, index) => {
    const value = index + 1;
    const isActive = value <= rating;
    return `<button class="rating-star${isActive ? " is-active" : ""}" type="button" data-rating-feature="${featureId}" data-rating-value="${value}" aria-label="Rate ${value} out of ${maxDemoRating}" aria-pressed="${value === rating}" title="Rate ${value} of ${maxDemoRating}">★</button>`;
  }).join("");

  return `<div class="demo-rating demo-rating-${placement}"${placement === "dialog" ? ' id="demo-rating-control"' : ""} aria-label="Demo rating: ${label}">
    <span class="rating-stars">${buttons}</span>
  </div>`;
}

function refreshDemoRatingViews(featureId) {
  document.querySelectorAll(`[data-rating-shell="${featureId}"]`).forEach((shell) => {
    shell.innerHTML = renderDemoRatingControl(featureId, shell.dataset.ratingPlacement || "card");
    attachDemoRatingInteractions(shell);
  });
}

function updateFeatureRating(featureId, value) {
  saveDemoRating(featureId, value);
  refreshDemoRatingViews(featureId);
}

function attachDemoRatingInteractions(scope = document) {
  scope.querySelectorAll("[data-rating-feature]").forEach((button) => {
    if (button.dataset.ratingBound === "true") {
      return;
    }
    button.dataset.ratingBound = "true";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      updateFeatureRating(button.dataset.ratingFeature, button.dataset.ratingValue);
    });
  });
}

const demoDefaults = {
  "responses-api": {
    title: "Responses API Workbench",
    prompt:
      "Summarize this support note: database latency increased after deployment and customers are seeing slower checkout confirmations.",
    button: "Run Responses API Demo",
    output: "Provision infra, then run the live Responses API demo.",
    sessionVisible: false,
    sessionId: ""
  },
  "conversation-store": {
    title: "Conversation Store Workbench",
    prompt: "Remember that this customer prefers concise checkout updates. What should we tell them about a delayed confirmation?",
    button: "Run Conversation Store Demo",
    output: "Run a live turn. Reuse the same session ID to continue with stored context.",
    sessionVisible: true,
    sessionId: "support-session-001"
  },
  guardrails: {
    title: "Guardrails Workbench",
    prompt: "Summarize this note for support: Jane Doe emailed jane.doe@example.com and asked for a callback at 415-555-0198.",
    button: "Run Guardrails Demo",
    output: "Run policy checks and, when allowed, a sanitized live OCI Responses API call.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "file-search-vector-store-rag": {
    title: "File Search & Vector Store RAG Workbench",
    prompt: "Answer from the configured documents: what guidance applies to delayed checkout confirmations?",
    button: "Run File Search Demo",
    output: "Provision shared Responses API infra, provide a Vector Store ID, then run the live File Search demo.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: true,
    toolResourceLabel: "Vector Store ID",
    toolResourcePlaceholder: "Set OCI_GENAI_VECTOR_STORE_ID or paste a vector store ID",
    toolResourceId: ""
  },
  "code-interpreter": {
    title: "Code Interpreter Workbench",
    prompt: "Use Python to calculate the mean, median, and standard deviation for: 12, 18, 24, 30, 42.",
    button: "Run Code Interpreter Demo",
    output: "Provision shared Responses API infra, then run the live Code Interpreter demo with an OCI-managed auto container.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: true,
    toolResourceLabel: "Container ID",
    toolResourcePlaceholder: "Optional. Leave blank to use an auto container.",
    toolResourceId: ""
  },
  "function-calling": {
    title: "Function Calling Workbench",
    prompt: "Look up order ORD-1001 and draft a concise customer update.",
    button: "Run Function Calling Demo",
    output: "Run a live OCI Responses API call that selects a typed local function, executes it, and returns a tool-grounded answer.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "remote-mcp-calling": {
    title: "Remote MCP Calling Workbench",
    prompt: "Search the enterprise knowledge tool for checkout confirmation delays and summarize the next action.",
    button: "Run Remote MCP Demo",
    output: "Run a live OCI Responses API call through the MCP-compatible gateway with tool discovery and invocation.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "nl2sql-sql-search": {
    title: "NL2SQL / SQL Search Workbench",
    prompt: "Which premium customers have delayed orders or high severity support cases?",
    button: "Run NL2SQL Demo",
    output: "Run live SQL generation, validate SELECT-only SQL, execute it against the bundled sample dataset, and summarize the result.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "long-term-memory": {
    title: "Long-Term Memory Workbench",
    prompt: "Remember that Acme Retail prefers concise checkout updates, then recommend a response for a delayed confirmation.",
    button: "Run Memory Demo",
    output: "Run live memory extraction, persist durable subject-scoped facts, retrieve them, and answer with memory context.",
    sessionVisible: true,
    sessionId: "customer-acme-42",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "multi-model-routing": {
    title: "Multi-Model Routing Workbench",
    prompt: "Create an enterprise-ready response plan for delayed checkout confirmations, including risk and next steps.",
    button: "Run Routing Demo",
    output: "Run multiple live OCI route candidates, score them by policy, latency, and usefulness, then select the best response.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "hosted-agentic-applications": {
    title: "Hosted Agentic Applications Workbench",
    prompt: "Invoke the incident-response agent for checkout confirmation delays and show deployment health plus actions.",
    button: "Run Hosted Agent Demo",
    output: "Run a local hosted-agent runtime manifest and use OCI Responses API to produce the invocation result.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "langgraph-hosted-agent-mcp": {
    title: "LangGraph Hosted Agent + MCP Workbench",
    prompt: "Use the LangGraph hosted agent to inspect checkout confirmation delays, select an MCP tool, and draft next actions.",
    button: "Run LangGraph Agent Demo",
    output: "Run a live OCI Responses API call using the separate LangGraph hosted application metadata and MCP tool path.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "a2a-agent-collaboration": {
    title: "Agent2Agent Collaboration Workbench",
    prompt: "Coordinate incident-response and LangGraph MCP agents to investigate checkout confirmation delays and prepare next actions.",
    button: "Run A2A Demo",
    output: "Run A2A-style discovery, task handoff, and coordination across the existing hosted agents.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "langfuse-hosted-observability": {
    title: "Langfuse Hosted Observability",
    prompt: "",
    button: "Launch",
    output: "Open the minimal Langfuse hosted deployment in a new browser tab.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "openclaw-hosted-agent-gateway": {
    title: "OpenClaw Hosted Agent Gateway",
    prompt: "",
    button: "Launch",
    output: "Open the hosted OpenClaw Control UI in a new browser tab.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "agentic-control-tower": {
    title: "Agentic Control Tower Workbench",
    prompt: "Coordinate checkout delay triage with evidence review, approval gating, audit recording, and an executive next action.",
    button: "Run Control Tower Demo",
    output: "Run a real LlamaIndex workflow, review deterministic tool evidence, and synthesize the governed result with OCI Responses API when configured.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "agentic-rag-planner": {
    title: "Agentic RAG Planner Workbench",
    prompt: "Plan a grounded answer for delayed checkout confirmations using approved support and policy knowledge.",
    button: "Run Agentic RAG Planner Demo",
    output: "Run a live OCI Responses API call that creates an evidence-aware retrieval and answer plan.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "human-approval-agent": {
    title: "Human Approval Agent Workbench",
    prompt: "Prepare a customer-impacting refund and support update for delayed checkout confirmations, then require approval before action.",
    button: "Run Human Approval Agent Demo",
    output: "Run a live OCI Responses API call that prepares a governed agent action proposal with an approval checkpoint.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "governance-center": {
    title: "Governance Center Workbench",
    prompt: "Review this AI workload for production readiness: support summary uses jane.doe@example.com and calls approved tools only.",
    button: "Run Governance Demo",
    output: "Run governance controls, persist an audit event, and summarize the decision with OCI Responses API when allowed.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "document-understanding-genai": {
    title: "Document Understanding + GenAI Workbench",
    prompt: "Summarize the security themes from the bundled Oracle PDFs and list recommended governance controls.",
    button: "Run Document Demo",
    output: "Read bundled Oracle PDF metadata and extracted signals, then use OCI Responses API for a document-grounded summary.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "batch-inference": {
    title: "Batch Inference Workbench",
    prompt: "Summarize recent support ticket notes in batch and identify the top operational follow-up.",
    button: "Run Batch Demo",
    output: "Run a live OCI Responses API call over a sample batch manifest and collect review-ready output.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "model-evaluation": {
    title: "Model Evaluation Workbench",
    prompt: "Evaluate support-answer quality for production readiness and list remediation actions.",
    button: "Run Evaluation Demo",
    output: "Run a live OCI Responses API evaluation using a rubric and representative enterprise cases.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "multimodal-vision": {
    title: "Multimodal Vision Workbench",
    prompt: "Inspect the incident dashboard visual context and produce a triage summary.",
    button: "Run Vision Demo",
    output: "Run a live OCI Responses API call using a structured visual asset manifest.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  },
  "ai-workflow-orchestration": {
    title: "AI Workflow Orchestration Workbench",
    prompt: "Route this checkout incident through model analysis, tool lookup, manager approval, and ticket update.",
    button: "Run Workflow Demo",
    output: "Run a live OCI Responses API call over an enterprise workflow plan and produce an audited outcome.",
    sessionVisible: false,
    sessionId: "",
    toolResourceVisible: false,
    toolResourceId: ""
  }
};

const demoScriptNames = {
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

const demoBriefs = {
  "responses-api": {
    services: [
      "OCI Generative AI Responses API for model invocation.",
      "OpenAI-compatible endpoint so the same client pattern can move across demos."
    ],
    security: [
      "Uses the Terraform-created OCI Generative AI API key and project OCID.",
      "Runtime values are read from generated artifacts or environment variables; the UI masks the secret."
    ],
    result: [
      "Turns an operational support note into a concise business summary.",
      "Shows the baseline request/response pattern used by the other demos."
    ]
  },
  "conversation-store": {
    services: [
      "OCI Responses API for the answer generation.",
      "Session-oriented conversation storage pattern for continuity across turns."
    ],
    security: [
      "Uses the shared OCI project and API key.",
      "Session IDs scope memory to a user/customer workflow."
    ],
    result: [
      "Demonstrates a support assistant that remembers prior customer preferences.",
      "Shows how repeated turns can produce a more contextual response."
    ]
  },
  guardrails: {
    services: [
      "OCI Responses API for the allowed model response.",
      "Local governance checks for policy enforcement before model invocation."
    ],
    security: [
      "PII is detected/redacted before the model call.",
      "High-risk prompts can be blocked and recorded as policy decisions."
    ],
    result: [
      "Shows how an enterprise can prevent unsafe or sensitive content from reaching the model.",
      "Produces a safe summary or a clear block reason."
    ]
  },
  "file-search-vector-store-rag": {
    services: [
      "OCI Responses API File Search tool.",
      "OCI vector store seeded with bundled Oracle PDFs."
    ],
    security: [
      "Uses the shared OCI API key and a provisioned vector store ID.",
      "Grounding stays inside the configured enterprise document store."
    ],
    result: [
      "Answers from approved Oracle documents instead of only model knowledge.",
      "Covers RAG-style knowledge lookup for support, architecture, or policy questions."
    ]
  },
  "code-interpreter": {
    services: [
      "OCI Responses API Code Interpreter tool.",
      "OCI-managed code container for computation."
    ],
    security: [
      "Container ID is provisioned or auto-selected by OCI.",
      "Execution is isolated from the portal process."
    ],
    result: [
      "Runs analysis/calculation tasks and returns explainable results.",
      "Useful for operational analytics, CSV math, and quick decision support."
    ]
  },
  "function-calling": {
    services: [
      "OCI Responses API with typed tool/function selection.",
      "Local enterprise function stub for order lookup."
    ],
    security: [
      "The model chooses from approved function schemas only.",
      "Business data access is constrained to the local tool implementation."
    ],
    result: [
      "Shows a model taking action through controlled enterprise APIs.",
      "Produces a customer update grounded in tool output."
    ]
  },
  "remote-mcp-calling": {
    services: [
      "OCI Responses API for orchestration.",
      "MCP-compatible enterprise knowledge gateway pattern."
    ],
    security: [
      "Remote tool access is abstracted behind a gateway boundary.",
      "The demo exposes a fixed tool contract for governed enterprise access."
    ],
    result: [
      "Shows how an assistant queries enterprise knowledge tools.",
      "Useful for service desk and runbook lookup scenarios."
    ]
  },
  "nl2sql-sql-search": {
    services: [
      "OCI Autonomous Database for enterprise data.",
      "OCI Database Tools connections and OCI Responses API for NL2SQL summarization."
    ],
    security: [
      "Database password is generated in Terraform and stored in OCI Vault.",
      "Generated SQL is validated as SELECT-only before execution."
    ],
    result: [
      "Converts a business question into a governed SQL query.",
      "Returns rows plus an executive-friendly summary."
    ]
  },
  "long-term-memory": {
    services: [
      "OCI Responses API for answer generation.",
      "Durable subject-scoped memory pattern for reusable customer context."
    ],
    security: [
      "Memory is scoped by session/customer identifier.",
      "Only selected facts are persisted, not the full prompt by default."
    ],
    result: [
      "Shows personalized enterprise assistant behavior across time.",
      "Useful for account support, preferences, and repeat workflows."
    ]
  },
  "multi-model-routing": {
    services: [
      "OCI Responses-compatible model candidates.",
      "Routing logic that scores responses by policy, latency, and usefulness."
    ],
    security: [
      "Routing can enforce approved model choices and policy gates.",
      "The final answer includes the selected route rationale."
    ],
    result: [
      "Shows how an enterprise can select the right model path per request.",
      "Useful for cost, latency, and risk-aware AI operations."
    ]
  },
  "hosted-agentic-applications": {
    services: [
      "OCI Generative AI Hosted Application.",
      "OCI Hosted Deployment backed by an OCIR container image."
    ],
    security: [
      "Inbound auth uses the existing IDCS domain, audience, and scope.",
      "Container image is stored in private OCIR and deployed through OCI."
    ],
    result: [
      "Shows an agentic application packaged and hosted on OCI.",
      "Useful for incident response, operations assistants, and domain-specific agent APIs."
    ]
  },
  "langgraph-hosted-agent-mcp": {
    services: [
      "OCI Generative AI Hosted Application for a separate LangGraph runtime.",
      "MCP-style tool discovery and invocation for knowledge and workflow actions."
    ],
    security: [
      "Hosted metadata is generated by Terraform and surfaced without exposing secrets.",
      "The agent can only choose from the approved MCP tool registry."
    ],
    result: [
      "Shows a graph-based agent selecting a tool before producing the final response.",
      "Useful for enterprise agents that combine hosted runtime isolation with reusable tool gateways."
    ]
  },
  "a2a-agent-collaboration": {
    services: [
      "A2A-style agent card discovery and task exchange.",
      "Existing OCI hosted incident-response and LangGraph MCP agents."
    ],
    security: [
      "Reuses hosted application IDCS auth boundaries and Terraform-generated metadata.",
      "Agent handoff is represented as scoped tasks with no browser-visible secrets."
    ],
    result: [
      "Shows two specialized agents collaborating on one incident workflow.",
      "Useful for cross-agent triage, workflow lookup, and coordinated customer response."
    ]
  },
  "n8n-hosted-workflow-automation": {
    services: [
      "OCI Generative AI Hosted Application for a real n8n container.",
      "OCI Hosted Deployment backed by a private OCIR n8n image."
    ],
    security: [
      "Hosted application inbound auth uses the configured IDCS domain, audience, and scope.",
      "n8n basic auth is injected at runtime and is not rendered in the portal."
    ],
    result: [
      "Opens a live n8n workflow automation UI from the portal.",
      "Useful for demonstrating hosted workflow tools alongside agentic applications."
    ]
  },
  "langfuse-hosted-observability": {
    services: [
      "OCI Generative AI Hosted Application for a real Langfuse web container.",
      "OCI Hosted Deployment backed by a private OCIR Langfuse image."
    ],
    security: [
      "Hosted application inbound auth uses the configured IDCS domain, audience, and scope.",
      "Database, ClickHouse, Redis, and object-storage secrets are injected as runtime environment variables."
    ],
    result: [
      "Opens a live Langfuse observability UI from the portal.",
      "Useful for demonstrating trace and prompt observability next to hosted agent deployments."
    ]
  },
  "openclaw-hosted-agent-gateway": {
    services: [
      "OCI Generative AI Hosted Application for an OpenClaw gateway container.",
      "OCI Hosted Deployment backed by a private OCIR OpenClaw image."
    ],
    security: [
      "Hosted application inbound auth uses the configured IDCS domain, audience, and scope.",
      "OpenClaw gateway token is injected at runtime and agent tool execution should stay constrained."
    ],
    result: [
      "Opens a hosted OpenClaw Control UI from the portal.",
      "Useful for demonstrating self-hosted agent gateways alongside OCI hosted deployments."
    ]
  },
  "agentic-control-tower": {
    services: [
      "Real LlamaIndex workflow for multi-step agent orchestration.",
      "OCI Responses API for final synthesis when live configuration is present."
    ],
    security: [
      "IDCS credential posture is loaded server-side from Terraform-generated metadata.",
      "Client secret and API key values are redacted before browser output."
    ],
    result: [
      "Shows planning, tool execution, evidence review, approval, memory, and audit in one agent run.",
      "Useful for enterprise control tower and incident command workflows."
    ]
  },
  "agentic-rag-planner": {
    services: [
      "OCI Responses API for planning retrieval and final answer policy.",
      "File Search / Vector Store pattern represented as approved evidence retrieval."
    ],
    security: [
      "The agent plan requires evidence sufficiency before answer generation.",
      "Missing evidence is reported instead of fabricating support guidance."
    ],
    result: [
      "Shows agentic planning before document-grounded answering.",
      "Useful for enterprise RAG assistants that need explainable retrieval decisions."
    ]
  },
  "human-approval-agent": {
    services: [
      "OCI Responses API for drafting approval-ready agent action proposals.",
      "Human approval checkpoint around customer-impacting or operational actions."
    ],
    security: [
      "Risk classification determines whether the agent can proceed.",
      "Approved tool names are explicit and constrained."
    ],
    result: [
      "Shows a governed agent action pattern with human review.",
      "Useful for production workflows where agents must not act autonomously."
    ]
  },
  "governance-center": {
    services: [
      "OCI Responses API plus local governance/audit controls.",
      "Policy checks for data sensitivity, approved tools, and production readiness."
    ],
    security: [
      "Sensitive values are redacted from audit output.",
      "Blocked requests return a decision without invoking the model."
    ],
    result: [
      "Shows enterprise AI control-plane behavior.",
      "Useful for audit, approval, and production readiness workflows."
    ]
  },
  "document-understanding-genai": {
    services: [
      "OCI Responses API for document-grounded summarization.",
      "Bundled Oracle PDF assets representing enterprise documents."
    ],
    security: [
      "Documents are local repo assets for non-internet setup.",
      "Only extracted document signals are sent to the model."
    ],
    result: [
      "Summarizes themes and controls from approved documents.",
      "Useful for policy, architecture, and compliance review demos."
    ]
  },
  "batch-inference": {
    services: [
      "OCI Responses API for batch-style record processing.",
      "Local batch manifest that models prompt queues and review outputs."
    ],
    security: [
      "Uses the shared OCI project and API key.",
      "Batch records are local synthetic support-ticket examples."
    ],
    result: [
      "Produces review-ready summaries for multiple records.",
      "Demonstrates the shape of asynchronous enterprise prompt processing."
    ]
  },
  "model-evaluation": {
    services: [
      "OCI Responses API for evaluator-style reasoning.",
      "Local rubric and representative enterprise test cases."
    ],
    security: [
      "Evaluation criteria include safety and production-readiness gates.",
      "No customer data is required for the bundled evaluation cases."
    ],
    result: [
      "Returns readiness risks and remediation steps.",
      "Useful before promoting prompts, models, or assistant configurations."
    ]
  },
  "multimodal-vision": {
    services: [
      "OCI Responses API using structured visual context.",
      "Local visual asset manifest representing an approved incident screenshot."
    ],
    security: [
      "Visual evidence is reduced to approved operational signals.",
      "The demo avoids uploading arbitrary user images from the browser."
    ],
    result: [
      "Turns visual operational signals into a triage summary.",
      "Useful for screenshots, dashboards, diagrams, and inspection workflows."
    ]
  },
  "ai-workflow-orchestration": {
    services: [
      "OCI Responses API for workflow-state planning.",
      "Local workflow step manifest for tools, approval, and audit handoff."
    ],
    security: [
      "Workflow steps include an explicit human approval checkpoint.",
      "The output is designed as an audited ticket update, not an automatic external action."
    ],
    result: [
      "Produces the next workflow state and approval checkpoint.",
      "Shows how model calls fit into durable business processes."
    ]
  }
};

const flowDiagrams = {
  "responses-api": {
    title: "Responses API Flow",
    nodes: ["Portal prompt", "Responses API", "OCI model", "Structured answer"],
    mermaid: "flowchart LR\n  A[Portal prompt] --> B[Responses API]\n  B --> C[OCI model]\n  C --> D[Structured answer]"
  },
  "conversation-store": {
    title: "Conversation Store Flow",
    nodes: ["Session turn", "Conversation store", "Responses API", "Context-aware answer"],
    mermaid: "flowchart LR\n  A[Session turn] --> B[Conversation store]\n  B --> C[Responses API]\n  C --> D[Context-aware answer]"
  },
  guardrails: {
    title: "Guardrails Flow",
    nodes: ["User input", "Policy checks", "Sanitized prompt", "Safe answer"],
    mermaid: "flowchart LR\n  A[User input] --> B[Policy checks]\n  B --> C[Sanitized prompt]\n  C --> D[Safe answer]"
  },
  "file-search-vector-store-rag": {
    title: "File Search RAG Flow",
    nodes: ["Bundled Oracle PDFs", "OCI Files API", "Vector Store", "File Search tool", "Grounded answer"],
    mermaid:
      "flowchart LR\n  A[Bundled Oracle PDFs] --> B[OCI Files API]\n  B --> C[Vector Store]\n  C --> D[Responses API File Search]\n  D --> E[Grounded answer]"
  },
  "code-interpreter": {
    title: "Code Interpreter Flow",
    nodes: ["Prompt", "Responses API", "Code container", "Python execution", "Computed result"],
    mermaid:
      "flowchart LR\n  A[Prompt] --> B[Responses API]\n  B --> C[Code container]\n  C --> D[Python execution]\n  D --> E[Computed result]"
  },
  "function-calling": {
    title: "Function Calling Flow",
    nodes: ["Prompt", "Function schema", "Local service", "Tool result", "Answer"],
    mermaid: "flowchart LR\n  A[Prompt] --> B[Function schema]\n  B --> C[Local service]\n  C --> D[Tool result]\n  D --> E[Answer]"
  },
  "remote-mcp-calling": {
    title: "Remote MCP Flow",
    nodes: ["Prompt", "MCP connector", "Remote tool", "Tool result", "Answer"],
    mermaid: "flowchart LR\n  A[Prompt] --> B[MCP connector]\n  B --> C[Remote tool]\n  C --> D[Tool result]\n  D --> E[Answer]"
  },
  "nl2sql-sql-search": {
    title: "NL2SQL Flow",
    nodes: ["Question", "SQL Search metadata", "Database Tools", "Autonomous DB", "Answer"],
    mermaid: "flowchart LR\n  A[Question] --> B[SQL Search metadata]\n  B --> C[Database Tools]\n  C --> D[Autonomous DB]\n  D --> E[Answer]"
  },
  "long-term-memory": {
    title: "Long-Term Memory Flow",
    nodes: ["User event", "Memory policy", "Long-term memory", "Personalized response"],
    mermaid: "flowchart LR\n  A[User event] --> B[Memory policy]\n  B --> C[Long-term memory]\n  C --> D[Personalized response]"
  },
  "multi-model-routing": {
    title: "Multi-Model Routing Flow",
    nodes: ["Request", "Routing policy", "Selected model", "Optimized response"],
    mermaid: "flowchart LR\n  A[Request] --> B[Routing policy]\n  B --> C[Selected model]\n  C --> D[Optimized response]"
  },
  "hosted-agentic-applications": {
    title: "Hosted Agent App Flow",
    nodes: ["Source app", "OCI deployment", "Managed runtime", "Agent endpoint"],
    mermaid: "flowchart LR\n  A[Source app] --> B[OCI deployment]\n  B --> C[Managed runtime]\n  C --> D[Agent endpoint]"
  },
  "langgraph-hosted-agent-mcp": {
    title: "LangGraph Hosted Agent + MCP Flow",
    nodes: ["LangGraph source", "Separate OCI hosted app", "MCP tool call", "Responses API answer"],
    mermaid:
      "flowchart LR\n  A[LangGraph source] --> B[Separate OCI hosted app]\n  B --> C[MCP tool call]\n  C --> D[Responses API answer]"
  },
  "a2a-agent-collaboration": {
    title: "Agent2Agent Collaboration Flow",
    nodes: ["Agent card discovery", "A2A task", "Incident agent", "LangGraph agent", "Coordinated answer"],
    mermaid:
      "flowchart LR\n  A[Agent card discovery] --> B[A2A task]\n  B --> C[Incident agent]\n  C --> D[LangGraph agent]\n  D --> E[Coordinated answer]"
  },
  "n8n-hosted-workflow-automation": {
    title: "n8n Hosted Workflow Flow",
    nodes: ["n8n image", "OCI hosted app", "Hosted deployment URL", "n8n workflow UI"],
    mermaid:
      "flowchart LR\n  A[n8n image] --> B[OCI hosted app]\n  B --> C[Hosted deployment URL]\n  C --> D[n8n workflow UI]"
  },
  "langfuse-hosted-observability": {
    title: "Langfuse Hosted Observability Flow",
    nodes: ["Langfuse image", "External stores", "OCI hosted app", "Hosted deployment URL", "Langfuse UI"],
    mermaid:
      "flowchart LR\n  A[Langfuse image] --> B[OCI hosted app]\n  C[External stores] --> B\n  B --> D[Hosted deployment URL]\n  D --> E[Langfuse UI]"
  },
  "openclaw-hosted-agent-gateway": {
    title: "OpenClaw Hosted Gateway Flow",
    nodes: ["OpenClaw image", "OCI hosted app", "Hosted deployment URL", "OpenClaw Control UI"],
    mermaid:
      "flowchart LR\n  A[OpenClaw image] --> B[OCI hosted app]\n  B --> C[Hosted deployment URL]\n  C --> D[OpenClaw Control UI]"
  },
  "agentic-control-tower": {
    title: "Agentic Control Tower Flow",
    nodes: ["Operator prompt", "LlamaIndex workflow", "Enterprise tools", "Evidence review", "IDCS posture", "OCI synthesis"],
    mermaid:
      "flowchart LR\n  A[Operator prompt] --> B[LlamaIndex workflow]\n  B --> C[Enterprise tool execution]\n  C --> D[Evidence and approval review]\n  D --> E[IDCS posture check]\n  E --> F[OCI Responses synthesis]"
  },
  "agentic-rag-planner": {
    title: "Agentic RAG Planner Flow",
    nodes: ["User question", "Planning agent", "Retrieval queries", "Evidence check", "Grounded answer plan"],
    mermaid:
      "flowchart LR\n  A[User question] --> B[Planning agent]\n  B --> C[Retrieval queries]\n  C --> D[Evidence check]\n  D --> E[Grounded answer plan]"
  },
  "human-approval-agent": {
    title: "Human Approval Agent Flow",
    nodes: ["Agent request", "Risk classification", "Approval checkpoint", "Approved action proposal"],
    mermaid:
      "flowchart LR\n  A[Agent request] --> B[Risk classification]\n  B --> C[Approval checkpoint]\n  C --> D[Approved action proposal]"
  },
  "governance-center": {
    title: "Governance Flow",
    nodes: ["AI workload", "IAM policies", "Audit signals", "Governed operation"],
    mermaid: "flowchart LR\n  A[AI workload] --> B[IAM policies]\n  B --> C[Audit signals]\n  C --> D[Governed operation]"
  },
  "document-understanding-genai": {
    title: "Document AI Flow",
    nodes: ["Document", "Extraction", "Generative summary", "Review output"],
    mermaid: "flowchart LR\n  A[Document] --> B[Extraction]\n  B --> C[Generative summary]\n  C --> D[Review output]"
  },
  "batch-inference": {
    title: "Batch Inference Flow",
    nodes: ["Prompt batch", "Job submission", "Async processing", "Output review"],
    mermaid: "flowchart LR\n  A[Prompt batch] --> B[Job submission]\n  B --> C[Async processing]\n  C --> D[Output review]"
  },
  "model-evaluation": {
    title: "Model Evaluation Flow",
    nodes: ["Eval dataset", "Candidate response", "Scoring rubric", "Promotion gate"],
    mermaid: "flowchart LR\n  A[Eval dataset] --> B[Candidate response]\n  B --> C[Scoring rubric]\n  C --> D[Promotion gate]"
  },
  "multimodal-vision": {
    title: "Multimodal Vision Flow",
    nodes: ["Visual asset", "Prompt context", "Vision model", "Structured insight"],
    mermaid: "flowchart LR\n  A[Visual asset] --> B[Prompt context]\n  B --> C[Vision model]\n  C --> D[Structured insight]"
  },
  "ai-workflow-orchestration": {
    title: "AI Workflow Orchestration Flow",
    nodes: ["Business event", "Model step", "Tool/approval step", "Audited outcome"],
    mermaid: "flowchart LR\n  A[Business event] --> B[Model step]\n  B --> C[Tool/approval step]\n  C --> D[Audited outcome]"
  }
};

const ociFeatureCodeSnippets = {
  "responses-api": `response = client.responses.create(
    model=model,
    input=prompt,
    temperature=temperature,
)`,
  "conversation-store": `response = client.responses.create(
    model=model,
    input=prompt,
    store=True,
    metadata={"session_id": session_id},
)`,
  guardrails: `guardrail_result = evaluate_policy(prompt)
if guardrail_result["allowed"]:
    response = client.responses.create(model=model, input=sanitized_prompt)`,
  "file-search-vector-store-rag": `tool = {
    "type": "file_search",
    "vector_store_ids": [vector_store_id],
}
response = client.responses.create(model=model, input=prompt, tools=[tool])`,
  "code-interpreter": [
    `container = client.containers.create(
    name=container_name,
    memory_limit="1g",
)`,
    `tool = {"type": "code_interpreter", "container": container.id}
response = client.responses.create(model=model, input=prompt, tools=[tool])`
  ],
  "function-calling": `tool = {"type": "function", "function": function_schema}
response = client.responses.create(model=model, input=prompt, tools=[tool])`,
  "remote-mcp-calling": `tool = {"type": "mcp", "server_label": "enterprise-tools", "server_url": mcp_url}
response = client.responses.create(model=model, input=prompt, tools=[tool])`,
  "nl2sql-sql-search": `sql = generate_sql_from_question(prompt)
rows = autonomous_database.query(validate_select_only(sql))
response = client.responses.create(model=model, input=summarize_rows(rows))`,
  "long-term-memory": `memory_context = memory.search(user_id=user_id, query=prompt)
response = client.responses.create(model=model, input=[memory_context, prompt])`,
  "multi-model-routing": `selected_model = route_model(prompt, latency_budget, task_type)
response = client.responses.create(model=selected_model, input=prompt)`,
  "hosted-agentic-applications": `deployment = oci.generative_ai.get_hosted_deployment(deployment_id)
agent_response = call_hosted_agent(deployment.endpoint, task_payload)`,
  "langgraph-hosted-agent-mcp": [
    `graph = build_langgraph_agent()
state = {"messages": prompt, "mcp_tools": discovered_tools}`,
    `tool_result = graph.invoke(state)`
  ],
  "a2a-agent-collaboration": [
    `agent_card = discover_agent_card(agent_url)
task = send_a2a_task(agent_card, prompt)`,
    `response = collect_agent_result(task)`
  ],
  "n8n-hosted-workflow-automation": `deployment = read_n8n_hosted_workflow_metadata()
window.open(deployment.url, "_blank", "noopener,noreferrer")`,
  "langfuse-hosted-observability": `deployment = read_langfuse_hosted_observability_metadata()
window.open(deployment.url, "_blank", "noopener,noreferrer")`,
  "openclaw-hosted-agent-gateway": `deployment = read_openclaw_hosted_gateway_metadata()
window.open(deployment.url, "_blank", "noopener,noreferrer")`,
  "agentic-control-tower": [
    `workflow = ControlTowerWorkflow(timeout=10)
result = await workflow.run(prompt=prompt)`,
    `response = client.responses.create(
    model=model,
    input=build_control_tower_prompt(result),
)`
  ],
  "agentic-rag-planner": [
    `plan = build_retrieval_plan(prompt)
queries = plan["retrievalQueries"]`,
    `response = client.responses.create(
    model=model,
    input=build_grounded_plan_prompt(plan),
)`
  ],
  "human-approval-agent": [
    `approval = classify_agent_action_risk(prompt)
requires_review = approval["approvalRequired"]`,
    `response = client.responses.create(
    model=model,
    input=build_approval_prompt(approval),
)`
  ],
  "governance-center": `decision = evaluate_ai_policy(prompt, principal, data_classification)
audit.write_event(decision)
response = client.responses.create(model=model, input=decision.approved_prompt)`,
  "document-understanding-genai": `fields = document_ai.extract(document)
response = client.responses.create(model=model, input=build_summary_prompt(fields))`,
  "batch-inference": `batch = client.batches.create(input_file_id=file_id, endpoint="/v1/responses")
outputs = client.batches.retrieve(batch.id)`,
  "model-evaluation": `candidate = client.responses.create(model=model, input=eval_prompt)
score = evaluate_response(candidate.output_text, rubric)`,
  "multimodal-vision": `response = client.responses.create(
    model=vision_model,
    input=[{"type": "input_text", "text": prompt}, image_input],
)`,
  "ai-workflow-orchestration": `workflow_state = run_model_step(prompt)
workflow_state = run_tool_or_approval_step(workflow_state)
audit.persist(workflow_state)`
};

function featureCard(feature, index) {
  const hasFlowDiagram = Boolean(flowDiagrams[feature.id]);

  return `
    <article class="feature-card accent-${feature.accent}" tabindex="0" data-card style="--card-index: '${String(index + 1).padStart(2, "0")}'">
      <div class="feature-card-inner">
        <section class="card-face card-front" aria-label="${feature.title} summary">
          <div class="card-glow" aria-hidden="true"></div>
          <div class="card-pattern" aria-hidden="true"></div>
          <div class="card-topline">
            <span class="icon-shell" aria-hidden="true">${iconByCategory[feature.serviceArea] ?? "AI"}</span>
            <span class="status-pill">${feature.status}</span>
          </div>
          <div>
            <p class="category">${feature.serviceArea}</p>
            <h2>${feature.title}</h2>
            <p class="summary">${feature.summary}</p>
          </div>
          <div class="rating-shell" data-rating-shell="${feature.id}" data-rating-placement="card">
            ${renderDemoRatingControl(feature.id, "card")}
          </div>
          <div class="hint-row">
            <span>${feature.serviceArea}</span>
            <div class="front-actions">
              ${hasFlowDiagram ? `<button class="flow-icon-button" type="button" data-show-flow="${feature.id}" aria-label="Show ${feature.title} resource flow" title="Resource flow">Flow</button>` : ""}
              ${demoDefaults[feature.id] ? `<button class="front-run-button" type="button" data-run-demo="${feature.id}" aria-label="Run ${feature.title} demo" title="Run demo">Run ${renderRunCountBadge(feature.id)}</button>` : ""}
            </div>
          </div>
        </section>
      </div>
    </article>
  `;
}

function renderPortal() {
  const root = document.getElementById("root");
  const categories = [...new Set(aiFeatures.map((feature) => feature.serviceArea))];
  const cardTuneOptions = cardColorTunes
    .map(
      (tune) =>
        `<option value="${tune.id}"${tune.id === defaultCardAppearance.tune ? " selected" : ""}>${tune.label}</option>`
    )
    .join("");

  root.innerHTML = `
    <main>
      <header class="portal-header">
        <nav aria-label="Portal">
          <div class="brand-mark">
            <span class="brand-icon" aria-hidden="true">AI</span>
            <span>OCI Enterprise AI Portal</span>
          </div>
          <div class="nav-actions">
            <a class="nav-link" href="#catalog">Catalog</a>
            <form method="post" action="/logout">
              <button class="nav-link logout-button" type="submit">Logout</button>
            </form>
          </div>
        </nav>

        <section class="hero">
          <div class="hero-copy">
            <p class="eyebrow">Enterprise AI demo environment</p>
            <h1>OCI Enterprise AI Demos</h1>
            <p>
              A focused portal for demonstrating OCI Enterprise AI capabilities, live backend flows,
              Terraform-managed infrastructure, and governed runtime behavior.
            </p>
            <div class="hero-actions" aria-label="Portal summary">
              <a href="#catalog">View demos</a>
              <span>${aiFeatures.length} feature demos</span>
            </div>
          </div>
          <aside class="hero-showcase" aria-label="Portal preview">
            <div class="showcase-card showcase-one">
              <span>01</span>
              <strong>Capabilities</strong>
              <p>Responses, RAG, guardrails, agents</p>
            </div>
            <div class="showcase-card showcase-two">
              <span>02</span>
              <strong>Live Runs</strong>
              <p>Backend demos with OCI runtime traces</p>
            </div>
            <div class="showcase-card showcase-three">
              <span>03</span>
              <strong>Infrastructure</strong>
              <p>Terraform state and provisioned resources</p>
            </div>
          </aside>
        </section>
      </header>

      <section class="catalog-section" id="catalog" aria-labelledby="catalog-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Demo catalog</p>
            <h2 id="catalog-title">OCI Enterprise AI capabilities</h2>
          </div>
          <p class="section-note">Run focused demos backed by shared OCI Generative AI configuration, live backend code paths, and refreshable infrastructure state.</p>
        </div>
        <div class="category-rail" aria-label="Feature categories">
          ${categories.map((category) => `<span>${category}</span>`).join("")}
        </div>
        <label class="search-panel" for="feature-search">
          <span>Search demos</span>
          <input id="feature-search" type="search" placeholder="Search Responses API, guardrails, agents, memory, Terraform, SDK..." autocomplete="off" />
        </label>
        <div class="appearance-panel" aria-label="Card appearance controls">
          <label for="card-tune">
            <span>Card theme</span>
            <select id="card-tune">
              ${cardTuneOptions}
            </select>
          </label>
          <label for="card-reflection">
            <span>Surface light</span>
            <input id="card-reflection" type="range" min="0" max="100" value="${defaultCardAppearance.reflection}" />
          </label>
          <label for="card-darkness">
            <span>Contrast</span>
            <input id="card-darkness" type="range" min="0" max="100" value="${defaultCardAppearance.darkness}" />
          </label>
        </div>
        <details class="infra-panel" id="infra-panel">
          <summary>
            <span>Infrastructure</span>
            <span class="infra-summary-actions">
              <button class="infra-refresh-button" id="infra-refresh-button" type="button" aria-label="Refresh infrastructure state" title="Refresh infrastructure state">🔄</button>
              <strong id="infra-summary-status">Not created</strong>
            </span>
          </summary>
          <div class="infra-layout">
            <section class="infra-status-panel" aria-label="Infrastructure status">
              <div>
                <h3 class="infra-subheading">Resources</h3>
                <div class="infra-filter-bar" aria-label="Infrastructure resource filters">
                  <label for="infra-component-search">
                    <span>Search</span>
                    <input id="infra-component-search" type="search" placeholder="Filter resources" autocomplete="off" />
                  </label>
                  <label for="infra-component-type-filter">
                    <span>Type</span>
                    <select id="infra-component-type-filter">
                      <option value="all">All types</option>
                    </select>
                  </label>
                </div>
                <div class="component-table" id="all-infra-components">
                  <div class="component-row">
                    <span class="component-icon" aria-hidden="true">○</span>
                    <strong>Resources</strong>
                    <span>Not loaded</span>
                    <code>Use refresh to load current state</code>
                    <button class="copy-resource-button" type="button" disabled>Copy</button>
                  </div>
                </div>
              </div>
              <div class="infra-log-panel">
                <div class="infra-log-header">
                  <h3>Action logs</h3>
                </div>
                <pre id="infra-action-logs">No infrastructure actions yet.</pre>
              </div>
            </section>
          </div>
        </details>
        <div class="results-count" id="results-count" aria-live="polite"></div>
        <div class="feature-grid" id="feature-grid"></div>
      </section>
    </main>
    <dialog class="flow-dialog" id="flow-dialog">
      <div class="flow-shell">
        <header class="flow-header">
          <div>
            <p class="eyebrow">Resource flow</p>
            <h2 id="flow-dialog-title">Resource Flow</h2>
          </div>
          <button class="dialog-close" id="flow-close-button" type="button">Close</button>
        </header>
        <div class="flow-body">
          <div class="flow-track" id="flow-track"></div>
          <pre class="flow-mermaid" id="flow-mermaid"></pre>
        </div>
      </div>
    </dialog>
    <dialog class="demo-dialog" id="responses-demo-dialog">
      <form method="dialog" class="demo-shell">
        <div class="demo-header">
          <div>
            <p class="eyebrow">Live demo</p>
            <div class="demo-title-row">
              <h2 id="demo-dialog-title">Responses API Workbench</h2>
            </div>
            <p class="demo-header-copy" id="demo-details-summary"></p>
            <p class="demo-header-copy" id="demo-details-use-case"></p>
            <p class="demo-header-copy demo-doc-copy">
              <a class="demo-doc-link" id="demo-details-doc-link" href="#" target="_blank" rel="noreferrer">Documentation</a>
              <a class="demo-doc-link demo-wiring-link" id="demo-details-wiring-link" href="#" target="_blank" rel="noreferrer" hidden>OCI wiring diagram</a>
            </p>
            <div class="rating-shell" id="demo-rating-shell" data-rating-placement="dialog"></div>
          </div>
          <div class="dialog-window-actions" aria-label="Demo window controls">
            <button id="responses-minimize-button" type="button" aria-label="Minimize demo">_</button>
            <button id="responses-maximize-button" type="button" aria-label="Maximize demo">□</button>
            <button class="dialog-close" value="close" aria-label="Close demo">×</button>
          </div>
        </div>
        <div class="demo-body" id="responses-demo-body">
          <label class="demo-field" for="responses-prompt">
            <span>Prompt</span>
            <textarea id="responses-prompt" rows="5">Summarize this support note: database latency increased after deployment and customers are seeing slower checkout confirmations.</textarea>
          </label>
          <div class="demo-controls">
            <label id="responses-session-field">
              <span>Session ID</span>
              <input id="responses-session-id" value="" />
            </label>
            <label>
              <span>OCI Responses model</span>
              <input id="responses-model" value="openai.gpt-oss-120b" />
            </label>
            <label>
              <span>Project OCID</span>
              <input id="responses-project-id-display" placeholder="Provision infra first" />
            </label>
            <label id="responses-tool-resource-field" hidden>
              <span id="responses-tool-resource-label">Tool Resource ID</span>
              <input id="responses-tool-resource-id" placeholder="Optional tool resource" />
            </label>
            <label class="demo-checkbox-field" id="responses-code-container-refresh-field" hidden>
              <input id="responses-code-container-refresh" type="checkbox" />
              <span>Create new container</span>
            </label>
            <label>
              <span>Temperature</span>
              <input id="responses-temperature" type="number" min="0" max="1" step="0.1" value="0.2" />
            </label>
            <button id="responses-run-button" type="button">Run demo</button>
          </div>
          <div class="demo-output-grid">
            <section>
              <h3>Request Payload</h3>
              <pre id="responses-request">{}</pre>
            </section>
            <section class="response-output-panel">
              <div class="panel-heading-row">
                <h3>Relevant Output</h3>
                <div class="output-toggle" aria-label="Relevant output format">
                  <button type="button" data-output-view="markdown" aria-pressed="true">Markdown</button>
                  <button type="button" data-output-view="json" aria-pressed="false">JSON</button>
                </div>
              </div>
              <div class="response-output" id="responses-output">Provision infra, add API key if needed, then run the demo.</div>
            </section>
            <section class="more-details-panel">
              <details class="more-details-tab" id="responses-technical-tab" data-more-details-tab>
                <summary>Technical details</summary>
                <div class="run-trace" id="responses-action-logs">
                  <div class="run-trace-empty">No run yet.</div>
                </div>
              </details>
              <details class="more-details-tab" id="responses-logs-tab" data-more-details-tab>
                <summary>Logs</summary>
                <div class="more-details-grid">
                  <div class="more-detail-block">
                    <h3>Execution logs</h3>
                    <div class="live-run-logs" id="responses-live-logs">
                      <div class="live-log-line">No live run yet.</div>
                    </div>
                  </div>
                  <div class="more-detail-block oci-snippet-panel">
                    <h3>OCI feature code</h3>
                    <div id="responses-feature-snippet"></div>
                  </div>
                </div>
              </details>
            </section>
          </div>
        </div>
      </form>
    </dialog>
    <dialog class="run-notice-dialog" id="run-notice-dialog">
      <form method="dialog" class="run-notice-shell">
        <p class="eyebrow">Run notice</p>
        <h2 id="run-notice-title">Run notice</h2>
        <p id="run-notice-message"></p>
        <button class="dialog-close" value="close">OK</button>
      </form>
    </dialog>
  `;
}

function openFlowDiagram(featureId) {
  const diagram = flowDiagrams[featureId];
  if (!diagram) return;

  document.getElementById("flow-dialog-title").textContent = diagram.title;
  document.getElementById("flow-track").innerHTML = diagram.nodes
    .map(
      (node, index) => `
        <div class="flow-step">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${node}</strong>
        </div>
      `
    )
    .join('<span class="flow-arrow" aria-hidden="true">→</span>');
  document.getElementById("flow-mermaid").textContent = diagram.mermaid;
  document.getElementById("flow-dialog").showModal();
}

function applyCardAppearance(settings) {
  const root = document.documentElement;
  const appearanceVars = getCardAppearanceVars(settings);

  Object.entries(appearanceVars).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
}

function attachCardAppearanceControls() {
  const tuneInput = document.getElementById("card-tune");
  const reflectionInput = document.getElementById("card-reflection");
  const darknessInput = document.getElementById("card-darkness");

  const updateCardAppearance = () => {
    applyCardAppearance({
      tune: tuneInput.value,
      reflection: reflectionInput.value,
      darkness: darknessInput.value
    });
  };

  tuneInput.addEventListener("change", updateCardAppearance);
  reflectionInput.addEventListener("input", updateCardAppearance);
  darknessInput.addEventListener("input", updateCardAppearance);
  updateCardAppearance();
}

function attachCardInteractions() {
  document.querySelectorAll("[data-card]").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      if (card.classList.contains("is-expanded")) return;

      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--tilt-x", `${(-y * 5).toFixed(2)}deg`);
      card.style.setProperty("--tilt-y", `${(x * 6).toFixed(2)}deg`);
    });

    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
    });

    card.addEventListener("click", (event) => {
      if (
        event.target.closest("a") ||
        event.target.closest(".lifecycle-action") ||
        event.target.closest(".icon-link") ||
        event.target.closest("[data-run-demo]") ||
        event.target.closest("[data-show-flow]") ||
        event.target.closest("[data-rating-feature]")
      )
        return;
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
      }
    });
  });

  document.querySelectorAll("[data-run-demo]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (demoDefaults[button.dataset.runDemo]) {
        incrementFeatureRunCount(button.dataset.runDemo);
        openDemoDialog(button.dataset.runDemo);
      } else {
        button.textContent = "Coming soon";
        window.setTimeout(() => {
          button.textContent = "Run";
        }, 1200);
      }
    });
  });

  document.querySelectorAll("[data-show-flow]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openFlowDiagram(button.dataset.showFlow);
    });
  });

  attachDemoRatingInteractions();

  document.querySelectorAll("[data-provision-demo]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (button.dataset.provisionDemo === "responses-api") {
        document.getElementById("infra-panel").open = true;
        document.getElementById("infra-panel").scrollIntoView({ block: "start" });
      } else {
        button.textContent = "Terraform Required";
        window.setTimeout(() => {
          button.textContent = "Provision Infra";
        }, 1400);
      }
    });
  });

  document.querySelectorAll("[data-destroy-demo]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (button.dataset.destroyDemo === "responses-api") {
        document.getElementById("infra-panel").open = true;
        document.getElementById("infra-panel").scrollIntoView({ block: "start" });
      }
    });
  });
}

function getResponsesConfig() {
  return {
    region: defaultProvisionConfig.region,
    projectId: document.getElementById("responses-project-id-display").value.trim() || infraState.projectId
  };
}

function renderFeatureSnippet(featureId) {
  const snippets = []
    .concat(ociFeatureCodeSnippets[featureId] || ociFeatureCodeSnippets["responses-api"])
    .filter(Boolean);
  const target = document.getElementById("responses-feature-snippet");
  if (target) {
    target.innerHTML = snippets
      .map(
        (snippet, index) => `
          <article class="oci-code-card">
            <strong>${snippets.length > 1 ? `Step ${index + 1}` : "Feature call"}</strong>
            <pre>${escapeHtml(snippet)}</pre>
          </article>`
      )
      .join("");
  }
}

function attachMoreDetailsAccordion() {
  document.querySelectorAll("[data-more-details-tab]").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) {
        return;
      }

      document.querySelectorAll("[data-more-details-tab]").forEach((otherDetails) => {
        if (otherDetails !== details) {
          otherDetails.open = false;
        }
      });
    });
  });
}

function defaultWiringHref(featureId) {
  return `docs/wiring/${featureId}.svg`;
}

function openDemoDialog(featureId) {
  const defaults = demoDefaults[featureId] || demoDefaults["responses-api"];
  const feature = aiFeatures.find((item) => item.id === featureId) || aiFeatures[0];
  activeDemoId = featureId;
  document
    .getElementById("responses-demo-dialog")
    .classList.toggle("is-launch-demo", hostedUiLaunchDemoIds.includes(featureId));
  document.getElementById("demo-dialog-title").textContent = defaults.title;
  document.getElementById("demo-details-summary").textContent = feature.details || feature.summary;
  document.getElementById("demo-details-use-case").textContent = `Use case: ${feature.sampleUseCase}`;
  const docsLink = document.getElementById("demo-details-doc-link");
  docsLink.href = feature.docsHref;
  docsLink.textContent = "Documentation";
  docsLink.setAttribute("aria-label", `Open ${feature.title} documentation`);
  const wiringLink = document.getElementById("demo-details-wiring-link");
  const wiringHref = feature.wiringHref || defaultWiringHref(feature.id);
  wiringLink.hidden = !wiringHref;
  if (wiringHref) {
    wiringLink.href = wiringHref;
    wiringLink.textContent = feature.wiringLabel || "OCI wiring diagram";
    wiringLink.setAttribute("aria-label", `Open ${feature.title} OCI wiring diagram`);
  } else {
    wiringLink.removeAttribute("href");
    wiringLink.removeAttribute("aria-label");
  }
  document.getElementById("responses-prompt").value = defaults.prompt;
  document.getElementById("responses-run-button").textContent = defaults.button || "Run demo";
  const ratingShell = document.getElementById("demo-rating-shell");
  ratingShell.dataset.ratingShell = featureId;
  ratingShell.innerHTML = renderDemoRatingControl(featureId, "dialog");
  renderDemoOutput(defaults.output);
  renderLiveLogs();
  renderFeatureSnippet(featureId);
  document.getElementById("responses-request").textContent = "{}";
  renderRunTrace([], { status: "idle" });
  document.getElementById("responses-session-id").value = defaults.sessionId;
  document.getElementById("responses-session-field").hidden = !defaults.sessionVisible;
  document.getElementById("responses-tool-resource-field").hidden = !defaults.toolResourceVisible;
  document.getElementById("responses-tool-resource-label").textContent = defaults.toolResourceLabel || "Tool Resource ID";
  document.getElementById("responses-tool-resource-id").placeholder = defaults.toolResourcePlaceholder || "Optional tool resource";
  document.getElementById("responses-code-container-refresh-field").hidden = featureId !== "code-interpreter";
  document.getElementById("responses-code-container-refresh").checked = false;
  const provisionedToolResourceId =
    featureId === "file-search-vector-store-rag"
      ? infraState.vectorStoreId
      : featureId === "code-interpreter"
        ? infraState.codeInterpreterContainerId
        : "";
  document.getElementById("responses-tool-resource-id").value = defaults.toolResourceId || provisionedToolResourceId || "";
  syncDemoInfraFields();
  document.getElementById("responses-demo-dialog").showModal();
}

function writeActionLogs(action, payload, targetId = "responses-action-logs") {
  const actionLogs = document.getElementById(targetId);
  const decorateLogs = targetId === "responses-action-logs";
  if (decorateLogs) {
    renderRunTrace(payload.trace || [], {
      status: payload.status || (payload.error ? "failed" : "completed"),
      action,
      durationMs: payload.durationMs,
      error: payload.error,
      fallbackLogs: payload.logs || []
    });
    return;
  }
  const status = payload.status || (payload.error ? "failed" : "completed");
  const statusIcon = {
    completed: "✅",
    failed: "❌",
    started: "🚀",
    success: "✅"
  }[status] || "📝";
  const logEntries = payload.logs
    ? payload.logs.map((entry) => {
        const entryIcon = {
          failed: "❌",
          success: "✅"
        }[entry.status] || "🧭";
        return [
          `${decorateLogs ? `${entryIcon} ` : ""}[${entry.label}] ${entry.status}`,
          `${decorateLogs ? "🛠 " : ""}$ ${entry.command}`,
          entry.stdout ? `${decorateLogs ? "📤 " : ""}stdout:\n${entry.stdout.trim()}` : "",
          entry.stderr ? `${decorateLogs ? "⚠️ " : ""}stderr:\n${entry.stderr.trim()}` : ""
        ]
          .filter(Boolean)
          .join("\n");
      })
    : [];

  actionLogs.textContent = [
    `${decorateLogs ? `${statusIcon} ` : ""}${action}: ${status}`,
    payload.durationMs ? `${decorateLogs ? "⏱ " : ""}elapsed: ${formatElapsedTime(payload.durationMs)}` : "",
    payload.error ? `error: ${payload.error}` : "",
    ...logEntries
  ]
    .filter(Boolean)
    .join("\n\n");
}

function renderJsonDetails(value) {
  if (!value || (typeof value === "object" && Object.keys(value).length === 0)) {
    return "";
  }
  return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}

function renderInlineMarkdown(text = "") {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderMarkdownTable(lines) {
  const rows = lines
    .filter((line, index) => index !== 1 || !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => renderInlineMarkdown(cell.trim()))
    );
  const [head = [], ...body] = rows;

  return `
    <table>
      <thead><tr>${head.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead>
      <tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;
}

function renderMarkdown(markdown = "") {
  const lines = String(markdown || "").split(/\r?\n/);
  const html = [];
  let listItems = [];
  let tableLines = [];
  let codeLines = [];
  let inCode = false;

  const flushList = () => {
    if (listItems.length) {
      html.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
      listItems = [];
    }
  };
  const flushTable = () => {
    if (tableLines.length) {
      html.push(renderMarkdownTable(tableLines));
      tableLines = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith("```")) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        flushList();
        flushTable();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }
    if (!line.trim()) {
      flushList();
      flushTable();
      continue;
    }
    if (line.includes("|") && /^\|?[^|]+\|/.test(line.trim())) {
      flushList();
      tableLines.push(line);
      continue;
    }
    flushTable();
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = heading[1].length + 3;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      listItems.push(bullet[1]);
      continue;
    }
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      listItems.push(ordered[1]);
      continue;
    }
    if (line.startsWith(">")) {
      flushList();
      html.push(`<blockquote>${renderInlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }
    flushList();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  flushList();
  flushTable();
  if (inCode) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }
  return html.join("");
}

function extractRelevantOutput(payload) {
  if (typeof payload === "string") {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates = [
    payload.output,
    payload.summary,
    payload.result,
    payload.message,
    payload.error ? `Error: ${payload.error}` : ""
  ].filter(Boolean);

  const output = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  if (output) {
    return output.trim();
  }

  if (Array.isArray(payload.rows) && payload.rows.length) {
    return `Returned ${payload.rows.length} rows for review. Open full response for row details.`;
  }

  if (payload.status) {
    return `Run completed with status: ${payload.status}. Open full response for details.`;
  }

  return "Run completed. Open full response for details.";
}

function renderDemoOutput(payload, options = {}) {
  const container = document.getElementById("responses-output");
  if (!container) {
    return;
  }

  const relevantOutput = extractRelevantOutput(payload);
  const jsonPayload = typeof payload === "string" ? { output: payload } : payload || {};
  const showJson = options.view === "json";

  container.innerHTML = `
    <div class="relevant-output markdown-output" ${showJson ? "hidden" : ""}>${renderMarkdown(relevantOutput || "No relevant output returned.")}</div>
    <pre class="relevant-output relevant-json-output" ${showJson ? "" : "hidden"}>${escapeHtml(JSON.stringify(jsonPayload, null, 2))}</pre>`;

  document.querySelectorAll("[data-output-view]").forEach((button) => {
    const isActive = button.dataset.outputView === (showJson ? "json" : "markdown");
    button.setAttribute("aria-pressed", String(isActive));
  });
  document.querySelectorAll("[data-output-view]").forEach((button) => {
    button.onclick = () => renderDemoOutput(payload, { ...options, view: button.dataset.outputView });
  });
}

function showRunNotices(payload) {
  const notice = Array.isArray(payload?.notices) ? payload.notices[0] : null;
  if (notice) {
    showRunNotice(notice);
  }
}

function showRunNotice(notice) {
  const dialog = document.getElementById("run-notice-dialog");
  if (!notice || !dialog) {
    return;
  }

  document.getElementById("run-notice-title").textContent = notice.title || "Run notice";
  document.getElementById("run-notice-message").textContent = notice.message || "The run completed with an operational notice.";
  dialog.showModal();
}

function renderLiveLogs(entries = []) {
  const container = document.getElementById("responses-live-logs");
  if (!container) {
    return;
  }

  const normalizedEntries = entries.length ? entries : [{ label: "idle", message: "No live run yet.", status: "info" }];
  container.innerHTML = normalizedEntries
    .map(
      (entry) => `
        <div class="live-log-line" data-status="${escapeHtml(entry.status || "info")}">
          <span>${escapeHtml(entry.timestamp || "--:--:--")}</span>
          <p>
            <strong>${escapeHtml(entry.label || "log")}</strong>
            <em>${escapeHtml(entry.message || "")}</em>
          </p>
        </div>`
    )
    .join("");
  container.scrollTop = container.scrollHeight;
}

function backendLogEntries(logs = []) {
  return logs.map((entry) => ({
    label: entry.label || "backend",
    status: entry.status || "info",
    timestamp: new Date().toLocaleTimeString(),
    message: `${entry.command ? `${entry.command} ` : ""}${entry.stderr ? `stderr: ${entry.stderr.trim()}` : "completed"}`
  }));
}

function stepStatusLabel(status = "success") {
  return {
    success: "Completed",
    completed: "Completed",
    warning: "Needs review",
    failed: "Failed",
    started: "Running"
  }[status] || status;
}

const defaultTechnicalFlow = [
  {
    icon: "1",
    title: "Request",
    subtitle: "Prompt and model",
    traceId: "request-prepared",
    feature: "The selected OCI demo receives prompt, model, temperature, and feature resource IDs.",
    auth: "No secret is exposed in the browser.",
    interaction: "The request is prepared for the OCI Enterprise AI capability selected by the card."
  },
  {
    icon: "2",
    title: "OCI Auth",
    subtitle: "Project and API key",
    traceId: "runtime-config",
    feature: "OCI Generative AI project, region, and API key availability are resolved.",
    auth: "The API key is read from Terraform-generated runtime state or environment variables and remains server-side.",
    interaction: "The run binds the request to the configured OCI Generative AI project."
  },
  {
    icon: "3",
    title: "OCI AI Feature",
    subtitle: "Capability call",
    traceId: "backend-call",
    feature: "OCI Responses API is called directly or with the selected enterprise AI tool pattern.",
    auth: "The server signs the request with the configured OCI API key.",
    interaction: "The OCI model, tool, or hosted runtime executes the feature-specific operation."
  },
  {
    icon: "4",
    title: "Runtime",
    subtitle: "Tool or deployment",
    traceId: "python-demo",
    feature: "The feature runtime coordinates the OCI call and any supporting resource.",
    auth: "Resource identifiers are passed without exposing credentials to the UI.",
    interaction: "The runtime connects OCI model output with tools, stores, databases, or hosted deployments."
  },
  {
    icon: "5",
    title: "Governed Output",
    subtitle: "Reviewable result",
    traceId: "response-parsed",
    feature: "The result is normalized into concise output for the demo.",
    auth: "Raw responses and logs stay behind explicit disclosure controls.",
    interaction: "The portal displays the relevant answer while retaining traceability."
  }
];

const demoTechnicalFlows = {
  "responses-api": [
    defaultTechnicalFlow[0],
    defaultTechnicalFlow[1],
    {
      ...defaultTechnicalFlow[2],
      title: "Responses API",
      subtitle: "Model invocation",
      feature: "OCI Generative AI Responses API receives the prompt through the OpenAI-compatible endpoint.",
      interaction: "The configured model returns a structured business answer."
    },
    defaultTechnicalFlow[4]
  ],
  "file-search-vector-store-rag": [
    defaultTechnicalFlow[0],
    defaultTechnicalFlow[1],
    {
      ...defaultTechnicalFlow[2],
      title: "File Search",
      subtitle: "Vector Store RAG",
      feature: "OCI Responses API invokes the File Search tool against the configured vector store.",
      auth: "The vector store ID is resolved from Terraform-generated state or the demo input.",
      interaction: "Approved Oracle documents ground the model answer."
    },
    defaultTechnicalFlow[4]
  ],
  "code-interpreter": [
    defaultTechnicalFlow[0],
    defaultTechnicalFlow[1],
    {
      ...defaultTechnicalFlow[2],
      title: "Code Interpreter",
      subtitle: "OCI container",
      feature: "OCI Responses API invokes Code Interpreter for sandboxed Python execution.",
      auth: "The code container is provisioned or selected server-side.",
      interaction: "The model can calculate, inspect data, and return explainable computed results."
    },
    defaultTechnicalFlow[4]
  ],
  "remote-mcp-calling": [
    defaultTechnicalFlow[0],
    defaultTechnicalFlow[1],
    {
      ...defaultTechnicalFlow[2],
      title: "MCP Gateway",
      subtitle: "Tool discovery",
      feature: "OCI Responses API selects from an MCP-compatible enterprise tool registry.",
      auth: "The gateway exposes only approved tool schemas to the model.",
      interaction: "A tool call runs, then the model summarizes the tool result."
    },
    defaultTechnicalFlow[4]
  ],
  "nl2sql-sql-search": [
    defaultTechnicalFlow[0],
    defaultTechnicalFlow[1],
    {
      ...defaultTechnicalFlow[2],
      title: "NL2SQL",
      subtitle: "Database Tools",
      feature: "OCI Responses API generates SELECT-only SQL for an enterprise question.",
      auth: "Database credentials are provisioned through OCI Vault and Database Tools connections.",
      interaction: "Validated SQL runs against Autonomous Database data before summarization."
    },
    defaultTechnicalFlow[4]
  ],
  "hosted-agentic-applications": [
    defaultTechnicalFlow[0],
    {
      ...defaultTechnicalFlow[1],
      title: "Hosted App Auth",
      subtitle: "IDCS inbound auth",
      feature: "OCI Hosted Application uses the configured IDCS domain, audience, and scope.",
      auth: "Inbound auth is configured in OCI; container credentials are not shown in the portal.",
      interaction: "The request maps to a managed hosted agent deployment."
    },
    {
      ...defaultTechnicalFlow[2],
      title: "Hosted Deployment",
      subtitle: "OCIR image",
      feature: "OCI Generative AI Hosted Deployment runs the private OCIR agent image.",
      interaction: "The hosted runtime performs incident-response agent steps and returns a governed answer."
    },
    defaultTechnicalFlow[4]
  ],
  "langgraph-hosted-agent-mcp": [
    defaultTechnicalFlow[0],
    {
      ...defaultTechnicalFlow[1],
      title: "Hosted App Auth",
      subtitle: "IDCS inbound auth",
      feature: "A separate OCI Hosted Application is configured for the LangGraph runtime.",
      auth: "The same IDCS auth pattern protects this separate hosted app deployment.",
      interaction: "Terraform surfaces separate hosted app and deployment metadata for LangGraph."
    },
    {
      ...defaultTechnicalFlow[2],
      title: "LangGraph",
      subtitle: "Graph runtime",
      feature: "The hosted container uses LangGraph to select the next agent step.",
      auth: "Graph execution stays inside the OCI hosted application boundary.",
      interaction: "The graph chooses whether to call knowledge search or workflow status."
    },
    {
      ...defaultTechnicalFlow[3],
      title: "MCP Tool",
      subtitle: "Approved action",
      feature: "The LangGraph step invokes an MCP-style tool from the approved registry.",
      auth: "Only the configured MCP tool contract is exposed to the agent.",
      interaction: "Tool output is folded into the final OCI Responses API answer."
    },
    defaultTechnicalFlow[4]
  ],
  "a2a-agent-collaboration": [
    defaultTechnicalFlow[0],
    {
      ...defaultTechnicalFlow[1],
      title: "Agent Cards",
      subtitle: "A2A discovery",
      feature: "The demo discovers A2A agent cards for the hosted incident and LangGraph agents.",
      auth: "Hosted application metadata and IDCS auth configuration stay server-side.",
      interaction: "The coordinator reads capabilities before assigning tasks."
    },
    {
      ...defaultTechnicalFlow[2],
      title: "A2A Task",
      subtitle: "Agent handoff",
      feature: "A2A-style task messages coordinate the two hosted agents.",
      auth: "Tasks contain scoped prompts and artifacts, not credentials.",
      interaction: "The incident agent produces triage context and the LangGraph agent adds MCP workflow context."
    },
    {
      ...defaultTechnicalFlow[3],
      title: "Coordinator",
      subtitle: "Final artifact",
      feature: "OCI Responses API summarizes the agent-to-agent collaboration plan.",
      auth: "The final model call uses the shared OCI Responses project/API key.",
      interaction: "The response merges both agent artifacts into a customer-safe next action."
    },
    defaultTechnicalFlow[4]
  ],
  "agentic-control-tower": [
    defaultTechnicalFlow[0],
    {
      ...defaultTechnicalFlow[1],
      title: "LlamaIndex",
      subtitle: "Workflow planner",
      feature: "The Python demo uses LlamaIndex workflow steps to plan, execute tools, review evidence, and prepare memory.",
      auth: "The workflow receives only redacted IDCS posture and non-secret runtime values.",
      interaction: "The workflow produces a governed incident plan before model synthesis."
    },
    {
      ...defaultTechnicalFlow[2],
      title: "Tool Review",
      subtitle: "Evidence and approval",
      feature: "Local enterprise tools return incident, policy, metric, approval, and audit artifacts.",
      auth: "Tools are deterministic and constrained to the demo process.",
      interaction: "Evidence sufficiency and approval requirements are checked before final response."
    },
    {
      ...defaultTechnicalFlow[3],
      title: "OCI Synthesis",
      subtitle: "Responses API",
      feature: "OCI Responses API summarizes the workflow when live configuration is present.",
      auth: "The shared project/API key remains server-side.",
      interaction: "The final output combines plan, evidence, approval state, and IDCS posture."
    },
    defaultTechnicalFlow[4]
  ],
  "n8n-hosted-workflow-automation": [
    defaultTechnicalFlow[0],
    {
      ...defaultTechnicalFlow[1],
      title: "Hosted App Auth",
      subtitle: "IDCS inbound auth",
      feature: "OCI Hosted Application protects the n8n deployment with the configured IDCS boundary.",
      auth: "IDCS client secret and n8n password are not exposed in the browser.",
      interaction: "Terraform surfaces only the hosted URL and deployment metadata."
    },
    {
      ...defaultTechnicalFlow[2],
      title: "n8n Runtime",
      subtitle: "Workflow UI",
      feature: "OCI Hosted Deployment runs the real n8n container from private OCIR.",
      auth: "n8n basic auth is injected as hosted application environment variables.",
      interaction: "The portal opens the hosted n8n URL in a new tab for workflow inspection."
    },
    defaultTechnicalFlow[4]
  ],
  "langfuse-hosted-observability": [
    defaultTechnicalFlow[0],
    {
      ...defaultTechnicalFlow[1],
      title: "Hosted App Auth",
      subtitle: "IDCS inbound auth",
      feature: "OCI Hosted Application protects the Langfuse deployment with the configured IDCS boundary.",
      auth: "Langfuse dependency credentials are injected as hosted application environment variables.",
      interaction: "Terraform surfaces only the hosted URL and deployment metadata."
    },
    {
      ...defaultTechnicalFlow[2],
      title: "Langfuse Runtime",
      subtitle: "Observability UI",
      feature: "OCI Hosted Deployment runs the real Langfuse web container from private OCIR.",
      auth: "Postgres, ClickHouse, Redis, and object storage remain external to keep this deployment minimal.",
      interaction: "The portal opens the hosted Langfuse URL in a new tab for trace inspection."
    },
    defaultTechnicalFlow[4]
  ],
  "agentic-rag-planner": [
    defaultTechnicalFlow[0],
    {
      ...defaultTechnicalFlow[1],
      title: "Planning",
      subtitle: "Retrieval strategy",
      feature: "The agent creates retrieval queries and an evidence policy before answer generation.",
      auth: "The shared OCI Generative AI project and API key authorize the model call.",
      interaction: "The agent decides what evidence is needed before producing a grounded answer."
    },
    {
      ...defaultTechnicalFlow[2],
      title: "Evidence",
      subtitle: "Grounding check",
      feature: "OCI Responses API drafts an evidence-aware response plan.",
      auth: "Document and vector resource IDs remain server-side.",
      interaction: "Evidence requirements and gaps are represented before the final answer."
    },
    {
      ...defaultTechnicalFlow[3],
      title: "Answer Plan",
      subtitle: "Grounded output",
      feature: "The response explains how retrieved evidence should shape the final answer.",
      auth: "Approved enterprise knowledge remains the trusted source.",
      interaction: "The output is a grounded answer plan instead of an unsupported response."
    },
    defaultTechnicalFlow[4]
  ],
  "human-approval-agent": [
    defaultTechnicalFlow[0],
    {
      ...defaultTechnicalFlow[1],
      title: "Risk",
      subtitle: "Action classification",
      feature: "The agent classifies whether a proposed action affects customers, operations, or compliance.",
      auth: "The shared OCI authentication path protects the model invocation.",
      interaction: "Customer-impacting requests are marked for approval before action."
    },
    {
      ...defaultTechnicalFlow[2],
      title: "Approval",
      subtitle: "Human checkpoint",
      feature: "Human-in-the-loop control gates the agent action.",
      auth: "Approved tool names and action boundaries are explicit.",
      interaction: "The agent prepares a reviewable proposal instead of executing autonomously."
    },
    {
      ...defaultTechnicalFlow[3],
      title: "Proposal",
      subtitle: "Governed response",
      feature: "OCI Responses API drafts approval-ready next steps.",
      auth: "No operational change is executed without human approval.",
      interaction: "The output is a governed action proposal for review."
    },
    defaultTechnicalFlow[4]
  ],
  "governance-center": [
    defaultTechnicalFlow[0],
    defaultTechnicalFlow[1],
    {
      ...defaultTechnicalFlow[2],
      title: "Governance",
      subtitle: "Policy and audit",
      feature: "Policy checks inspect data sensitivity, approved tool usage, and production readiness.",
      auth: "Sensitive values are redacted before audit output is shown.",
      interaction: "Allowed requests continue to OCI Responses API; blocked requests stop before invocation."
    },
    defaultTechnicalFlow[4]
  ],
  "model-evaluation": [
    defaultTechnicalFlow[0],
    defaultTechnicalFlow[1],
    {
      ...defaultTechnicalFlow[2],
      title: "Evaluation",
      subtitle: "Rubric scoring",
      feature: "OCI Responses API applies a quality and safety rubric to candidate behavior.",
      auth: "Evaluation cases are local controlled inputs; API access stays server-side.",
      interaction: "The result becomes a promotion gate summary."
    },
    defaultTechnicalFlow[4]
  ],
  "multimodal-vision": [
    defaultTechnicalFlow[0],
    defaultTechnicalFlow[1],
    {
      ...defaultTechnicalFlow[2],
      title: "Visual Context",
      subtitle: "Approved asset",
      feature: "OCI Responses API receives structured visual context from an approved manifest.",
      auth: "The demo avoids arbitrary browser uploads and uses curated visual signals.",
      interaction: "Visual evidence is converted into triage insight."
    },
    defaultTechnicalFlow[4]
  ],
  "ai-workflow-orchestration": [
    defaultTechnicalFlow[0],
    defaultTechnicalFlow[1],
    {
      ...defaultTechnicalFlow[2],
      title: "Workflow",
      subtitle: "Tools and approval",
      feature: "OCI Responses API reasons over workflow state, tool handoff, and approval checkpoints.",
      auth: "Actions remain represented as governed workflow steps, not direct external mutations.",
      interaction: "The output records the next audited state."
    },
    defaultTechnicalFlow[4]
  ]
};

function getActiveFeature() {
  return aiFeatures.find((feature) => feature.id === activeDemoId) || aiFeatures[0];
}

function getObservedTraceFields(traceEntry = {}) {
  return traceEntry.details
    ? Object.entries(traceEntry.details)
        .filter(([, value]) => typeof value === "string" || typeof value === "boolean" || typeof value === "number")
        .slice(0, 4)
    : [];
}

function ociFeatureTip(activeDemoId, featureNode) {
  const tips = {
    "responses-api":
      "Use Responses API as the standard OCI Enterprise AI invocation surface for prompts, structured answers, and OpenAI-compatible integration.",
    "file-search-vector-store-rag":
      "Use File Search with Vector Stores when answers must be grounded in approved enterprise documents instead of model knowledge alone.",
    "code-interpreter":
      "Use Code Interpreter when the model needs isolated computation, data analysis, or generated artifacts as part of the answer.",
    "remote-mcp-calling":
      "Use MCP-style tool access to expose approved enterprise tools through a controlled contract that the model can select from.",
    "nl2sql-sql-search":
      "Use NL2SQL with Autonomous Database and Database Tools when business users need governed SQL access without writing SQL manually.",
    "hosted-agentic-applications":
      "Use OCI Hosted Applications to package custom agent runtimes as managed OCI deployments with identity and scaling controls.",
    "langgraph-hosted-agent-mcp":
      "Use a hosted LangGraph agent when agent state, graph steps, and tool selection need to run inside a managed OCI application boundary.",
    "a2a-agent-collaboration":
      "Use A2A-style agent collaboration when specialized OCI-hosted agents need to discover each other, exchange tasks, and return a coordinated result.",
    "agentic-rag-planner":
      "Use agentic RAG planning when the agent must decide what evidence to retrieve and verify before answering.",
    "human-approval-agent":
      "Use human-in-the-loop approval when agent actions can affect customers, operations, or compliance.",
    "governance-center":
      "Use governance controls to apply policy, audit, redaction, and production-readiness checks around enterprise AI usage.",
    "model-evaluation":
      "Use model evaluation to score output quality, safety, and readiness before promoting a prompt or model path.",
    "multimodal-vision":
      "Use multimodal reasoning when visual evidence, screenshots, diagrams, or document images must become structured operational context.",
    "ai-workflow-orchestration":
      "Use workflow orchestration when model output needs to move through tools, approvals, and audited business process steps."
  };

  return tips[activeDemoId] || `Use ${featureNode.title} as the OCI Enterprise AI capability that handles the core model, tool, or hosted-agent interaction for this run.`;
}

function renderArchitectureStep(node, index, traceById) {
  const traceEntry = traceById.get(node.traceId) || {};
  const status = traceEntry.status || "success";

  return `
    <details class="architecture-step">
      <summary>
        <span class="architecture-step-index">${String(index + 1).padStart(2, "0")}</span>
        <span>
          <strong>${escapeHtml(node.title)}</strong>
          <small>${escapeHtml(node.subtitle)}</small>
        </span>
        <em data-status="${escapeHtml(status)}">${escapeHtml(stepStatusLabel(status))}</em>
      </summary>
      <div class="architecture-step-body">
        <p>${escapeHtml(node.interaction)}</p>
      </div>
    </details>`;
}

function renderArchitectureChain(flow) {
  return `
    <ol class="canvas-flow" aria-label="OCI Enterprise AI service flow">
      ${flow.map((node, index) => `
        <li>
          <span>${String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>${escapeHtml(node.title)}</strong>
            <small>${escapeHtml(node.subtitle)}</small>
          </div>
        </li>
      `).join("")}
    </ol>`;
}

function renderTechnicalFlow(trace = []) {
  const traceObjects = trace.map((entry) => (typeof entry === "string" ? { label: entry, status: "success" } : entry || {}));
  const traceById = new Map(traceObjects.filter((entry) => entry.id).map((entry) => [entry.id, entry]));
  const flow = demoTechnicalFlows[activeDemoId] || defaultTechnicalFlow;
  const activeFeature = getActiveFeature();
  const authNode = flow.find((node) => node.title.toLowerCase().includes("auth")) || flow[1] || flow[0];
  const featureNode = flow.find((node) => node.traceId === "backend-call") || flow[Math.min(2, flow.length - 1)];

  return `
    <section class="architecture-canvas" aria-label="OCI Enterprise AI architecture canvas">
      <header class="architecture-canvas-header">
        <div>
          <span>Technical details</span>
          <h4>${escapeHtml(activeFeature.title)}</h4>
          <p>${escapeHtml(featureNode.feature)} ${escapeHtml(authNode.auth)}</p>
        </div>
        <strong>${escapeHtml(activeFeature.serviceArea)}</strong>
      </header>
      <details class="canvas-section">
        <summary>Architecture flow</summary>
        ${renderArchitectureChain(flow)}
      </details>
      <details class="oci-feature-tip">
        <summary>Tip: why this OCI AI feature matters</summary>
        <p>${escapeHtml(ociFeatureTip(activeDemoId, featureNode))}</p>
      </details>
      <details class="canvas-section">
        <summary>Step-by-step OCI flow</summary>
        <div class="architecture-steps" aria-label="Step by step OCI Enterprise AI flow">
        ${flow.map((node, index) => renderArchitectureStep(node, index, traceById)).join("")}
        </div>
      </details>
    </section>`;
}

function renderRunTrace(trace = [], meta = {}) {
  const container = document.getElementById("responses-action-logs");
  if (!container) {
    return;
  }

  if (!trace.length) {
    const status = meta.status === "started" ? "started" : "idle";
    container.innerHTML = `
      <div class="run-trace-summary" data-status="${escapeHtml(status)}">
        <strong>${status === "started" ? "Run started" : "No run yet"}</strong>
        <span>${meta.durationMs ? formatElapsedTime(meta.durationMs) : "Waiting for a demo run"}</span>
      </div>
      ${meta.error ? `<div class="run-trace-error">${escapeHtml(meta.error)}</div>` : ""}`;
    return;
  }

  const status = meta.status || "completed";
  const normalizedStatus = status === "success" ? "completed" : status;
  const fallbackLogs = meta.fallbackLogs || [];

  container.innerHTML = `
    <div class="run-trace-summary" data-status="${escapeHtml(normalizedStatus)}">
      <strong>${escapeHtml(meta.action || "run")}: ${escapeHtml(normalizedStatus)}</strong>
      <span>${meta.durationMs ? formatElapsedTime(meta.durationMs) : ""}</span>
    </div>
    ${meta.error ? `<div class="run-trace-error">${escapeHtml(meta.error)}</div>` : ""}
    ${renderTechnicalFlow(trace)}
    <details class="run-trace-raw">
      <summary>View raw run details</summary>
      ${renderJsonDetails({ trace, logs: fallbackLogs })}
    </details>`;
}

function formatElapsedTime(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return "0 ms";
  }

  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)} ms`;
  }

  const seconds = milliseconds / 1000;
  return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
}

function attachCopyControls() {
  document.querySelectorAll("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = document.getElementById(button.dataset.copyTarget);
      const value = button.dataset.copyValue || target?.textContent?.trim() || "";

      if (!value || value === "-") {
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        button.textContent = "Copied";
      } catch {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(target);
        selection.removeAllRanges();
        selection.addRange(range);
        button.textContent = "Select";
      }

      window.setTimeout(() => {
        button.textContent = "Copy";
      }, 1200);
    });
  });
}

function updateInfraStatus(status) {
  infraState.status = status;
  document.getElementById("infra-summary-status").textContent = status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function renderAllInfrastructureComponents(components = []) {
  const container = document.getElementById("all-infra-components");
  if (!container) {
    return;
  }
  latestInfrastructureComponents = [...components];
  renderInfrastructureTypeFilter(latestInfrastructureComponents);

  if (!components.length) {
    container.innerHTML = `
      <div class="component-row">
        <span class="component-icon" aria-hidden="true">○</span>
        <strong>Provisioned resources</strong>
        <span>Not loaded</span>
        <code>Refresh infrastructure state</code>
        <button class="copy-resource-button" type="button" disabled>Copy</button>
      </div>`;
    return;
  }

  const sortedComponents = [...components].sort((left, right) =>
    String(left.name || left.address || "").localeCompare(String(right.name || right.address || ""), undefined, {
      sensitivity: "base"
    })
  );

  container.innerHTML = sortedComponents.map((component, index) => {
    const status = component.status || "not-created";
    const targetId = `all-infra-component-${index}`;
    const type = inferInfrastructureComponentType(component);
    const searchable = [component.name, component.address, component.value, component.status, type].filter(Boolean).join(" ");
    return `
      <div class="component-row" data-component-type="${escapeHtml(type)}" data-component-search="${escapeHtml(searchable)}">
        <span class="component-icon" data-status="${escapeHtml(status)}" aria-hidden="true">${status === "created" ? "✓" : "○"}</span>
        <strong>${escapeHtml(component.name || component.address || "Infrastructure component")}</strong>
        <span>${escapeHtml(status)}</span>
        <code id="${targetId}" title="${escapeHtml(component.address || "")}">${escapeHtml(component.value || component.address || "-")}</code>
        <button class="copy-resource-button" type="button" data-copy-target="${targetId}">Copy</button>
      </div>`;
  }).join("");
  attachCopyControls();
  attachInfrastructureFilterControls();
  applyInfrastructureComponentFilters();
}

function inferInfrastructureComponentType(component = {}) {
  const value = `${component.name || ""} ${component.address || ""}`.toLowerCase();
  if (/hosted|deployment|application/.test(value)) return "Hosted App";
  if (/ocir|repository|image|artifact/.test(value)) return "Container";
  if (/idcs|identity|dynamic group|policy|api key|vault|secret/.test(value)) return "Security";
  if (/vcn|subnet|gateway|network|nsg/.test(value)) return "Network";
  if (/database|postgres|redis|clickhouse|object storage|bucket|vector store|file/.test(value)) return "Data";
  return "Runtime";
}

function renderInfrastructureTypeFilter(components = []) {
  const typeFilter = document.getElementById("infra-component-type-filter");
  if (!typeFilter) {
    return;
  }
  const selected = typeFilter.value || "all";
  const types = [...new Set(components.map(inferInfrastructureComponentType))].sort((left, right) => left.localeCompare(right));
  typeFilter.innerHTML = [`<option value="all">All types</option>`, ...types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`)].join("");
  typeFilter.value = types.includes(selected) ? selected : "all";
}

function attachInfrastructureFilterControls() {
  const searchInput = document.getElementById("infra-component-search");
  const typeFilter = document.getElementById("infra-component-type-filter");
  [searchInput, typeFilter].forEach((control) => {
    if (!control || control.dataset.filterBound === "true") {
      return;
    }
    control.dataset.filterBound = "true";
    control.addEventListener("input", applyInfrastructureComponentFilters);
    control.addEventListener("change", applyInfrastructureComponentFilters);
  });
}

function applyInfrastructureComponentFilters() {
  const search = String(document.getElementById("infra-component-search")?.value || "").trim().toLowerCase();
  const selectedType = document.getElementById("infra-component-type-filter")?.value || "all";
  document.querySelectorAll("#all-infra-components .component-row").forEach((row) => {
    const matchesSearch = !search || String(row.dataset.componentSearch || "").toLowerCase().includes(search);
    const matchesType = selectedType === "all" || row.dataset.componentType === selectedType;
    row.hidden = !(matchesSearch && matchesType);
  });
}

function applyProvisionedValues(result) {
  const values = result.values || {};
  const config = result.config || {};
  const components = Array.isArray(result.components) ? result.components : [];
  const componentByName = (name) => components.find((component) => component.name === name);
  const projectComponent = componentByName("GenAI Project");
  const suffixComponent = componentByName("Resource Suffix");
  const vectorStoreComponent = componentByName("File Search Vector Store");
  const codeContainerComponent = componentByName("Code Interpreter Container");
  const n8nUrlComponent = componentByName("n8n Hosted URL");
  const n8nDeploymentComponent = componentByName("n8n OCI Hosted Deployment");
  const langfuseUrlComponent = componentByName("Langfuse Hosted URL");
  const langfuseDeploymentComponent = componentByName("Langfuse OCI Hosted Deployment");
  const openclawUrlComponent = componentByName("OpenClaw Hosted URL");
  const openclawDeploymentComponent = componentByName("OpenClaw OCI Hosted Deployment");
  const projectId = values.projectId || config.projectId || infraState.projectId;
  const projectDisplayName = values.projectDisplayName || projectComponent?.value || config.projectDisplayName || infraState.projectDisplayName;

  infraState.projectId = projectId;
  infraState.projectDisplayName = projectDisplayName;
  infraState.resourceSuffix = values.resourceSuffix || suffixComponent?.value || projectDisplayName.split("-").pop() || infraState.resourceSuffix;
  infraState.apiKeyAvailable = Boolean(values.apiKeyAvailable);
  infraState.vectorStoreId = values.vectorStoreId || vectorStoreComponent?.value || infraState.vectorStoreId;
  infraState.codeInterpreterContainerId = values.codeInterpreterContainerId || codeContainerComponent?.value || infraState.codeInterpreterContainerId;
  infraState.n8nHostedUrl = values.n8nHostedUrl || n8nUrlComponent?.value || infraState.n8nHostedUrl;
  infraState.n8nHostedDeploymentId = values.n8nHostedDeploymentId || n8nDeploymentComponent?.value || infraState.n8nHostedDeploymentId;
  infraState.n8nHostedDeploymentStatus = values.n8nHostedDeploymentStatus || n8nDeploymentComponent?.status || infraState.n8nHostedDeploymentStatus;
  infraState.langfuseHostedUrl = values.langfuseHostedUrl || langfuseUrlComponent?.value || infraState.langfuseHostedUrl;
  infraState.langfuseHostedDeploymentId = values.langfuseHostedDeploymentId || langfuseDeploymentComponent?.value || infraState.langfuseHostedDeploymentId;
  infraState.langfuseHostedDeploymentStatus =
    values.langfuseHostedDeploymentStatus || langfuseDeploymentComponent?.status || infraState.langfuseHostedDeploymentStatus;
  infraState.openclawHostedUrl = values.openclawHostedUrl || openclawUrlComponent?.value || infraState.openclawHostedUrl;
  infraState.openclawHostedDeploymentId = values.openclawHostedDeploymentId || openclawDeploymentComponent?.value || infraState.openclawHostedDeploymentId;
  infraState.openclawHostedDeploymentStatus =
    values.openclawHostedDeploymentStatus || openclawDeploymentComponent?.status || infraState.openclawHostedDeploymentStatus;

  document.getElementById("responses-project-id-display").value = projectId;
  renderAllInfrastructureComponents(components);
  updateInfraStatus(result.status || "not-created");
}

function syncDemoInfraFields() {
  document.getElementById("responses-project-id-display").value = infraState.projectId;
}

async function loadResponsesInfrastructureState({ refresh = false } = {}) {
  try {
    const response = await fetch(`/api/features/responses-api/state${refresh ? "?refresh=true" : ""}`);
    const result = await response.json();
    writeActionLogs("state", result, "infra-action-logs");

    if (Array.isArray(result.components) && result.components.length > 0) {
      applyProvisionedValues(result);
      return;
    }

    updateInfraStatus(result.status || "not-created");
  } catch (error) {
    updateInfraStatus("failed");
    document.getElementById("infra-action-logs").textContent = `state: failed\n\nerror: ${error.message}`;
  }
}

function renderFeatureGrid(query = "") {
  const featureGrid = document.getElementById("feature-grid");
  const resultsCount = document.getElementById("results-count");
  const filteredFeatures = filterFeatures(aiFeatures, query);

  featureGrid.innerHTML = filteredFeatures.length
    ? filteredFeatures.map(featureCard).join("")
    : `<div class="empty-state">No demos match "${query}". Try a category like Security, Analytics, or Operations.</div>`;

  resultsCount.textContent = `${filteredFeatures.length} of ${aiFeatures.length} demos shown`;
  attachCardInteractions();
}

renderPortal();
attachCardAppearanceControls();
attachCopyControls();
attachMoreDetailsAccordion();
renderFeatureGrid();
loadResponsesInfrastructureState();

document.getElementById("feature-search").addEventListener("input", (event) => {
  renderFeatureGrid(event.target.value);
});

document.getElementById("infra-refresh-button").addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();

  const button = document.getElementById("infra-refresh-button");
  button.disabled = true;
  button.textContent = "⏳";

  try {
    await loadResponsesInfrastructureState({ refresh: true });
  } finally {
    button.disabled = false;
    button.textContent = "🔄";
  }
});

document.getElementById("responses-minimize-button").addEventListener("click", () => {
  document.getElementById("responses-demo-dialog").classList.toggle("is-minimized");
});

document.getElementById("responses-maximize-button").addEventListener("click", () => {
  document.getElementById("responses-demo-dialog").classList.toggle("is-maximized");
});

document.getElementById("flow-close-button").addEventListener("click", () => {
  document.getElementById("flow-dialog").close();
});

document.getElementById("responses-run-button").addEventListener("click", async () => {
  const runButton = document.getElementById("responses-run-button");
  const actionLogs = document.getElementById("responses-action-logs");
  if (hostedUiLaunchDemoIds.includes(activeDemoId)) {
    launchExternalDemo(activeDemoId);
    return;
  }
  const prompt = document.getElementById("responses-prompt").value;
  const temperature = Number.parseFloat(document.getElementById("responses-temperature").value);
  const model = document.getElementById("responses-model").value.trim() || "openai.gpt-oss-120b";
  const toolResourceId = document.getElementById("responses-tool-resource-id").value.trim();
  const vectorStoreId = activeDemoId === "file-search-vector-store-rag" ? toolResourceId || infraState.vectorStoreId : "";
  const codeInterpreterContainer =
    activeDemoId === "code-interpreter" ? toolResourceId || infraState.codeInterpreterContainerId : "";
  const createNewCodeInterpreterContainer =
    activeDemoId === "code-interpreter" && document.getElementById("responses-code-container-refresh").checked;
  const runStartedAt = performance.now();
  let elapsedTimer = null;
  const runLogStartedAt = new Date().toLocaleTimeString();
  const liveLogs = [
    { label: "Queued", status: "started", timestamp: runLogStartedAt, message: `${activeDemoId} run queued.` },
    { label: "Request", status: "started", timestamp: new Date().toLocaleTimeString(), message: "Request payload prepared for OCI feature execution." }
  ];
  const requestPayload = {
    prompt,
    temperature,
    model,
    sessionId: document.getElementById("responses-session-id").value.trim(),
    vectorStoreId,
    codeInterpreterContainer,
    createNewCodeInterpreterContainer,
    ...getResponsesConfig()
  };

  document.getElementById("responses-request").textContent = JSON.stringify(
    {
      ...requestPayload,
      apiKey: infraState.apiKeyAvailable ? "<from provisioned state>" : ""
    },
    null,
    2
  );
  renderDemoOutput("Running...");
  renderRunTrace([], { status: "started", durationMs: 0 });
  renderLiveLogs(liveLogs);
  elapsedTimer = window.setInterval(() => {
    const durationMs = performance.now() - runStartedAt;
    renderRunTrace([], { status: "started", durationMs });
    renderLiveLogs([
      ...liveLogs,
      { label: "Running", status: "started", timestamp: new Date().toLocaleTimeString(), message: `OCI feature call running for ${formatElapsedTime(durationMs)}.` }
    ]);
  }, 250);
  runButton.disabled = true;
  runButton.textContent = "Running...";

  try {
    const response = await fetch(`/api/features/${activeDemoId}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestPayload)
    });
    const result = await response.json();

    if (!response.ok) {
      const requestError = new Error(result.error || "Demo request failed.");
      requestError.trace = result.trace || [];
      requestError.logs = result.logs || [];
      requestError.durationMs = result.durationMs;
      throw requestError;
    }

    renderDemoOutput(result);
    if (activeDemoId === "code-interpreter" && result.recreatedCodeInterpreterContainer?.id) {
      infraState.codeInterpreterContainerId = result.recreatedCodeInterpreterContainer.id;
      document.getElementById("responses-tool-resource-id").value = result.recreatedCodeInterpreterContainer.id;
    }
    showRunNotices(result);
    renderLiveLogs([
      ...liveLogs,
      ...backendLogEntries(result.logs || []),
      { label: "Completed", status: "success", timestamp: new Date().toLocaleTimeString(), message: `Run completed in ${formatElapsedTime(result.durationMs || performance.now() - runStartedAt)}.` }
    ]);
    writeActionLogs("run", {
      status: result.status || "success",
      durationMs: result.durationMs || performance.now() - runStartedAt,
      trace: result.trace || [],
      logs: result.logs || []
    });
  } catch (error) {
    renderDemoOutput(`Error: ${error.message}`);
    renderLiveLogs([
      ...liveLogs,
      ...backendLogEntries(error.logs || []),
      { label: "Failed", status: "failed", timestamp: new Date().toLocaleTimeString(), message: error.message }
    ]);
    writeActionLogs("run", {
      status: "failed",
      durationMs: error.durationMs || performance.now() - runStartedAt,
      error: error.message,
      trace: error.trace || [],
      logs: error.logs || []
    });
  } finally {
    if (elapsedTimer) {
      window.clearInterval(elapsedTimer);
    }
    runButton.disabled = false;
    runButton.textContent = "Run demo";
  }
});

function launchExternalDemo(featureId) {
  const launchConfigs = {
    "langfuse-hosted-observability": {
      label: "Langfuse Hosted Observability",
      shortLabel: "Langfuse",
      launchUrl: "/auth/sign-in",
      hostedUrl: infraState.langfuseHostedUrl,
      hostedDeploymentId: infraState.langfuseHostedDeploymentId,
      hostedDeploymentStatus: infraState.langfuseHostedDeploymentStatus,
      uiKind: "observability"
    },
    "openclaw-hosted-agent-gateway": {
      label: "OpenClaw Hosted Agent Gateway",
      shortLabel: "OpenClaw",
      launchUrl: "/api/openclaw/launch/",
      hostedUrl: infraState.openclawHostedUrl,
      hostedDeploymentId: infraState.openclawHostedDeploymentId,
      hostedDeploymentStatus: infraState.openclawHostedDeploymentStatus,
      uiKind: "agent gateway"
    }
  };
  const config = launchConfigs[featureId];
  if (!config) {
    return;
  }

  const requestedAt = new Date().toLocaleTimeString();
  const requestPayload = {
    action: "launch-hosted-url",
    launchUrl: config.launchUrl,
    hostedUrl: config.hostedUrl,
    hostedDeploymentId: config.hostedDeploymentId
  };
  document.getElementById("responses-request").textContent = JSON.stringify(requestPayload, null, 2);

  if (!config.hostedUrl) {
    renderDemoOutput(`Provision hosted application infrastructure and refresh Resources before launching ${config.shortLabel}.`);
    renderLiveLogs([
      { label: "Launch", status: "failed", timestamp: requestedAt, message: `${config.shortLabel} hosted URL is not available.` }
    ]);
    renderRunTrace(
      [
        { label: `Resolve ${config.shortLabel} hosted URL`, status: "failed" },
        { label: `Open hosted ${config.uiKind} UI`, status: "blocked" }
      ],
      {
        status: "failed",
        action: "launch",
        error: `${config.shortLabel} hosted URL is not available.`
      }
    );
    showRunNotice({
      title: `Provision ${config.shortLabel} first`,
      message: `Provision hosted application infrastructure and refresh Resources before opening the ${config.shortLabel} hosted deployment.`
    });
    return;
  }

  if (config.hostedDeploymentStatus && config.hostedDeploymentStatus !== "created") {
    const statusLabel = config.hostedDeploymentStatus.replaceAll("-", " ");
    renderDemoOutput(
      `Hosted deployment is not active for ${config.shortLabel}. Current status: ${statusLabel}. Refresh Resources and redeploy before launching.`
    );
    renderLiveLogs([
      { label: "Launch", status: "failed", timestamp: requestedAt, message: `${config.shortLabel} hosted deployment status is ${statusLabel}.` }
    ]);
    renderRunTrace(
      [
        { label: `Resolve ${config.shortLabel} hosted URL`, status: "success" },
        { label: `Verify hosted deployment is active`, status: "failed" },
        { label: `Open hosted ${config.uiKind} UI`, status: "blocked" }
      ],
      {
        status: "failed",
        action: "launch",
        error: `Hosted deployment is not active: ${statusLabel}`
      }
    );
    showRunNotice({
      title: `${config.shortLabel} deployment is not active`,
      message: `Hosted deployment is not active for ${config.shortLabel}. Current status: ${statusLabel}. Refresh Resources and redeploy before launching.`
    });
    return;
  }

  window.open(config.launchUrl, "_blank", "noopener,noreferrer");
  renderDemoOutput({
    status: "success",
    feature: config.label,
    mode: "hosted-ui-launch",
    relevantOutput: `Opened ${config.shortLabel} through local IDCS-authenticated launch proxy: ${config.launchUrl}`,
    launchUrl: config.launchUrl,
    hostedUrl: config.hostedUrl,
    hostedDeploymentId: config.hostedDeploymentId
  });
  renderLiveLogs([
    { label: "Launch", status: "started", timestamp: requestedAt, message: `Opening ${config.shortLabel} in a new tab.` },
    { label: "Completed", status: "success", timestamp: new Date().toLocaleTimeString(), message: `${config.shortLabel} launch request completed.` }
  ]);
  renderRunTrace(
    [
      { label: `Resolved ${config.shortLabel} hosted URL`, status: "success" },
      { label: `Opened hosted ${config.uiKind} UI`, status: "success" }
    ],
    {
      status: "success",
      action: "launch",
      durationMs: 0
    }
  );
}
