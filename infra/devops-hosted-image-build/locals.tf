locals {
  project_name = "enterprise-ai-demo-devops-${var.resource_suffix}"

  repositories = {
    hosted_agent = "enterprise-ai-demo/hosted-agent-${var.resource_suffix}"
    langgraph    = "enterprise-ai-demo/hosted-langgraph-agent-${var.resource_suffix}"
    n8n          = "enterprise-ai-demo/hosted-n8n-${var.resource_suffix}"
    langfuse     = "enterprise-ai-demo/hosted-langfuse-${var.resource_suffix}"
    openclaw     = "enterprise-ai-demo/hosted-openclaw-${var.resource_suffix}"
    llamaindex   = "enterprise-ai-demo/hosted-llamaindex-control-tower-${var.resource_suffix}"
  }
}
