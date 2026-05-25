import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const demos = [
  {
    script: "backend/demos/multi_model_routing.py",
    feature: "Multi-Model Routing",
    mode: "multi-model-routing",
    prompt: "Create a response plan for checkout delays.",
    trace: "Loaded routing policy"
  },
  {
    script: "backend/demos/hosted_agentic_applications.py",
    feature: "Hosted Agentic Applications",
    mode: "hosted-agentic-applications",
    prompt: "Invoke the incident-response agent.",
    trace: "Prepared hosted agent runtime manifest"
  },
  {
    script: "backend/demos/langgraph_hosted_agent_mcp.py",
    feature: "LangGraph Hosted Agent + MCP",
    mode: "langgraph-hosted-agent-mcp",
    prompt: "Use the LangGraph agent to inspect checkout delays.",
    trace: "Prepared LangGraph hosted application metadata"
  },
  {
    script: "backend/demos/a2a_agent_collaboration.py",
    feature: "Agent2Agent Collaboration",
    mode: "a2a-agent-collaboration",
    prompt: "Coordinate incident and LangGraph agents for checkout delays.",
    trace: "Discovered A2A agent cards"
  },
  {
    script: "backend/demos/agentic_control_tower.py",
    feature: "Agentic Control Tower",
    mode: "agentic-control-tower",
    prompt: "Coordinate checkout delay triage with evidence, approval, and audit.",
    trace: "Loaded LlamaIndex agentic control tower workflow"
  },
  {
    script: "backend/demos/agentic_rag_planner.py",
    feature: "Agentic RAG Planner",
    mode: "agentic-rag-planner",
    prompt: "Plan a grounded answer for checkout delays.",
    trace: "Prepared agentic RAG retrieval plan"
  },
  {
    script: "backend/demos/human_approval_agent.py",
    feature: "Human-in-the-Loop Agent Approval",
    mode: "human-approval-agent",
    prompt: "Prepare a refund action for checkout delays.",
    trace: "Classified agent action risk"
  },
  {
    script: "backend/demos/governance_center.py",
    feature: "Governance Center",
    mode: "governance-center",
    prompt: "Review this workload for production readiness.",
    trace: "Loaded governance policy pack"
  },
  {
    script: "backend/demos/document_understanding_genai.py",
    feature: "Document Understanding + GenAI",
    mode: "document-understanding-genai",
    prompt: "Summarize the bundled Oracle PDFs.",
    trace: "Loaded bundled Oracle PDF document metadata"
  },
  {
    script: "backend/demos/batch_inference.py",
    feature: "Batch Inference",
    mode: "batch-inference",
    prompt: "Summarize recent support ticket notes in batch.",
    trace: "Prepared batch inference job manifest"
  },
  {
    script: "backend/demos/model_evaluation.py",
    feature: "Model Evaluation",
    mode: "model-evaluation",
    prompt: "Evaluate support answer quality for production readiness.",
    trace: "Loaded model evaluation rubric"
  },
  {
    script: "backend/demos/multimodal_vision.py",
    feature: "Multimodal Vision",
    mode: "multimodal-vision",
    prompt: "Inspect this incident screenshot description.",
    trace: "Prepared multimodal vision asset manifest"
  },
  {
    script: "backend/demos/ai_workflow_orchestration.py",
    feature: "AI Workflow Orchestration",
    mode: "ai-workflow-orchestration",
    prompt: "Route this checkout incident through approval.",
    trace: "Loaded AI workflow orchestration plan"
  }
];

test("final four python demos return structured output when OCI config is missing", () => {
  for (const demo of demos) {
    const result = spawnSync(
      "python3",
      [demo.script],
      {
        input: JSON.stringify({
          prompt: demo.prompt,
          model: "openai.gpt-oss-120b"
        }),
        encoding: "utf8",
        env: {
          ...process.env,
          OCI_GENAI_API_KEY: "",
          OCI_GENAI_PROJECT_ID: ""
        }
      }
    );

    assert.equal(result.status, 1, demo.script);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.feature, demo.feature);
    assert.equal(payload.mode, demo.mode);
    assert.equal(payload.request.model, "openai.gpt-oss-120b");
    assert.ok(payload.error.includes("OCI_GENAI_API_KEY"));
    assert.ok(!payload.output);
    assert.ok(Array.isArray(payload.trace));
    assert.ok(payload.trace.includes(demo.trace));
  }
});
