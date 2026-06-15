# Guardrails Infrastructure

This demo runs backend policy checks before invoking the shared OCI Responses API endpoint. It requires no separate OCI infrastructure beyond the shared OCI Generative AI project and API key from `infra/responses-api`.

Add OCI logging, policy stores, Vault secrets, network controls, or a managed guardrail service to this module before backend code depends on them.
