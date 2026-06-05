export const aiFeatures = [
  {
    id: "responses-api",
    title: "Responses API",
    serviceArea: "OCI Generative AI",
    summary: "Unified model invocation for prompts, streaming responses, structured output, and app integration.",
    details:
      "Runs a live OCI Responses API request through the OpenAI-compatible OCI endpoint. The backend uses the OCI Generative AI project, API key, and supported Responses model configured by Terraform outputs and environment variables.",
    provisioningDetails:
      "Provision the OCI Generative AI project and API key through Terraform at infra/responses-api, then export OCI_GENAI_PROJECT_ID, OCI_GENAI_API_KEY, and OCI_GENAI_REGION before running this demo.",
    status: "Live API",
    accent: "blue",
    terraformPath: "infra/responses-api",
    sdkModule: "backend/demos/responses_api.py",
    sampleUseCase: "Summarize a support note or draft an executive update.",
    demoHref: "#demo-responses-api",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/responses-api.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Live OCI Responses API call", "OpenAI-compatible endpoint", "JSON response inspection"]
  },
  {
    id: "conversation-store",
    title: "Conversation Store",
    serviceArea: "OCI App Layer",
    summary: "Persist multi-turn chat history so sessions can resume with controlled enterprise context.",
    details:
      "Runs a live OCI Responses API call with OCI Conversations API state. Terraform can create a reusable conversation object, and each run sends the conversation ID so OCI manages session memory across turns.",
    provisioningDetails:
      "Provision the shared OCI Generative AI project/API key and the conversation-store Terraform module. Startup exports the generated conversation ID as OCI_GENAI_CONVERSATION_ID, and the workbench can create a conversation lazily when one is not supplied.",
    status: "Live API",
    accent: "green",
    terraformPath: "infra/conversation-store",
    sdkModule: "backend/demos/conversation_store.py",
    sampleUseCase: "Continue an employee assistant or support troubleshooting session.",
    demoHref: "#demo-conversation-store",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/responses-api.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["OCI conversation object", "Context replay", "Live OCI Responses API call"]
  },
  {
    id: "guardrails",
    title: "Guardrails",
    serviceArea: "Enterprise AI Governance",
    summary: "Apply policy checks for prompt injection, PII handling, unsafe content, and response controls.",
    details:
      "Runs a policy gate before model invocation. Prompt-injection and secret-exfiltration attempts are blocked; email, phone, and SSN patterns are redacted before safe prompts are sent to OCI Responses API.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key provisioned by Terraform. Policy checks are executed in the backend before the live model call.",
    status: "Live Guardrail",
    accent: "red",
    terraformPath: "infra/guardrails",
    sdkModule: "backend/demos/guardrails.py",
    sampleUseCase: "Detect sensitive HR or customer data requests before generating an answer.",
    demoHref: "#demo-guardrails",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/overview.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["PII redaction", "Prompt-injection blocking", "Live sanitized model call"]
  },
  {
    id: "file-search-vector-store-rag",
    title: "File Search & Vector Store RAG",
    serviceArea: "OCI Generative AI Agents",
    summary: "Ground answers in uploaded enterprise documents through managed file search and vector stores.",
    details:
      "Runs a live OCI Responses API request with the File Search tool enabled. The demo requires a configured OCI vector store ID and asks the model to ground its response in indexed enterprise documents.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key. The vector store is provisioned by default through Resource Manager and startup paths, bundled Oracle PDFs are seeded, and OCI_GENAI_VECTOR_STORE_ID is exported before running.",
    status: "Live Tool",
    accent: "teal",
    terraformPath: "infra/file-search-vector-store-rag",
    sdkModule: "backend/demos/file_search_vector_store_rag.py",
    sampleUseCase: "Ask questions over policy, support, or product documents with cited source snippets.",
    demoHref: "#demo-file-search-vector-store-rag",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/file-search.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["File ingestion", "Vector retrieval", "Grounded answers"]
  },
  {
    id: "code-interpreter",
    title: "Code Interpreter",
    serviceArea: "OCI Generative AI Agents",
    summary: "Run sandboxed Python for data analysis, calculations, and generated artifacts.",
    details:
      "Runs a live OCI Responses API request with the Code Interpreter tool enabled. The model can use a sandboxed Python runtime to perform calculations, data analysis, or file processing.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key provisioned by Terraform. Leave the container field blank for an OCI-managed auto container, or provide an existing container ID.",
    status: "Live Tool",
    accent: "amber",
    terraformPath: "infra/code-interpreter",
    sdkModule: "backend/demos/code_interpreter.py",
    sampleUseCase: "Analyze a CSV of support incidents and produce a concise trend summary.",
    demoHref: "#demo-code-interpreter",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/code-interpreter.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Sandboxed Python", "Data analysis", "Generated artifacts"]
  },
  {
    id: "function-calling",
    title: "Function Calling",
    serviceArea: "OCI App Layer",
    summary: "Let the model request controlled application actions through typed local tools.",
    details:
      "Runs a live OCI Responses API request with function schemas, executes the selected approved backend function locally, and calls the model again with the tool result.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key provisioned by Terraform. The demo tools are governed backend functions with explicit schemas and constrained data access.",
    status: "Live Tool",
    accent: "green",
    terraformPath: "infra/function-calling",
    sdkModule: "backend/demos/function_calling.py",
    sampleUseCase: "Look up an order, create a service ticket, or check entitlement from a governed tool list.",
    demoHref: "#demo-function-calling",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/building-agents.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Typed tool schemas", "App-side execution", "Tool result handoff"]
  },
  {
    id: "remote-mcp-calling",
    title: "Remote MCP Calling",
    serviceArea: "OCI Generative AI Agents",
    summary: "Connect agent workflows to remote MCP servers for reusable enterprise tools.",
    details:
      "Runs a live OCI Responses API request with an MCP-compatible gateway shape, including tool discovery, JSON-RPC style invocation, and result handoff.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key provisioned by Terraform. The MCP gateway exposes a fixed enterprise tool contract for this live demo.",
    status: "Live API",
    accent: "violet",
    terraformPath: "infra/remote-mcp-calling",
    sdkModule: "backend/demos/remote_mcp_calling.py",
    sampleUseCase: "Ask an agent to query an internal knowledge tool or workflow API exposed through MCP.",
    demoHref: "#demo-remote-mcp-calling",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/building-agents.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["MCP tool discovery", "Remote tool calls", "Invocation trace"]
  },
  {
    id: "nl2sql-sql-search",
    title: "NL2SQL / SQL Search",
    serviceArea: "OCI Generative AI Agents",
    summary: "Translate natural language business questions into validated SQL over enterprise data.",
    details:
      "Runs live model SQL generation, validates the output as SELECT-only SQL, executes it against a bundled sample dataset, and summarizes the rows for a business user.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key and shows the provisioned Autonomous Database and Database Tools connections. The executable dataset is bundled locally for offline startup.",
    status: "Live Demo",
    accent: "blue",
    terraformPath: "infra/nl2sql-sql-search",
    sdkModule: "backend/demos/nl2sql_sql_search.py",
    sampleUseCase: "Ask for revenue, inventory, or support metrics without writing SQL manually.",
    demoHref: "#demo-nl2sql-sql-search",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/building-agents.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Semantic enrichment", "SQL generation", "Permissioned data access"]
  },
  {
    id: "long-term-memory",
    title: "Long-Term Memory",
    serviceArea: "OCI App Layer",
    summary: "Persist durable user or customer context across separate conversations.",
    details:
      "Runs live model extraction over each user turn, persists durable subject-scoped memory locally, retrieves it on later runs, and answers with the remembered context.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key provisioned by Terraform. Memory is stored in a durable subject-scoped store for the portal run.",
    status: "Live Demo",
    accent: "teal",
    terraformPath: "infra/long-term-memory",
    sdkModule: "backend/demos/long_term_memory.py",
    sampleUseCase: "Remember communication preferences or account context across support sessions.",
    demoHref: "#demo-long-term-memory",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/building-agents.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Subject-scoped memory", "Durable context", "Retention controls"]
  },
  {
    id: "multi-model-routing",
    title: "Multi-Model Routing",
    serviceArea: "OCI Generative AI",
    summary: "Compare and route requests across available enterprise models by task, latency, and cost.",
    details:
      "Runs live OCI route candidates with different response policies, records elapsed time and route scores, then selects the best answer for the workload.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key provisioned by Terraform. The router evaluates policy routes on the configured model and records route metadata.",
    status: "Live Demo",
    accent: "amber",
    terraformPath: "infra/multi-model-routing",
    sdkModule: "backend/demos/multi_model_routing.py",
    sampleUseCase: "Compare summarization quality across fast, reasoning, and coding-oriented models.",
    demoHref: "#demo-multi-model-routing",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/overview.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Model comparison", "Routing metadata", "Latency tracking"]
  },
  {
    id: "hosted-agentic-applications",
    title: "Hosted Agentic Applications",
    serviceArea: "OCI Generative AI Agents",
    summary: "Package custom agent runtimes for managed deployment with endpoints and identity controls.",
    details:
      "Runs a local hosted-agent runtime manifest, executes deployment-style steps, and uses OCI Responses API to produce an invocation result with health and actions.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key plus hosted application metadata generated by Terraform.",
    status: "Live Demo",
    accent: "red",
    terraformPath: "infra/hosted-agentic-applications",
    sdkModule: "backend/demos/hosted_agentic_applications.py",
    sampleUseCase: "Deploy a custom incident-response agent as a managed enterprise endpoint.",
    demoHref: "#demo-hosted-agentic-applications",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/overview.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Managed deployment", "Private endpoints", "Runtime health"]
  },
  {
    id: "langgraph-hosted-agent-mcp",
    title: "LangGraph Hosted Agent + MCP",
    serviceArea: "OCI Generative AI Agents",
    summary: "Deploy a separate LangGraph agent as an OCI hosted application and route tool work through an MCP-style gateway.",
    details:
      "Runs a live OCI Responses API request over generated metadata for a separate LangGraph hosted application. The hosted container source uses LangGraph to select an MCP tool, call the tool, and draft a governed agent response.",
    provisioningDetails:
      "Uses the hosted-agentic-applications Terraform module to create an additional OCIR repository, hosted application, and hosted deployment for the LangGraph runtime.",
    status: "Live Hosted App",
    accent: "violet",
    terraformPath: "infra/hosted-agentic-applications",
    sdkModule: "backend/demos/langgraph_hosted_agent_mcp.py",
    sampleUseCase: "Run an incident agent that selects an MCP knowledge or workflow tool before drafting a response.",
    demoHref: "#demo-langgraph-hosted-agent-mcp",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/overview.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Separate hosted app", "LangGraph runtime", "MCP tool path"]
  },
  {
    id: "a2a-agent-collaboration",
    title: "Agent2Agent Collaboration",
    serviceArea: "OCI Generative AI Agents",
    summary: "Coordinate two hosted agents through A2A-style discovery, task exchange, and handoff.",
    details:
      "Runs an A2A collaboration plan across the hosted incident-response agent and the hosted LangGraph MCP agent. The demo discovers agent cards, creates task messages, records handoff, and uses OCI Responses API to summarize the coordinated outcome.",
    provisioningDetails:
      "Reuses the hosted-agentic-applications Terraform module. The existing hosted agent and LangGraph hosted application supply the A2A-capable agent endpoints and metadata.",
    status: "Live A2A",
    accent: "teal",
    terraformPath: "infra/hosted-agentic-applications",
    sdkModule: "backend/demos/a2a_agent_collaboration.py",
    sampleUseCase: "Coordinate incident triage and workflow lookup between two specialized agents.",
    demoHref: "#demo-a2a-agent-collaboration",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/overview.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Agent cards", "Task handoff", "Hosted agent reuse"]
  },
  {
    id: "langfuse-hosted-observability",
    title: "Langfuse Hosted Observability",
    serviceArea: "OCI Generative AI Agents",
    summary: "Deploy Langfuse observability with managed OCI dependencies and a hosted UI.",
    details:
      "Launches a separate Langfuse web container through OCI Generative AI Hosted Applications with managed OCI PostgreSQL, ClickHouse, Redis, and Object Storage wired through private networking.",
    provisioningDetails:
      "Reuses the hosted-agentic-applications Terraform module to create private networking, managed dependencies, a separate OCIR image, hosted application, hosted deployment, and generated runtime URL metadata for Langfuse.",
    status: "Live Hosted UI",
    accent: "blue",
    terraformPath: "infra/hosted-agentic-applications",
    sdkModule: "apps/hosted-langfuse/Dockerfile",
    sampleUseCase: "Open a hosted Langfuse console to inspect LLM traces, prompts, scores, and evaluation telemetry.",
    demoHref: "#demo-langfuse-hosted-observability",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/overview.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Real Langfuse UI", "Managed OCI dependencies", "Separate hosted deployment"]
  },
  {
    id: "openclaw-hosted-agent-gateway",
    title: "OpenClaw Hosted Agent Gateway",
    serviceArea: "OCI Generative AI Agents",
    summary: "Host OpenClaw's agent gateway and Control UI as an OCI hosted application.",
    details:
      "Launches an OpenClaw gateway container through OCI Generative AI Hosted Applications. The portal opens the hosted Control UI through the same IDCS-authenticated launch boundary used by hosted UI demos.",
    provisioningDetails:
      "Reuses the hosted-agentic-applications Terraform module to create a private OCIR image, OCI hosted application, hosted deployment, generated runtime URL metadata, and OpenClaw Control UI token configuration.",
    status: "Live Hosted UI",
    accent: "violet",
    terraformPath: "infra/hosted-agentic-applications",
    sdkModule: "apps/hosted-openclaw/Dockerfile",
    sampleUseCase: "Open a hosted OpenClaw Control UI for inspecting an agent gateway and constrained tool runtime.",
    demoHref: "#demo-openclaw-hosted-agent-gateway",
    docsHref: "https://docs.openclaw.ai/install/docker",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["OpenClaw Control UI", "Hosted gateway URL", "Constrained agent runtime"]
  },
  {
    id: "agentic-control-tower",
    title: "Agentic Control Tower",
    serviceArea: "OCI Generative AI Agents",
    summary: "Run a hosted LlamaIndex control workflow that plans tools, reviews evidence, gates approval, and reports IDCS posture.",
    details:
      "Runs a real LlamaIndex workflow in an OCI Generative AI Hosted Application with deterministic enterprise tools, evidence review, approval gating, memory note generation, and hosted runtime output. The portal calls the hosted app through the server-side IDCS proxy without exposing secrets.",
    provisioningDetails:
      "Uses the hosted-agentic-applications Terraform module to create an OCIR image, OCI hosted application, hosted deployment, and generated runtime metadata. The launch path reuses the Terraform-generated IDCS launch client metadata.",
    status: "Live Hosted OSS Agent",
    accent: "green",
    terraformPath: "infra/hosted-agentic-applications",
    sdkModule: "backend/demos/agentic_control_tower.py",
    sampleUseCase: "Coordinate incident triage across planning, tools, evidence review, approval, audit, and final response.",
    demoHref: "#demo-agentic-control-tower",
    docsHref: "https://docs.llamaindex.ai/en/stable/module_guides/workflow/",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Hosted LlamaIndex runtime", "Tool critique loop", "IDCS proxy launch"]
  },
  {
    id: "agentic-rag-planner",
    title: "Agentic RAG Planner",
    serviceArea: "OCI Generative AI Agents",
    summary: "Plan retrieval, evidence checks, and grounded answers before invoking enterprise RAG.",
    details:
      "Runs a live OCI Responses API call that builds an agentic RAG plan. The demo shows how an agent decides retrieval queries, evaluates evidence sufficiency, and prepares a grounded response policy before final answer generation.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key. It complements the File Search and Vector Store demo without requiring additional infrastructure.",
    status: "Live Agent",
    accent: "blue",
    terraformPath: "infra/responses-api",
    sdkModule: "backend/demos/agentic_rag_planner.py",
    sampleUseCase: "Plan a document-grounded answer for support, policy, or product knowledge questions.",
    demoHref: "#demo-agentic-rag-planner",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/building-agents.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Retrieval planning", "Evidence checks", "Grounded answer policy"]
  },
  {
    id: "locus-sdk-agentic-workflows",
    title: "Locus SDK Agentic Workflows",
    serviceArea: "OCI Generative AI Agents",
    summary: "Explore Oracle's Locus SDK patterns for agent loops, tools, memory, orchestration, streaming, and production controls.",
    details:
      "Runs a guided Locus SDK workflow plan based on the public Locus documentation: agent loop, tool execution, MCP-ready tools, conversation and long-term memory, orchestrator or swarm composition, checkpointing, streaming events, and OCI Responses model providers.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key for the live synthesis step. The demo is a portal-side SDK exploration pattern and does not create additional OCI infrastructure.",
    status: "Live SDK Explorer",
    accent: "violet",
    terraformPath: "infra/responses-api",
    sdkModule: "backend/demos/locus_sdk_agentic_workflows.py",
    sampleUseCase: "Design a production incident agent that uses tools, remembers account context, streams progress, and resumes from checkpoints.",
    demoHref: "#demo-locus-sdk-agentic-workflows",
    docsHref: "https://locusagents.oracle.com/",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Locus agent loop", "Tools and MCP", "Memory and checkpoints"]
  },
  {
    id: "human-approval-agent",
    title: "Human-in-the-Loop Agent Approval",
    serviceArea: "Enterprise AI Governance",
    summary: "Gate agent actions with risk classification and human approval checkpoints.",
    details:
      "Runs a live OCI Responses API call over an approval plan. The demo classifies action risk, identifies whether approval is required, and prepares a governed action proposal for human review.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key. No additional Terraform is required because the demo focuses on the approval pattern around agent actions.",
    status: "Live Agent",
    accent: "red",
    terraformPath: "infra/responses-api",
    sdkModule: "backend/demos/human_approval_agent.py",
    sampleUseCase: "Require review before an agent drafts customer-impacting actions or operational changes.",
    demoHref: "#demo-human-approval-agent",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/building-agents.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Risk classification", "Approval checkpoint", "Governed action proposal"]
  },
  {
    id: "governance-center",
    title: "Governance Center",
    serviceArea: "Enterprise AI Governance",
    summary: "Show IAM, private networking, API keys, OAuth, guardrails, audit, and retention controls in one view.",
    details:
      "Runs local governance policy controls, redacts sensitive values, persists an audit event, blocks high-risk requests, and summarizes allowed decisions with OCI Responses API.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key and local audit storage. The infrastructure pane already shows shared IAM and runtime resources used by the governed demos.",
    status: "Live Demo",
    accent: "red",
    terraformPath: "infra/governance-center",
    sdkModule: "backend/demos/governance_center.py",
    sampleUseCase: "Review whether an AI workload is ready for production governance approval.",
    demoHref: "#demo-governance-center",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/overview.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Access controls", "Network posture", "Audit readiness"]
  },
  {
    id: "document-understanding-genai",
    title: "Document Understanding + GenAI",
    serviceArea: "OCI App Layer",
    summary: "Extract document fields, summarize findings, and hand off structured context to a model workflow.",
    details:
      "Reads bundled Oracle PDFs, extracts document metadata and curated document signals, then uses OCI Responses API to produce a document-grounded summary.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key and the local PDF assets already bundled for vector-store seeding. OCI Document Understanding can replace the local extractor later.",
    status: "Live Demo",
    accent: "blue",
    terraformPath: "infra/document-understanding-genai",
    sdkModule: "backend/demos/document_understanding_genai.py",
    sampleUseCase: "Extract invoice fields and generate a finance approval summary.",
    demoHref: "#demo-document-understanding-genai",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/document-understanding/home.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Field extraction", "Document summary", "Structured handoff"]
  },
  {
    id: "batch-inference",
    title: "Batch Inference",
    serviceArea: "OCI Generative AI",
    summary: "Process large prompt sets asynchronously for offline summarization, classification, and enrichment jobs.",
    details:
      "Runs a batch-style request over a sample manifest, attaches input records, submits a governed processing prompt, and collects generated outputs for downstream review.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key plus a local batch manifest and review target for this live portal run.",
    status: "Live Demo",
    accent: "amber",
    terraformPath: "infra/batch-inference",
    sdkModule: "backend/demos/batch_inference.py",
    sampleUseCase: "Summarize thousands of support tickets overnight and load the outputs into an operations dashboard.",
    demoHref: "#demo-batch-inference",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/overview.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Async processing", "Bulk prompt jobs", "Output review"]
  },
  {
    id: "model-evaluation",
    title: "Model Evaluation",
    serviceArea: "Enterprise AI Governance",
    summary: "Score model outputs with quality, safety, latency, and business-readiness checks before promotion.",
    details:
      "Runs an evaluation workflow with a curated prompt set, expected rubric, scored candidate answers, and promotion gates for production workloads.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key, local evaluation cases, and governance thresholds stored with the workload configuration.",
    status: "Live Demo",
    accent: "red",
    terraformPath: "infra/model-evaluation",
    sdkModule: "backend/demos/model_evaluation.py",
    sampleUseCase: "Compare candidate support-answer prompts before approving a new production assistant configuration.",
    demoHref: "#demo-model-evaluation",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/overview.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Quality scoring", "Safety checks", "Promotion gates"]
  },
  {
    id: "multimodal-vision",
    title: "Multimodal Vision",
    serviceArea: "OCI Generative AI",
    summary: "Combine image or document visual context with text prompts for inspection and explanation workflows.",
    details:
      "Runs a multimodal request pattern where an approved visual asset manifest is inspected, summarized, and converted into structured operational context.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key and an approved visual asset manifest staged through the portal.",
    status: "Live Demo",
    accent: "blue",
    terraformPath: "infra/multimodal-vision",
    sdkModule: "backend/demos/multimodal_vision.py",
    sampleUseCase: "Inspect a screenshot, architecture diagram, or incident image and generate a triage summary.",
    demoHref: "#demo-multimodal-vision",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/overview.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Visual context", "Structured extraction", "Model explanation"]
  },
  {
    id: "ai-workflow-orchestration",
    title: "AI Workflow Orchestration",
    serviceArea: "OCI App Layer",
    summary: "Coordinate prompts, tools, approvals, retries, and human review across a repeatable enterprise workflow.",
    details:
      "Runs a workflow layer that chains model calls, policy gates, tool execution, approvals, and audit records into a durable business process.",
    provisioningDetails:
      "Uses the shared OCI Generative AI project/API key with a local workflow manifest that captures tools, approvals, and audit handoff.",
    status: "Live Demo",
    accent: "green",
    terraformPath: "infra/ai-workflow-orchestration",
    sdkModule: "backend/demos/ai_workflow_orchestration.py",
    sampleUseCase: "Route an incident summary through model analysis, tool lookup, manager approval, and ticket update.",
    demoHref: "#demo-ai-workflow-orchestration",
    docsHref: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/overview.htm",
    actions: ["Provision Infra", "Run Demo", "Delete Infra"],
    capabilities: ["Workflow chaining", "Human approval", "Audit trail"]
  }
];
