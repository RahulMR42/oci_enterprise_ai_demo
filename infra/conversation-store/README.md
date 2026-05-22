# Conversation Store demo infrastructure

This demo does not require separate OCI infrastructure beyond the shared OCI Generative AI project and API key created by `infra/responses-api`.

Runtime conversation state is persisted locally under `backend/data/` for the development demo and is intentionally gitignored. If this demo is promoted to use Object Storage, Autonomous Database, NoSQL, Vault, or another OCI resource, that resource must be added to this Terraform module before backend code depends on it.
