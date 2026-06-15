# Code Interpreter Infrastructure

This demo uses the shared OCI Generative AI project and API key from `infra/responses-api`.

Terraform owns a reusable Code Interpreter container through the OCI OpenAI-compatible `/containers` endpoint and stores the create response at `.terraform/generated/container.json`.

```bash
terraform -chdir=infra/code-interpreter apply \
  -var='region=us-chicago-1'
```

The runtime uses `OCI_GENAI_CODE_INTERPRETER_CONTAINER` when set. After apply, copy the container ID from `.terraform/generated/container.json`, export it, or paste it into the Code Interpreter workbench:

```bash
export OCI_GENAI_CODE_INTERPRETER_CONTAINER="<container-id>"
```

Add file inputs, Object Storage, artifact retention, or network controls to this module before backend code depends on them.
