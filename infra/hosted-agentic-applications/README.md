# Hosted Agentic Applications Infrastructure

This module provisions the hosted-application demos used by the portal.

## What It Creates

| Demo | Image source | OCI resources |
| --- | --- | --- |
| Hosted Agentic Applications | `apps/hosted-agent` | OCIR repository, hosted application, hosted deployment |
| LangGraph Hosted Agent | `apps/hosted-langgraph-agent` | OCIR repository, hosted application, hosted deployment |
| n8n Hosted Workflow | `apps/hosted-n8n` or prebuilt image URI | Hosted application, hosted deployment, optional IDCS launch client |
| Langfuse Hosted Observability | `apps/hosted-langfuse` or prebuilt image URI | Hosted app, hosted deployment, VCN, private subnet, PostgreSQL, ClickHouse, Redis, Object Storage |
| OpenClaw Hosted Gateway | `apps/hosted-oc` | OCIR repository, hosted application, hosted deployment |

The OpenClaw gateway image is a lightweight hosted demo wrapper. It exposes a runnable gateway UI, sample task buttons, demo output, `/healthz`, and next steps through the portal launch proxy.

## Identity Domain Inputs

Hosted applications use inbound IDCS auth. Export the existing identity domain values before apply:

```bash
export OCI_HOSTED_APP_IDCS_DOMAIN_URL="https://idcs-...identity.oraclecloud.com:443"
export OCI_HOSTED_APP_IDCS_AUDIENCE="https://genaisolutions.com/"
export OCI_HOSTED_APP_IDCS_SCOPE="read"
```

Do not pass client secrets to Terraform. Secrets would be stored in state; use client credentials only at invocation time when requesting an access token.

## n8n Notes

The n8n hosted workflow demo is intentionally ephemeral. It uses the official n8n image, enables basic auth through hosted application environment variables, and does not attach persistent storage.

Set a password at apply time:

```bash
export TF_VAR_n8n_basic_auth_password="<runtime-only-password>"
```

Optionally set `TF_VAR_n8n_basic_auth_user`; otherwise the module uses `admin`.

## Langfuse Notes

The Langfuse hosted observability demo deploys the Langfuse web container as a separate hosted application and creates private OCI dependencies:

- VCN, private subnet, NAT gateway, service gateway, and network security groups
- OCI PostgreSQL for the relational database
- OCI Container Instances for ClickHouse and Redis
- OCI Object Storage bucket for event and media uploads

Terraform derives the default `DATABASE_URL`, ClickHouse URLs, Redis connection string, and Object Storage settings from those managed resources.

Override dependency endpoints only when pointing the hosted Langfuse UI at an existing stack:

```bash
export LANGFUSE_DATABASE_URL="postgresql://..."
export LANGFUSE_CLICKHOUSE_URL="https://..."
export LANGFUSE_CLICKHOUSE_MIGRATION_URL="clickhouse://..."
export LANGFUSE_CLICKHOUSE_USER="<user>"
export LANGFUSE_CLICKHOUSE_PASSWORD="<password>"
export LANGFUSE_REDIS_CONNECTION_STRING="redis://..."
export LANGFUSE_S3_EVENT_UPLOAD_BUCKET="<bucket>"
export LANGFUSE_S3_MEDIA_UPLOAD_BUCKET="<bucket>"
export LANGFUSE_S3_UPLOAD_ENDPOINT="https://..."
export LANGFUSE_S3_UPLOAD_ACCESS_KEY_ID="<access-key>"
export LANGFUSE_S3_UPLOAD_SECRET_ACCESS_KEY="<secret-key>"
```

Optional `LANGFUSE_NEXTAUTH_SECRET`, `LANGFUSE_SALT`, `LANGFUSE_ENCRYPTION_KEY`, `LANGFUSE_INIT_USER_EMAIL`, and `LANGFUSE_INIT_USER_PASSWORD` values can be supplied for stable persistent deployments. If omitted, Terraform derives runtime values for the demo.

## Image Publishing

By default the module builds local wrapper images and pushes them to OCIR. Set these variables to reuse prebuilt images:

```hcl
n8n_image_repository_uri      = "ord.ocir.io/<namespace>/enterprise-ai-demo/hosted-n8n-<suffix>"
langfuse_image_repository_uri = "ord.ocir.io/<namespace>/enterprise-ai-demo/hosted-langfuse-<suffix>"
```

Do not commit `.tfvars` or `.auto.tfvars` files with tenancy-specific values. They are local deployment inputs.

## Generated Runtime Metadata

Provisioning writes generated metadata under `.terraform/generated/`:

```text
hosted_agent.json
langgraph_hosted_agent.json
n8n_hosted_workflow.json
langfuse_hosted_observability.json
openclaw_hosted_gateway.json
```

The portal reads these files to populate infrastructure status and launch URLs. Generated metadata, Terraform state, and local tfvars should remain out of git.

## Apply

Startup applies this module when `hosted-agentic-applications` is included in `PROVISION_DEMOS`:

```bash
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u no_proxy -u NO_PROXY \
  PROVISION_INFRA=true \
  PROVISION_DEMOS=hosted-agentic-applications \
  PORT=5173 \
  ./bash.sh
```
