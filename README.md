# Enterprise AI Demo Portal

Runnable OCI Enterprise AI demos in one portal: UI cards, Python backends, Terraform-managed OCI resources, runtime metadata, and per-run logs.

[![Deploy to Oracle Cloud](https://oci-resourcemanager-plugin.plugins.oci.oraclecloud.com/latest/deploy-to-oracle-cloud.svg)](https://cloud.oracle.com/resourcemanager/stacks/create?zipUrl=https://github.com/RahulMR42/oci_enterprise_ai_demo/releases/latest/download/enterprise-ai-demo-resource-manager-stack.zip)

Use the button to create the full OCI Resource Manager stack from the latest release package. Set the stack working directory to `infra/resource-manager-demo`. See [docs/deployment/resource-manager-one-click.md](docs/deployment/resource-manager-one-click.md) for required variables, release packaging, and validation steps.

## App Flow

![Enterprise AI portal UI, demo backend, SSO, administration, and OCI service flow](docs/images/portal_flow.png)

The flow covers the hosted UI, local and SSO login, demo execution API, Python demo runner, state fallbacks, OCI calls, and administration endpoints.

## Demo Coverage

| Demo | Runtime | Infrastructure |
| --- | --- | --- |
| Responses API | Direct OCI Responses API call through the OpenAI-compatible endpoint | GenAI project and API key |
| OpenAI-Compatible Chat Completions | Chat Completions request against the OCI OpenAI-compatible endpoint | Shared GenAI project and API key |
| Responses Streaming + Structured Output | Streamed Responses API events with a JSON schema contract | Shared GenAI project and API key |
| Conversation Store | OCI Conversations API state plus OCI Responses API | Shared GenAI project and generated conversation ID |
| Guardrails | Local policy checks plus sanitized OCI call | Shared GenAI project |
| File Search & Vector Store RAG | OCI File Search tool over a provisioned vector store | Vector store and bundled Oracle PDFs |
| Code Interpreter | OCI Code Interpreter tool | Managed code container |
| Function Calling | OCI tool planning plus local typed functions | Shared GenAI project |
| Remote MCP Calling | OCI model plus local MCP-style gateway | Shared GenAI project |
| NL2SQL / SQL Search | OCI SQL generation, SELECT validation, local SQLite execution | ADB and Database Tools resources shown in infra |
| Long-Term Memory | OCI memory extraction plus local durable memory store | Shared GenAI project |
| Multi-Model Routing | OCI route candidates, scoring, and selected answer | Shared GenAI project |
| Hosted Agentic Applications | OCI hosted application and deployment backed by OCIR | OCIR repository, hosted app, hosted deployment |
| LangGraph Hosted Agent + MCP | Hosted LangGraph wrapper and MCP-style tool route | OCIR repository, hosted app, hosted deployment |
| Agent2Agent Collaboration | A2A-style hosted agent discovery, task exchange, and handoff | Hosted agent and LangGraph hosted metadata |
| OpenClaw Hosted Agent Gateway | Hosted OpenClaw gateway demo UI with launch controls | OCIR repository, hosted app, hosted deployment |
| Agentic Control Tower | Hosted LlamaIndex workflow with evidence review and approval gates | OCIR repository, hosted app, hosted deployment, IDCS launch client |
| Agentic RAG Planner | Retrieval planning and evidence sufficiency checks before answer generation | Shared GenAI project |
| Locus SDK Agentic Workflows | Locus SDK agent/tool pattern synthesis through OCI Responses | Shared GenAI project |
| Human-in-the-Loop Agent Approval | Risk classification and approval checkpoint planning | Shared GenAI project |
| Governance Center | Local policy controls, audit event, and OCI reviewer summary | Shared GenAI project and shared IAM visibility |
| Document Understanding + GenAI | Bundled PDF metadata/signals plus OCI document summary | Bundled Oracle PDFs |
| Batch Inference | Batch-style prompt manifest processing and output review | Shared GenAI project and local batch manifest |
| Model Evaluation | Rubric-based output scoring and promotion gate summary | Shared GenAI project and local evaluation cases |
| Multimodal Vision | Visual asset inspection and structured triage summary | Shared GenAI project and approved visual manifest |
| AI Workflow Orchestration | Chained model, tool, approval, retry, and audit workflow | Shared GenAI project and local workflow manifest |

## Local Setup

Install once:

```bash
npm install
python3 -m venv env
env/bin/python -m pip install -r requirements.txt
```

Start without inherited proxy settings:

```bash
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u no_proxy -u NO_PROXY \
  PORT=5173 \
  ./bash.sh
```

Open `http://localhost:5173`.

Login user: `oci`. The password is generated in `.oci-portal-password` unless `OCI_PORTAL_PASSWORD` or `OCI_PORTAL_PASSWORD_FILE` is set.

## Provision Infrastructure

For a local full-stack run, provision shared IAM, the GenAI project/API key, conversation store, vector store, code container, NL2SQL resources, and hosted applications before startup:

```bash
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u no_proxy -u NO_PROXY \
  PROVISION_INFRA=true \
  PROVISION_DEMOS=conversation-store,file-search-vector-store-rag,code-interpreter,nl2sql-sql-search,hosted-agentic-applications \
  PORT=5173 \
  ./bash.sh
```

Common variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OCI_GENAI_COMPARTMENT_ID` | repo default compartment | Target OCI compartment |
| `OCI_GENAI_REGION` | `us-chicago-1` | OCI region |
| `OCI_PROFILE` | `DEFAULT` | OCI CLI profile |
| `RESOURCE_SUFFIX` | generated or existing Terraform output | Stable demo resource suffix |
| `PROVISION_DEMOS` | conversation/vector/code/NL2SQL/hosted modules | Demo modules to apply |
| `REQUIRE_DEMO_INFRA` | `true` | Stop startup when a selected demo module fails |
| `OCI_HOSTED_APP_IDCS_DOMAIN_URL` | unset | Existing identity domain URL for hosted app inbound auth |
| `OCI_HOSTED_APP_IDCS_AUDIENCE` | unset | OAuth audience for hosted app inbound auth |
| `OCI_HOSTED_APP_IDCS_SCOPE` | unset | OAuth scope |
| `OCI_HOSTED_APP_CONTAINER_CLI` | `podman` | Container CLI for OCIR build/push |
| `OCI_HOSTED_APP_OCIR_REGION_KEY` | `ord` | OCIR region key used in image URIs |

Keep proxy variables out of the portal process unless they are valid for the current network. The server also strips proxy variables from Python demo child processes so stale shell settings do not break OCI calls.

### Resource Manager deployment

Use `infra/resource-manager-demo` as the Resource Manager working directory. The stack covers Terraform demo modules, shared IAM, OCIR repositories, the OCI DevOps build pipeline, hosted deployments, runtime metadata, and the portal hosted application.

Resource Manager uses OCI DevOps to clone the selected branch, seed the OCI DevOps repository, build the portal image and selected hosted images, deliver artifacts to OCIR, and run deployment stages with resource principal auth. The portal image is always rebuilt and redeployed. Set `APP_DEPLOY=all` to replace every hosted app, or enable only the needed `OCI_HA_*_DEPLOY` switches.

After apply, validate with `portal_url`, `portal_login_user`, `portal_login_password`, `devops_hosted_image_build_run_id`, `devops_hosted_deployment_exports`, and `devops_hosted_image_repository_uris`.

## Logs

Startup logs are written to `logs/enterprise-ai-demo-YYYYMMDD-HHMMSS.log` by default. Disable file capture with:

```bash
LOG_CAPTURE_ENABLED=false PORT=5173 ./bash.sh
```

Demo runs write structured JSON under `logs/demos/<feature-id>/` and print concise lifecycle lines to the server console.

## Cleanup

Destroy demo modules, shared IAM, and the shared Responses API module:

```bash
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u no_proxy -u NO_PROXY \
  DESTROY_INFRA=true \
  PORT=5173 \
  ./bash.sh
```

For OCI Resource Manager deployments, create a Resource Manager destroy job for the stack and wait for it to succeed. Keep the stack record when you want the RMS history, variables, and job logs available for audit or later reuse.

## Validate Before Push

```bash
npm run build
npm test
git diff --check
terraform -chdir=infra/hosted-agentic-applications fmt -check
```

## Version Bumps

Use the version helper so browser-visible assets, npm metadata, and the lockfile stay in sync:

```bash
npm run version:set -- <version>
npm test
```

The portal reads the displayed version from `src/version.json`. `package.json` keeps npm's static `version` field, and `tests/version.test.js` fails if files drift.

Do not commit runtime state, generated Terraform directories, tfvars, API keys, portal passwords, logs, Python bytecode, or demo stores such as `backend/data/`.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the application architecture, provisioning flow, and demo execution model.
