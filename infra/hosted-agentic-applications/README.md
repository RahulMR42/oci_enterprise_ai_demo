# Hosted Agentic Applications

This module provisions the hosted-application demos launched from the portal.

## What It Creates

| Demo | Image source | OCI resources |
| --- | --- | --- |
| Hosted Agentic Applications | `apps/hosted-agent` | OCIR repository, hosted application, hosted deployment |
| LangGraph Hosted Agent | `apps/hosted-langgraph-agent` | OCIR repository, hosted application, hosted deployment |
| OpenClaw Hosted Gateway | `apps/hosted-openclaw` | OCIR repository, hosted application, hosted deployment |
| LlamaIndex Control Tower | `apps/hosted-llamaindex-control-tower` | OCIR repository, hosted application, hosted deployment |

The OpenClaw gateway image is a lightweight hosted wrapper with a runnable gateway UI, sample task buttons, demo output, `/healthz`, and next steps through the portal launch proxy.

## Identity Domain Inputs

Hosted applications use inbound IDCS auth. Export existing identity domain values before apply:

```bash
export OCI_HOSTED_APP_IDCS_DOMAIN_URL="https://idcs-...identity.oraclecloud.com:443"
export OCI_HOSTED_APP_IDCS_AUDIENCE="https://genaisolutions.com/"
export OCI_HOSTED_APP_IDCS_SCOPE="read"
```

Do not pass client secrets to Terraform. Secrets would be stored in state; use client credentials only at invocation time.

## Hosted UI Notes

Hosted UI demos launch through the portal using OCI hosted application invoke URLs. The module writes IDCS launch-client metadata so the portal can request access tokens without storing client secrets in Terraform variables.

## Image Publishing

By default, the module builds local wrapper images and pushes them to OCIR. Set these variables to reuse prebuilt images:

```hcl
openclaw_image_repository_uri = "ord.ocir.io/<namespace>/enterprise-ai-demo/hosted-openclaw-<suffix>"
llamaindex_image_repository_uri = "ord.ocir.io/<namespace>/enterprise-ai-demo/hosted-llamaindex-control-tower-<suffix>"
```

Do not commit `.tfvars` or `.auto.tfvars` files with tenancy-specific values. They are local deployment inputs.

## Generated Runtime Metadata

Provisioning writes generated metadata under `.terraform/generated/`:

```text
hosted_agent.json
langgraph_hosted_agent.json
hosted_app_idcs_client.json
openclaw_hosted_gateway.json
llamaindex_control_tower.json
```

The portal reads these files for infrastructure status and launch URLs. Generated metadata, Terraform state, and local tfvars should stay out of git.

## Apply

Startup applies this module when `hosted-agentic-applications` is included in `PROVISION_DEMOS`:

```bash
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u no_proxy -u NO_PROXY \
  PROVISION_INFRA=true \
  PROVISION_DEMOS=hosted-agentic-applications \
  PORT=5173 \
  ./bash.sh
```
