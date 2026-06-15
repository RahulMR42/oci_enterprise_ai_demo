# Responses API Terraform

This module owns the shared OCI Generative AI project and API key used by the portal demos.

## Resources

- OCI-hosted on-demand model: `openai.gpt-oss-120b`.
- No dedicated AI cluster or model endpoint.
- Stable six-character resource suffix from `terraform_data.resource_suffix`.
- OCI Generative AI project created through the OCI CLI because the local provider set does not expose a native project resource here.

The project OCID and API key secret are runtime settings for the OpenAI-compatible endpoint. Do not commit API key secrets.

## Usage

```bash
terraform -chdir=infra/responses-api init
terraform -chdir=infra/responses-api apply \
  -var='compartment_id=<compartment-ocid>' \
  -var='profile=DEFAULT' \
  -var='project_display_name=enterprise-ai-demo-responses-api'
```

After apply, export the values required by the backend:

```bash
export OCI_GENAI_REGION="$(terraform -chdir=infra/responses-api output -raw oci_genai_region)"
export OCI_GENAI_PROJECT_ID="<project-ocid-from-provisioning-logs>"
export OCI_GENAI_API_KEY="<api-key-secret>"
```

Add new demo infrastructure under `infra/<demo-id>` and expose it through outputs before runtime code depends on it.
