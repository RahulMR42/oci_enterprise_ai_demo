# Guardrails demo infrastructure

This demo runs backend policy checks before invoking the shared OCI Responses API endpoint. It does not require separate OCI infrastructure beyond the shared OCI Generative AI project and API key created by `infra/responses-api`.

If this demo is promoted to use OCI logging, policy stores, Vault secrets, network controls, or a managed guardrail service, those resources must be added to this Terraform module before backend code depends on them.
