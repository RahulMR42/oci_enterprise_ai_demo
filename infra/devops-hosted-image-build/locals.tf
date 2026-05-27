locals {
  project_name = "enterprise-ai-demo-devops-${var.resource_suffix}"

  repositories = {
    hosted_agent = "enterprise-ai-demo/hosted-agent-${var.resource_suffix}"
    langgraph    = "enterprise-ai-demo/hosted-langgraph-agent-${var.resource_suffix}"
    langfuse     = "enterprise-ai-demo/hosted-langfuse-${var.resource_suffix}"
    openclaw     = "enterprise-ai-demo/hosted-openclaw-${var.resource_suffix}"
    llamaindex   = "enterprise-ai-demo/hosted-llamaindex-control-tower-${var.resource_suffix}"
    portal       = "enterprise-ai-demo/portal-rm"
  }

  image_artifacts = {
    hosted_agent = {
      artifact_name = "hosted-agent-image"
      display_name  = "hosted-agent"
    }
    langgraph = {
      artifact_name = "langgraph-image"
      display_name  = "langgraph-agent"
    }
    langfuse = {
      artifact_name = "langfuse-image"
      display_name  = "langfuse"
    }
    openclaw = {
      artifact_name = "openclaw-image"
      display_name  = "openclaw"
    }
    llamaindex = {
      artifact_name = "llamaindex-image"
      display_name  = "llamaindex-control-tower"
    }
    portal = {
      artifact_name = "portal-image"
      display_name  = "portal"
    }
  }

  hosted_application_deployments = {
    hosted_agent = {
      build_spec_file = "infra/devops-hosted-image-build/build_spec_deploy_hosted.yaml"
      display_name    = "hosted-agent"
      stage_name      = "deploy-hosted-agent"
    }
    langgraph = {
      build_spec_file = "infra/devops-hosted-image-build/build_spec_deploy_langgraph.yaml"
      display_name    = "langgraph-agent"
      stage_name      = "deploy-langgraph-agent"
    }
    langfuse = {
      build_spec_file = "infra/devops-hosted-image-build/build_spec_deploy_langfuse.yaml"
      display_name    = "langfuse"
      stage_name      = "deploy-langfuse"
    }
    openclaw = {
      build_spec_file = "infra/devops-hosted-image-build/build_spec_deploy_openclaw.yaml"
      display_name    = "openclaw"
      stage_name      = "deploy-openclaw"
    }
    llamaindex = {
      build_spec_file = "infra/devops-hosted-image-build/build_spec_deploy_llamaindex.yaml"
      display_name    = "llamaindex-control-tower"
      stage_name      = "deploy-llamaindex-control-tower"
    }
  }
}
