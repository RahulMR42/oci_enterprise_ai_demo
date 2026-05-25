variable "compartment_id" {
  description = "OCI compartment OCID for OCIR and OCI Generative AI hosted application resources."
  type        = string
}

variable "region" {
  description = "OCI region."
  type        = string
  default     = "us-chicago-1"
}

variable "profile" {
  description = "OCI CLI profile."
  type        = string
  default     = "DEFAULT"
}

variable "resource_suffix" {
  description = "Six-character suffix used to group resources."
  type        = string
  default     = "000000"
}

variable "repository_name" {
  description = "OCIR repository name for the hosted agent image."
  type        = string
  default     = "enterprise-ai-demo/hosted-agent"
}

variable "langgraph_repository_name" {
  description = "OCIR repository name for the LangGraph hosted agent image."
  type        = string
  default     = "enterprise-ai-demo/hosted-langgraph-agent"
}

variable "langfuse_repository_name" {
  description = "OCIR repository name for the Langfuse hosted observability image."
  type        = string
  default     = "enterprise-ai-demo/hosted-langfuse"
}

variable "langfuse_image_repository_uri" {
  description = "Optional prebuilt container repository URI for the Langfuse hosted observability image. Leave empty to build and push the Langfuse wrapper image to OCIR."
  type        = string
  default     = ""
}

variable "openclaw_repository_name" {
  description = "OCIR repository name for the OpenClaw hosted agent gateway image."
  type        = string
  default     = "enterprise-ai-demo/hosted-openclaw"
}

variable "openclaw_image_repository_uri" {
  description = "Optional prebuilt container repository URI for the OpenClaw hosted agent gateway image. Leave empty to build and push the OpenClaw wrapper image to OCIR."
  type        = string
  default     = ""
}

variable "llamaindex_repository_name" {
  description = "OCIR repository name for the hosted LlamaIndex control tower image."
  type        = string
  default     = "enterprise-ai-demo/hosted-llamaindex-control-tower"
}

variable "llamaindex_image_repository_uri" {
  description = "Optional prebuilt container repository URI for the LlamaIndex control tower image. Leave empty to build and push the wrapper image to OCIR."
  type        = string
  default     = ""
}

variable "image_tag" {
  description = "Container image tag pushed to OCIR and used by hosted deployment."
  type        = string
  default     = "latest"
}

variable "ocir_region_key" {
  description = "OCIR region key. For us-chicago-1 this is ord."
  type        = string
  default     = "ord"
}

variable "container_cli" {
  description = "Container CLI used to build and push the hosted agent image. Use podman when already logged into OCIR."
  type        = string
  default     = "podman"
}

variable "hosted_application_display_name" {
  description = "Display name for the OCI Generative AI hosted application."
  type        = string
  default     = "enterprise-ai-demo-hosted-agent"
}

variable "hosted_deployment_display_name" {
  description = "Display name for the OCI Generative AI hosted deployment."
  type        = string
  default     = "enterprise-ai-demo-hosted-agent-deployment"
}

variable "langgraph_hosted_application_display_name" {
  description = "Display name for the LangGraph OCI Generative AI hosted application."
  type        = string
  default     = "enterprise-ai-demo-langgraph-agent"
}

variable "langgraph_hosted_deployment_display_name" {
  description = "Display name for the LangGraph OCI Generative AI hosted deployment."
  type        = string
  default     = "enterprise-ai-demo-langgraph-agent-deployment"
}

variable "langfuse_hosted_application_display_name" {
  description = "Display name for the Langfuse OCI Generative AI hosted application."
  type        = string
  default     = "enterprise-ai-demo-langfuse"
}

variable "langfuse_hosted_deployment_display_name" {
  description = "Display name for the Langfuse OCI Generative AI hosted deployment."
  type        = string
  default     = "enterprise-ai-demo-langfuse-deployment"
}

variable "openclaw_hosted_application_display_name" {
  description = "Display name for the OpenClaw OCI Generative AI hosted application."
  type        = string
  default     = "enterprise-ai-demo-openclaw"
}

variable "openclaw_hosted_deployment_display_name" {
  description = "Display name for the OpenClaw OCI Generative AI hosted deployment."
  type        = string
  default     = "enterprise-ai-demo-openclaw-deployment"
}

