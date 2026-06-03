# Conversation Store demo infrastructure

This module creates an OCI Conversations API object through the OpenAI-compatible OCI endpoint and writes the generated metadata to `.terraform/generated/conversation.json`.

```bash
terraform -chdir=infra/conversation-store apply \
  -var="region=us-chicago-1" \
  -var="resource_suffix=fd2ed9"
```

The live runtime requires the shared OCI Generative AI project/API key from `infra/responses-api`. Startup exports `OCI_GENAI_CONVERSATION_ID` from the generated metadata when present. The backend can also create a conversation lazily when the generated ID is not available.
