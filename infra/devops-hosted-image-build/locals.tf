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
      artifact_name   = "hosted-agent-image"
      build_spec_file = "infra/devops-hosted-image-build/build_spec_image_hosted.yaml"
      display_name    = "hosted-agent"
    }
    langgraph = {
      artifact_name   = "langgraph-image"
      build_spec_file = "infra/devops-hosted-image-build/build_spec_image_langgraph.yaml"
      display_name    = "langgraph-agent"
    }
    langfuse = {
      artifact_name   = "langfuse-image"
      build_spec_file = "infra/devops-hosted-image-build/build_spec_image_langfuse.yaml"
      display_name    = "langfuse"
    }
    openclaw = {
      artifact_name   = "openclaw-image"
      build_spec_file = "infra/devops-hosted-image-build/build_spec_image_openclaw.yaml"
      display_name    = "openclaw"
    }
    llamaindex = {
      artifact_name   = "llamaindex-image"
      build_spec_file = "infra/devops-hosted-image-build/build_spec_image_llamaindex.yaml"
      display_name    = "llamaindex-control-tower"
    }
    portal = {
      artifact_name   = "portal-image"
      build_spec_file = "infra/devops-hosted-image-build/build_spec_image_portal.yaml"
      display_name    = "portal"
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

  deploy_all_hosted_applications = lower(var.app_deploy) == "all"
  app_deploy_pipeline_value      = local.deploy_all_hosted_applications ? "all" : "none"
  selected_hosted_application_deployments = {
    for key, deployment in local.hosted_application_deployments : key => deployment
    if local.deploy_all_hosted_applications || contains(compact([
      var.deploy_hosted_agent_hosted_application ? "hosted_agent" : "",
      var.deploy_langgraph_hosted_application ? "langgraph" : "",
      var.deploy_langfuse_hosted_application ? "langfuse" : "",
      var.deploy_openclaw_hosted_application ? "openclaw" : "",
      var.deploy_llamaindex_hosted_application ? "llamaindex" : ""
    ]), key)
  }
  selected_hosted_image_artifacts = {
    for key, artifact in local.image_artifacts : key => artifact
    if key != "portal"
  }
  selected_image_artifacts = merge(
    { portal = local.image_artifacts.portal },
    local.selected_hosted_image_artifacts
  )
}