variable "llamaindex_hosted_application_display_name" {
  description = "Display name for the LlamaIndex OCI Generative AI hosted application."
  type        = string
  default     = "enterprise-ai-demo-llamaindex-control-tower"
}

variable "llamaindex_hosted_deployment_display_name" {
  description = "Display name for the LlamaIndex OCI Generative AI hosted deployment."
  type        = string
  default     = "enterprise-ai-demo-llamaindex-control-tower-deployment"
}

variable "app_source_dir" {
  description = "Local container source directory for the hosted agent application."
  type        = string
  default     = "../../apps/hosted-agent"
}

variable "langgraph_app_source_dir" {
  description = "Local container source directory for the LangGraph hosted agent application."
  type        = string
  default     = "../../apps/hosted-langgraph-agent"
}

variable "langfuse_app_source_dir" {
  description = "Local container source directory for the Langfuse hosted observability application."
  type        = string
  default     = "../../apps/hosted-langfuse"
}

variable "openclaw_app_source_dir" {
  description = "Local container source directory for the OpenClaw hosted agent gateway application."
  type        = string
  default     = "../../apps/hosted-openclaw"
}

variable "llamaindex_app_source_dir" {
  description = "Local container source directory for the LlamaIndex control tower hosted application."
  type        = string
  default     = "../../apps/hosted-llamaindex-control-tower"
}

variable "push_image" {
  description = "When true, Terraform local-exec builds and pushes the hosted agent image to OCIR."
  type        = bool
  default     = true
}

variable "idcs_domain_url" {
  description = "Existing identity domain URL used for hosted application inbound OAuth authentication."
  type        = string
}

variable "idcs_audience" {
  description = "Existing identity domain OAuth audience for hosted application inbound authentication."
  type        = string
}

variable "idcs_scope" {
  description = "Existing identity domain OAuth scope for hosted application inbound authentication."
  type        = string
}

variable "openclaw_gateway_token" {
  description = "Shared gateway token for the OpenClaw Control UI. Provide with TF_VAR_openclaw_gateway_token for a stable token."
  type        = string
  sensitive   = true
  default     = ""
}

variable "langfuse_database_url" {
  description = "Optional external Postgres DATABASE_URL for the Langfuse hosted deployment. Defaults to the managed OCI PostgreSQL database created by this module."
  type        = string
  sensitive   = true
  default     = ""
}

variable "langfuse_clickhouse_url" {
  description = "Optional external ClickHouse HTTP URL for the Langfuse hosted deployment. Defaults to the managed ClickHouse container instance created by this module."
  type        = string
  default     = ""
}

variable "langfuse_clickhouse_migration_url" {
  description = "Optional external ClickHouse migration URL for the Langfuse hosted deployment. Defaults to the managed ClickHouse container instance created by this module."
  type        = string
  default     = ""
}

variable "langfuse_clickhouse_user" {
  description = "Optional external ClickHouse username for the Langfuse hosted deployment. Defaults to the managed ClickHouse user."
  type        = string
  default     = ""
}

variable "langfuse_clickhouse_password" {
  description = "Optional external ClickHouse password for the Langfuse hosted deployment. Defaults to the managed ClickHouse password."
  type        = string
  sensitive   = true
  default     = ""
}

variable "langfuse_redis_connection_string" {
  description = "Optional external Redis connection string for the Langfuse hosted deployment. Defaults to the managed Redis container instance created by this module."
  type        = string
  sensitive   = true
  default     = ""
}

variable "langfuse_s3_event_upload_bucket" {
  description = "Object storage bucket used by Langfuse event uploads."
  type        = string
  default     = ""
}

variable "langfuse_s3_media_upload_bucket" {
  description = "Object storage bucket used by Langfuse media uploads."
  type        = string
  default     = ""
}

variable "langfuse_s3_upload_region" {
  description = "Object storage region used by Langfuse S3-compatible uploads."
  type        = string
  default     = "auto"
}

variable "langfuse_s3_upload_endpoint" {
  description = "S3-compatible endpoint used by Langfuse uploads."
  type        = string
  default     = ""
}

variable "langfuse_s3_upload_access_key_id" {
  description = "S3-compatible access key ID used by Langfuse uploads."
  type        = string
  sensitive   = true
  default     = ""
}

