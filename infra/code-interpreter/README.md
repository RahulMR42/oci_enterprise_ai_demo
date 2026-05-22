# Code Interpreter demo infrastructure

This demo uses the shared OCI Generative AI project and API key created by `infra/responses-api`.

Terraform now owns a reusable Code Interpreter container through the OCI OpenAI-compatible `/containers` endpoint. The local-exec provisioner stores the create response at `.terraform/generated/container.json`.

```bash
terraform -chdir=infra/code-interpreter apply \
  -var='region=us-chicago-1'
```

The runtime uses `OCI_GENAI_CODE_INTERPRETER_CONTAINER` when it is set. After apply, copy the container ID from `.terraform/generated/container.json`, export it, or paste it into the Code Interpreter workbench field:

```bash
export OCI_GENAI_CODE_INTERPRETER_CONTAINER="<container-id>"
```

If this demo is promoted to manage file inputs, Object Storage, artifact retention, or network controls, those resources must be added to this Terraform module before backend code depends on them.