variable "langfuse_s3_upload_secret_access_key" {
  description = "S3-compatible secret access key used by Langfuse uploads."
  type        = string
  sensitive   = true
  default     = ""
}

variable "langfuse_nextauth_secret" {
  description = "Langfuse NEXTAUTH_SECRET. Provide a stable secret for persistent deployments."
  type        = string
  sensitive   = true
  default     = ""
}

variable "langfuse_salt" {
  description = "Langfuse SALT. Provide a stable secret for persistent deployments."
  type        = string
  sensitive   = true
  default     = ""
}

variable "langfuse_encryption_key" {
  description = "Langfuse ENCRYPTION_KEY as 64 hex characters. Provide a stable key for persistent deployments."
  type        = string
  sensitive   = true
  default     = ""
}

variable "langfuse_init_user_email" {
  description = "Optional Langfuse initial user email for headless initialization."
  type        = string
  default     = ""
}

variable "langfuse_init_user_password" {
  description = "Optional Langfuse initial user password for headless initialization."
  type        = string
  sensitive   = true
  default     = ""
}

variable "langfuse_vcn_cidr" {
  description = "CIDR block for the OCI network that hosts Langfuse dependencies."
  type        = string
  default     = "10.42.0.0/16"
}

variable "langfuse_subnet_cidr" {
  description = "Private subnet CIDR block for Langfuse dependency endpoints and hosted app egress."
  type        = string
  default     = "10.42.1.0/24"
}

variable "langfuse_postgres_username" {
  description = "Admin username for the managed OCI PostgreSQL database used by Langfuse."
  type        = string
  default     = "langfuse"
}

variable "langfuse_postgres_password" {
  description = "Optional admin password for the managed OCI PostgreSQL database used by Langfuse. If empty, a deterministic demo password is derived from resource_suffix."
  type        = string
  sensitive   = true
  default     = ""
}

variable "langfuse_postgres_db_version" {
  description = "OCI PostgreSQL database version for the managed Langfuse database."
  type        = string
  default     = "14"
}

variable "langfuse_postgres_shape" {
  description = "OCI PostgreSQL database system shape for the managed Langfuse database."
  type        = string
  default     = "VM.Standard.E5.Flex"
}

variable "langfuse_postgres_ocpus" {
  description = "OCPUs for the managed Langfuse PostgreSQL database system."
  type        = number
  default     = 1
}

variable "langfuse_postgres_memory_gbs" {
  description = "Memory in GiB for the managed Langfuse PostgreSQL database system."
  type        = number
  default     = 16
}

variable "langfuse_dependency_container_shape" {
  description = "OCI Container Instances shape used for Langfuse ClickHouse and Redis dependencies."
  type        = string
  default     = "CI.Standard.E4.Flex"
}

variable "langfuse_clickhouse_image" {
  description = "Container image for the Langfuse ClickHouse dependency."
  type        = string
  default     = "docker.io/clickhouse/clickhouse-server:latest"
}

variable "langfuse_clickhouse_ocpus" {
  description = "OCPUs for the Langfuse ClickHouse container instance."
  type        = number
  default     = 2
}

variable "langfuse_clickhouse_memory_gbs" {
  description = "Memory in GiB for the Langfuse ClickHouse container."
  type        = number
  default     = 4
}

variable "langfuse_redis_image" {
  description = "Container image for the Langfuse Redis dependency."
  type        = string
  default     = "docker.io/library/redis:7"
}

variable "langfuse_redis_password" {
  description = "Optional password for the Langfuse Redis dependency. If empty, a deterministic demo password is derived from resource_suffix."
  type        = string
  sensitive   = true
  default     = ""
}

variable "langfuse_redis_ocpus" {
  description = "OCPUs for the Langfuse Redis container instance."
  type        = number
  default     = 1
}

variable "langfuse_redis_memory_gbs" {
  description = "Memory in GiB for the Langfuse Redis container."
  type        = number
  default     = 1
}

variable "scaling_type" {
  description = "Hosted application scaling metric. Valid OCI values include CONCURRENCY, CPU, MEMORY, and REQUESTS_PER_SECOND."
  type        = string
  default     = "REQUESTS_PER_SECOND"
}
