import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("file search terraform owns vector store provisioning contract", () => {
  const terraform = read("infra/file-search-vector-store-rag/vector_store.tf");

  assert.match(terraform, /resource "terraform_data" "file_search_vector_store"/);
  assert.match(terraform, /resource "terraform_data" "file_search_seed_documents"/);
  assert.match(terraform, /from openai import OpenAI/);
  assert.match(terraform, /shared_api_key_file/);
  assert.match(terraform, /shared_project_file/);
  assert.match(terraform, /base_url="\$\{self\.input\.openai_base_url\}"/);
  assert.match(terraform, /vector_stores\.create/);
  assert.match(terraform, /client\.files\.create/);
  assert.match(terraform, /vector_stores\.files\.create/);
  assert.match(terraform, /vector_stores\.files\.retrieve/);
  assert.match(terraform, /client\.files\.delete/);
  assert.match(terraform, /assets\/pdfs/);
  assert.match(terraform, /vector_stores\.delete/);
  assert.match(terraform, /when\s+=\s+destroy/);
  assert.match(read("infra/file-search-vector-store-rag/locals.tf"), /generativeai\.\$\{var\.region\}\.oci\.oraclecloud\.com\/20231130/);
  assert.match(terraform, /OCI_GENAI_VECTOR_STORE_ID/);
});

test("code interpreter terraform owns container provisioning contract", () => {
  const terraform = read("infra/code-interpreter/container.tf");

  assert.match(terraform, /resource "terraform_data" "code_interpreter_container"/);
  assert.match(terraform, /containers\.create/);
  assert.match(terraform, /containers\.delete/);
  assert.match(terraform, /when\s+=\s+destroy/);
  assert.match(terraform, /project="\$project_id"/);
  assert.match(terraform, /OCI_GENAI_CODE_INTERPRETER_CONTAINER/);
});

test("shared security terraform creates reusable dynamic group and demo policies", () => {
  const terraform = [
    read("infra/shared-demo-security/identity.tf"),
    read("infra/shared-demo-security/variables.tf"),
    read("infra/shared-demo-security/outputs.tf")
  ].join("\n");

  assert.match(terraform, /resource "oci_identity_dynamic_group" "enterprise_ai_demo"/);
  assert.match(terraform, /resource "oci_identity_policy" "enterprise_ai_demo"/);
  assert.match(terraform, /resource\.compartment\.id/);
  assert.match(terraform, /allow dynamic-group/);
  assert.match(terraform, /generative-ai-family/);
  assert.match(terraform, /autonomous-database-family/);
  assert.match(terraform, /database-tools-family/);
  assert.match(terraform, /secret-family/);
  assert.match(terraform, /object-family/);
  assert.match(terraform, /read repos in compartment id/);
});

test("nl2sql terraform includes autonomous database and db tools but no local IAM policy", () => {
  const terraform = [
    read("infra/nl2sql-sql-search/autonomous_database.tf"),
    read("infra/nl2sql-sql-search/credentials.tf"),
    read("infra/nl2sql-sql-search/database_tools.tf"),
    read("infra/nl2sql-sql-search/variables.tf"),
    read("infra/nl2sql-sql-search/outputs.tf")
  ].join("\n");

  assert.match(terraform, /resource "random_password" "sql_search_admin"/);
  assert.match(terraform, /resource "oci_kms_vault" "sql_search"/);
  assert.match(terraform, /resource "oci_kms_key" "sql_search"/);
  assert.match(terraform, /resource "oci_vault_secret" "sql_search_admin_password"/);
  assert.match(terraform, /resource "oci_database_autonomous_database" "sql_search"/);
  assert.match(terraform, /admin_password\s+=\s+random_password\.sql_search_admin\.result/);
  assert.match(terraform, /resource "oci_database_tools_database_tools_connection" "enrichment"/);
  assert.match(terraform, /resource "oci_database_tools_database_tools_connection" "query"/);
  assert.match(terraform, /secret_id\s+=\s+local\.database_password_secret_id/);
  assert.doesNotMatch(terraform, /resource "oci_identity_policy"/);
  assert.doesNotMatch(terraform, /dynamic-group/);
  assert.doesNotMatch(terraform, /policy_group_name/);
  assert.doesNotMatch(terraform, /variable "autonomous_database_admin_password"/);
});

test("hosted agent terraform creates OCIR repository and OCI hosted deployment", () => {
  const terraform = [
    read("infra/hosted-agentic-applications/hosted_application.tf"),
    read("infra/hosted-agentic-applications/langgraph_hosted_application.tf"),
    read("infra/hosted-agentic-applications/n8n_idcs_client.tf"),
    read("infra/hosted-agentic-applications/n8n_hosted_application.tf"),
    read("infra/hosted-agentic-applications/langfuse_dependencies.tf"),
    read("infra/hosted-agentic-applications/langfuse_hosted_application.tf"),
    read("infra/hosted-agentic-applications/openclaw_hosted_application.tf"),
    read("infra/hosted-agentic-applications/llamaindex_control_tower_hosted_application.tf"),
    read("infra/hosted-agentic-applications/ocir_repositories.tf"),
    read("infra/hosted-agentic-applications/locals.tf"),
    read("infra/hosted-agentic-applications/variables.tf"),
    read("infra/hosted-agentic-applications/outputs.tf")
  ].join("\n");
  const dockerfile = read("apps/hosted-agent/Dockerfile");
  const langgraphDockerfile = read("apps/hosted-langgraph-agent/Dockerfile");
  const n8nDockerfile = read("apps/hosted-n8n/Dockerfile");
  const langfuseDockerfile = read("apps/hosted-langfuse/Dockerfile");
  const openclawDockerfile = read("apps/hosted-openclaw/Dockerfile");
  const llamaIndexDockerfile = read("apps/hosted-llamaindex-control-tower/Dockerfile");
  const langgraphApp = read("apps/hosted-langgraph-agent/app.py");
  const llamaIndexApp = read("apps/hosted-llamaindex-control-tower/app.py");

  assert.match(terraform, /resource "terraform_data" "hosted_agentic_application"/);
  assert.match(terraform, /resource "terraform_data" "langgraph_hosted_agentic_application"/);
  assert.match(terraform, /resource "terraform_data" "n8n_hosted_workflow_automation"/);
  assert.match(terraform, /resource "terraform_data" "langfuse_hosted_observability"/);
  assert.match(terraform, /resource "terraform_data" "openclaw_hosted_agent_gateway"/);
  assert.match(terraform, /resource "terraform_data" "llamaindex_control_tower"/);
  assert.match(terraform, /resource "oci_artifacts_container_repository" "hosted_agent"/);
  assert.match(terraform, /resource "oci_artifacts_container_repository" "langgraph"/);
  assert.match(terraform, /resource "oci_artifacts_container_repository" "n8n"/);
  assert.match(terraform, /resource "oci_artifacts_container_repository" "langfuse"/);
  assert.match(terraform, /resource "oci_artifacts_container_repository" "openclaw"/);
  assert.match(terraform, /resource "oci_artifacts_container_repository" "llamaindex"/);
  assert.match(terraform, /repository_managed_by_terraform/);
  assert.match(terraform, /resource "oci_core_vcn" "langfuse"/);
  assert.match(terraform, /resource "oci_core_subnet" "langfuse_private"/);
  assert.match(terraform, /resource "oci_core_nat_gateway" "langfuse"/);
  assert.match(terraform, /resource "oci_core_service_gateway" "langfuse"/);
  assert.match(terraform, /resource "oci_core_network_security_group" "langfuse_hosted_app"/);
  assert.match(terraform, /resource "oci_core_network_security_group" "langfuse_dependencies"/);
  assert.match(terraform, /source_type\s+=\s+"NETWORK_SECURITY_GROUP"/);
  assert.match(terraform, /oci_core_network_security_group\.langfuse_hosted_app\.id/);
  assert.match(terraform, /resource "oci_psql_db_system" "langfuse"/);
  assert.match(terraform, /resource "oci_container_instances_container_instance" "langfuse_clickhouse"/);
  assert.match(terraform, /resource "oci_container_instances_container_instance" "langfuse_redis"/);
  assert.match(terraform, /resource "oci_objectstorage_bucket" "langfuse"/);
  assert.match(terraform, /data "oci_psql_db_system_connection_detail" "langfuse"/);
  assert.match(terraform, /resource "oci_identity_domains_app" "n8n_launch_client"/);
  assert.match(terraform, /hosted UI launch proxies/);
  assert.match(terraform, /is_oauth_client\s+=\s+true/);
  assert.match(terraform, /client_type\s+=\s+"confidential"/);
  assert.match(terraform, /when\s+=\s+destroy/);
  assert.match(terraform, /oci identity-domains app patch/);
  assert.match(terraform, /"path":"active","value":false/);
  assert.match(terraform, /n8n_idcs_allowed_grants\s+=\s+length\(local\.n8n_idcs_redirect_uris\) > 0 \? \["client_credentials", "authorization_code"\] : \["client_credentials"\]/);
  assert.match(terraform, /allowed_grants\s+=\s+local\.n8n_idcs_allowed_grants/);
  assert.match(terraform, /redirect_uris\s+=\s+local\.n8n_idcs_redirect_uris/);
  assert.match(terraform, /n8n_idcs_client\.json/);
  assert.match(terraform, /N8N_IDCS_CLIENT_SECRET = oci_identity_domains_app\.n8n_launch_client\[0\]\.client_secret/);
  assert.match(terraform, /n8n_idcs_launch_client_id/);
  assert.match(terraform, /terraform_data\.n8n_idcs_launch_client_metadata/);
  assert.match(terraform, /oci_artifacts_container_repository\.n8n/);
  assert.match(terraform, /oci artifacts container repository create/);
  assert.match(terraform, /langgraph_hosted_agent\.json/);
  assert.match(terraform, /langgraph_hosted_application\.json/);
  assert.match(terraform, /langgraph_hosted_deployment\.json/);
  assert.match(terraform, /langgraph_ocir_repository\.json/);
  assert.match(terraform, /n8n_hosted_workflow\.json/);
  assert.match(terraform, /n8n_hosted_application\.json/);
  assert.match(terraform, /n8n_hosted_deployment\.json/);
  assert.match(terraform, /n8n_ocir_repository\.json/);
  assert.match(terraform, /langfuse_hosted_observability\.json/);
  assert.match(terraform, /langfuse_hosted_application\.json/);
  assert.match(terraform, /langfuse_hosted_deployment\.json/);
  assert.match(terraform, /langfuse_ocir_repository\.json/);
  assert.match(terraform, /openclaw_hosted_gateway\.json/);
  assert.match(terraform, /openclaw_hosted_application\.json/);
  assert.match(terraform, /openclaw_hosted_deployment\.json/);
  assert.match(terraform, /openclaw_ocir_repository\.json/);
  assert.match(terraform, /llamaindex_control_tower\.json/);
  assert.match(terraform, /llamaindex_hosted_application\.json/);
  assert.match(terraform, /llamaindex_hosted_deployment\.json/);
  assert.match(terraform, /llamaindex_ocir_repository\.json/);
  assert.match(terraform, /langgraph-hosted-agent-mcp/);
  assert.match(terraform, /n8n-hosted-workflow-automation/);
  assert.match(terraform, /langfuse-hosted-observability/);
  assert.match(terraform, /openclaw-hosted-agent-gateway/);
  assert.match(terraform, /agentic-control-tower/);
  assert.match(terraform, /variable "container_cli"/);
  assert.match(terraform, /variable "ocir_region_key"/);
  assert.match(terraform, /variable "n8n_basic_auth_password"/);
  assert.match(terraform, /variable "n8n_image_repository_uri"/);
  assert.match(terraform, /variable "langfuse_image_repository_uri"/);
  assert.match(terraform, /variable "langfuse_database_url"/);
  assert.match(terraform, /variable "langfuse_clickhouse_url"/);
  assert.match(terraform, /variable "langfuse_redis_connection_string"/);
  assert.match(terraform, /variable "langfuse_s3_event_upload_bucket"/);
  assert.match(terraform, /variable "openclaw_image_repository_uri"/);
  assert.match(terraform, /variable "llamaindex_image_repository_uri"/);
  assert.match(terraform, /variable "llamaindex_app_source_dir"/);
  assert.match(terraform, /variable "openclaw_gateway_token"/);
  assert.match(terraform, /variable "n8n_idcs_launch_client_enabled"/);
  assert.match(terraform, /variable "n8n_idcs_scope"/);
  assert.match(terraform, /Leave empty to build and push the n8n wrapper image to OCIR/);
  assert.match(terraform, /sensitive\s+=\s+true/);
  assert.match(terraform, /container_cli/);
  assert.match(terraform, /podman/);
  assert.match(terraform, /ord/);
  assert.match(terraform, /build --platform linux\/amd64/);
  assert.match(terraform, /push "\$image_uri"/);
  assert.match(terraform, /variable "idcs_domain_url"/);
  assert.match(terraform, /variable "idcs_audience"/);
  assert.match(terraform, /variable "idcs_scope"/);
  assert.match(terraform, /variable "scaling_type"/);
  assert.match(terraform, /IDCS_AUTH_CONFIG/);
  assert.match(terraform, /inbound-auth-config/);
  assert.match(terraform, /REQUESTS_PER_SECOND/);
  assert.match(terraform, /oci generative-ai hosted-application create/);
  assert.match(terraform, /oci generative-ai hosted-deployment create-hosted-deployment-single-docker-artifact/);
  assert.match(terraform, /active-artifact-container-uri/);
  assert.match(terraform, /ocir_repository\.json/);
  assert.match(terraform, /hosted_agent\.json/);
  assert.match(terraform, /N8N_BASIC_AUTH_ACTIVE/);
  assert.match(terraform, /"N8N_BASIC_AUTH_ACTIVE", "type": "PLAINTEXT", "value": "false"/);
  assert.match(terraform, /N8N_BASIC_AUTH_USER/);
  assert.match(terraform, /N8N_BASIC_AUTH_PASSWORD/);
  assert.match(terraform, /N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS/);
  assert.match(terraform, /20260519-upgrade-n8n-stable/);
  assert.match(terraform, /DATABASE_URL/);
  assert.match(terraform, /CLICKHOUSE_URL/);
  assert.match(terraform, /LANGFUSE_AUTO_CLICKHOUSE_MIGRATION_DISABLED/);
  assert.match(terraform, /REDIS_CONNECTION_STRING/);
  assert.match(terraform, /LANGFUSE_S3_EVENT_UPLOAD_BUCKET/);
  assert.match(terraform, /LANGFUSE_USE_OCI_NATIVE_OBJECT_STORAGE/);
  assert.match(terraform, /LANGFUSE_OCI_AUTH_TYPE/);
  assert.match(terraform, /resource_principal/);
  assert.match(terraform, /networking-config/);
  assert.match(terraform, /endpointMode/);
  assert.match(terraform, /PUBLIC/);
  assert.match(terraform, /CUSTOM/);
  assert.match(terraform, /NEXTAUTH_SECRET/);
  assert.doesNotMatch(terraform, /LANGFUSE_INIT_PROJECT_PUBLIC_KEY/);
  assert.match(terraform, /oci artifacts container repository delete/);
  assert.match(terraform, /oci generative-ai hosted-deployment delete/);
  assert.match(terraform, /oci generative-ai hosted-application delete/);
  assert.match(dockerfile, /EXPOSE 8080/);
  assert.match(langgraphDockerfile, /requirements\.txt/);
  assert.match(langgraphDockerfile, /EXPOSE 8080/);
  assert.match(n8nDockerfile, /FROM docker\.n8n\.io\/n8nio\/n8n:stable/);
  assert.doesNotMatch(n8nDockerfile, /npx/);
  assert.doesNotMatch(n8nDockerfile, /npm install -g n8n/);
  assert.match(n8nDockerfile, /N8N_USER_FOLDER=\/tmp\/\.n8n/);
  assert.match(n8nDockerfile, /N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=false/);
  assert.match(n8nDockerfile, /ENTRYPOINT \["tini", "--"\]/);
  assert.match(n8nDockerfile, /CMD \["n8n", "start"\]/);
  assert.match(n8nDockerfile, /EXPOSE 5678/);
  assert.match(langfuseDockerfile, /FROM docker\.io\/langfuse\/langfuse:3/);
  assert.match(langfuseDockerfile, /HOSTNAME=0\.0\.0\.0/);
  assert.match(langfuseDockerfile, /PORT=3000/);
  assert.match(langfuseDockerfile, /EXPOSE 3000/);
  assert.match(openclawDockerfile, /FROM ghcr\.io\/openclaw\/openclaw:latest/);
  assert.match(openclawDockerfile, /OPENCLAW_GATEWAY_BIND=lan/);
  assert.match(openclawDockerfile, /EXPOSE 18789/);
  assert.match(llamaIndexDockerfile, /requirements\.txt/);
  assert.match(llamaIndexDockerfile, /EXPOSE 8080/);
  assert.match(read("apps/hosted-agent/app.py"), /\/\.well-known\/agent-card\.json/);
  assert.match(read("apps/hosted-agent/app.py"), /\/a2a\/tasks/);
  assert.match(langgraphApp, /\/\.well-known\/agent-card\.json/);
  assert.match(langgraphApp, /\/a2a\/tasks/);
  assert.match(langgraphApp, /from langgraph\.graph import END, StateGraph/);
  assert.match(langgraphApp, /\/agent\/langgraph-mcp\/respond/);
  assert.match(llamaIndexApp, /from llama_index\.core\.workflow import Event, StartEvent, StopEvent, Workflow, step/);
  assert.match(llamaIndexApp, /\/agent\/control-tower\/respond/);
});

test("startup script provisions selected demo modules and exports generated runtime ids", () => {
  const script = read("bash.sh");

  assert.match(script, /PROVISION_DEMOS/);
  assert.match(script, /file-search-vector-store-rag,code-interpreter,nl2sql-sql-search,hosted-agentic-applications/);
  assert.match(script, /REQUIRE_DEMO_INFRA="\$\{REQUIRE_DEMO_INFRA:-true\}"/);
  assert.match(script, /PROVISION_SHARED_INFRA="\$\{PROVISION_SHARED_INFRA:-true\}"/);
  assert.match(script, /apply_shared_module/);
  assert.match(script, /infra\/shared-demo-security/);
  assert.match(script, /OCI_TENANCY_ID/);
  assert.match(script, /apply_demo_module/);
  assert.match(script, /file-search-vector-store-rag/);
  assert.match(script, /code-interpreter/);
  assert.match(script, /nl2sql-sql-search/);
  assert.match(script, /hosted-agentic-applications/);
  assert.doesNotMatch(script, /TF_VAR_autonomous_database_admin_password/);
  assert.doesNotMatch(script, /OCI_SQL_SEARCH_DB_PASSWORD_SECRET_ID/);
  assert.doesNotMatch(script, /OCI_SQL_SEARCH_POLICY_GROUP_NAME/);
  assert.match(script, /OCI_GENAI_VECTOR_STORE_ID/);
  assert.match(script, /OCI_GENAI_CODE_INTERPRETER_CONTAINER/);
});

test("startup script persists and reuses local n8n basic auth password", () => {
  const script = read("bash.sh");
  const gitignore = read(".gitignore");

  assert.match(script, /N8N_PASSWORD_FILE="\$\{N8N_PASSWORD_FILE:-\.n8n-hosted-password\}"/);
  assert.match(script, /ensure_n8n_basic_auth_password\(\)/);
  assert.match(script, /TF_VAR_n8n_basic_auth_password/);
  assert.match(script, /OCI_HOSTED_N8N_BASIC_AUTH_PASSWORD/);
  assert.match(script, /chmod 600 "\$N8N_PASSWORD_FILE"/);
  assert.match(script, /-var="n8n_basic_auth_password=\$\{TF_VAR_n8n_basic_auth_password\}"/);
  assert.match(script, /-var="n8n_image_repository_uri=\$\{OCI_HOSTED_N8N_IMAGE_REPOSITORY_URI:-\}"/);
  assert.match(script, /-var="langfuse_image_repository_uri=\$\{OCI_HOSTED_LANGFUSE_IMAGE_REPOSITORY_URI:-\}"/);
  assert.match(script, /-var="langfuse_database_url=\$\{LANGFUSE_DATABASE_URL:-\}"/);
  assert.match(script, /-var="langfuse_clickhouse_url=\$\{LANGFUSE_CLICKHOUSE_URL:-\}"/);
  assert.match(script, /-var="langfuse_redis_connection_string=\$\{LANGFUSE_REDIS_CONNECTION_STRING:-\}"/);
  assert.match(script, /-var="langfuse_s3_event_upload_bucket=\$\{LANGFUSE_S3_EVENT_UPLOAD_BUCKET:-\}"/);
  assert.match(gitignore, /^\.n8n-hosted-password$/m);
});

test("startup script can destroy all Terraform modules in cleanup order", () => {
  const script = read("bash.sh");

  assert.match(script, /DESTROY_INFRA/);
  assert.match(script, /DESTROY_DEMOS="\$\{DESTROY_DEMOS:-hosted-agentic-applications,nl2sql-sql-search,code-interpreter,file-search-vector-store-rag\}"/);
  assert.match(script, /destroy_demo_module/);
  assert.match(script, /destroy_shared_module/);
  assert.match(script, /terraform -chdir="\$module_path" destroy -auto-approve/);
  assert.match(script, /terraform -chdir=infra\/responses-api destroy -auto-approve/);
  assert.match(script, /Infrastructure cleanup complete\./);
  assert.match(script, /exit 0/);
});

test("resource manager aggregate stack covers all Terraform deployment modules", () => {
  const terraform = [
    read("infra/resource-manager-demo/versions.tf"),
    read("infra/resource-manager-demo/variables.tf"),
    read("infra/resource-manager-demo/main.tf"),
    read("infra/resource-manager-demo/portal_container.tf"),
    read("infra/resource-manager-demo/outputs.tf"),
    read("infra/shared-demo-security/identity.tf"),
    read("infra/devops-hosted-image-build/main.tf"),
    read("infra/devops-hosted-image-build/build_spec.yaml")
  ].join("\n");
  const readme = read("infra/resource-manager-demo/README.md");
  const hostedAppTerraform = [
    read("infra/hosted-agentic-applications/hosted_application.tf"),
    read("infra/hosted-agentic-applications/langgraph_hosted_application.tf"),
    read("infra/hosted-agentic-applications/n8n_hosted_application.tf"),
    read("infra/hosted-agentic-applications/langfuse_hosted_application.tf"),
    read("infra/hosted-agentic-applications/openclaw_hosted_application.tf"),
    read("infra/hosted-agentic-applications/llamaindex_control_tower_hosted_application.tf")
  ].join("\n");

  assert.match(terraform, /module "responses_api"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/responses-api"/);
  assert.match(terraform, /module "shared_demo_security"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/shared-demo-security"/);
  assert.match(terraform, /module "file_search_vector_store_rag"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/file-search-vector-store-rag"/);
  assert.match(terraform, /module "code_interpreter"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/code-interpreter"/);
  assert.match(terraform, /module "nl2sql_sql_search"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/nl2sql-sql-search"/);
  assert.match(terraform, /module "devops_hosted_image_build"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/devops-hosted-image-build"/);
  assert.match(terraform, /resource "oci_devops_project" "this"/);
  assert.match(terraform, /resource "oci_devops_build_pipeline" "this"/);
  assert.match(terraform, /resource "oci_devops_build_pipeline_stage" "build"/);
  assert.match(terraform, /resource "oci_devops_build_run" "this"/);
  assert.match(terraform, /resource "oci_ons_notification_topic" "this"/);
  assert.match(terraform, /resource "oci_logging_log_group" "devops"/);
  assert.match(terraform, /resource "oci_logging_log" "devops"/);
  assert.match(terraform, /category\s+=\s+"all"/);
  assert.match(terraform, /OCIR_USERNAME/);
  assert.match(terraform, /OCIR_AUTH_TOKEN/);
  assert.match(terraform, /podman login/);
  assert.match(terraform, /podman build --platform linux\/amd64/);
  assert.match(terraform, /podman push/);
  assert.match(terraform, /resource "oci_core_vcn" "portal"/);
  assert.match(terraform, /resource "oci_core_internet_gateway" "portal"/);
  assert.match(terraform, /resource "oci_core_subnet" "portal_public"/);
  assert.match(terraform, /resource "oci_core_network_security_group" "portal"/);
  assert.match(terraform, /resource "oci_container_instances_container_instance" "portal"/);
  assert.match(terraform, /data "oci_core_vnic" "portal"/);
  assert.match(terraform, /is_public_ip_assigned\s+=\s+true/);
  assert.match(terraform, /image_url\s+=\s+local\.portal_container_image_uri/);
  assert.match(terraform, /HOST\s+=\s+"0\.0\.0\.0"/);
  assert.match(terraform, /OCI_PORTAL_PASSWORD\s+=\s+local\.portal_auth_password/);
  assert.doesNotMatch(terraform, /image_pull_secrets/);
  assert.match(terraform, /read repos in compartment id/);
  assert.match(terraform, /module "hosted_agentic_applications"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/hosted-agentic-applications"/);
  assert.match(terraform, /resource_suffix\s+=\s+var\.resource_suffix/);
  assert.match(terraform, /push_image\s+=\s+var\.hosted_app_push_image/);
  assert.equal((hostedAppTerraform.match(/hosted_image_build_run_id\s+=\s+var\.hosted_image_build_run_id/g) || []).length, 6);
  assert.doesNotMatch(hostedAppTerraform, /push_image\s+=\s+true/);
  assert.match(terraform, /output "resource_suffix"/);
  assert.match(terraform, /output "portal_public_ip"/);
  assert.match(terraform, /output "portal_url"/);
  assert.match(terraform, /output "portal_login_user"/);
  assert.match(terraform, /output "portal_login_password"/);
  assert.match(terraform, /output "portal_runtime_note"/);
  assert.match(readme, /OCI Resource Manager/);
  assert.match(readme, /working directory `infra\/resource-manager-demo`/);
  assert.match(readme, /prebuilt image/);
});

test("startup script captures logs to a directory by default and can disable file capture", () => {
  const script = read("bash.sh");

  assert.match(script, /LOG_CAPTURE_ENABLED="\$\{LOG_CAPTURE_ENABLED:-true\}"/);
  assert.match(script, /LOG_DIR="\$\{LOG_DIR:-logs\}"/);
  assert.match(script, /tee -a "\$LOG_FILE"/);
  assert.match(script, /LOG_CAPTURE_ENABLED=false/);
});

test("server logs feature run lifecycle to console", () => {
  const server = read("server.mjs");

  assert.match(server, /console\.log\(\`\[demo-run\] starting/);
  assert.match(server, /console\.log\(\`\[demo-run\] completed/);
  assert.match(server, /console\.error\(\`\[demo-run\] failed/);
  assert.match(server, /function writeDemoLog/);
  assert.match(server, /logs\/demos/);
  assert.match(server, /writeDemoLog\(featureId/);
  assert.match(server, /writeDemoLog\("n8n-hosted-workflow-automation"/);
  assert.match(server, /logFile/);
  assert.match(server, /"authorization"/);
  assert.match(server, /n8nForwardedCookieHeader/);
  assert.match(server, /portalSessionCookie/);
});

test("infrastructure tab renders all generated OCI runtime components", () => {
  const server = read("server.mjs");
  const main = read("src/main.js");
  const styles = read("src/styles.css");

  assert.match(server, /generated\.file_search_vector_store/);
  assert.match(server, /generated\.file_search_seed_documents/);
  assert.match(server, /generated\.hosted_agent_ocir_repository_id/);
  assert.match(server, /generated\.hosted_agent_ocir_image_count/);
  assert.match(server, /generated\.hosted_agent_application_work_request/);
  assert.match(server, /generated\.hosted_agent_deployment_artifact/);
  assert.match(server, /generated\.langgraph_hosted_agent_ocir_repository_id/);
  assert.match(server, /generated\.langgraph_hosted_agent_deployment_artifact/);
  assert.match(server, /generated\.n8n_hosted_workflow_url/);
  assert.match(server, /generated\.langfuse_hosted_observability_url/);
  assert.match(server, /generated\.openclaw_hosted_gateway_url/);
  assert.match(server, /n8n_hosted_application\.json/);
  assert.match(server, /n8n_hosted_deployment\.json/);
  assert.match(server, /langfuse_hosted_application\.json/);
  assert.match(server, /langfuse_hosted_deployment\.json/);
  assert.match(server, /openclaw_hosted_application\.json/);
  assert.match(server, /openclaw_hosted_deployment\.json/);
  assert.match(server, /OCI n8n hosted application refresh/);
  assert.match(server, /OCI n8n hosted deployment refresh/);
  assert.match(server, /OCI Langfuse hosted application refresh/);
  assert.match(server, /OCI Langfuse hosted deployment refresh/);
  assert.match(server, /OCI OpenClaw hosted application refresh/);
  assert.match(server, /OCI OpenClaw hosted deployment refresh/);
  assert.match(server, /n8nHostedUrl/);
  assert.match(server, /langfuseHostedUrl/);
  assert.match(server, /openclawHostedUrl/);
  assert.match(server, /hostedApplicationInvokeUrl/);
  assert.match(server, /application\.generativeai\.\$\{region\}\.oci\.oraclecloud\.com\/20251112\/hostedApplications/);
  assert.doesNotMatch(server, /IDCS_CLIENT_SECRET=.*[0-9a-f-]{30,}/);
  assert.match(main, /Resources/);
  assert.doesNotMatch(main, /All Provisioned Components/);
  assert.match(main, /renderAllInfrastructureComponents/);
  assert.match(main, /infra-component-search/);
  assert.match(main, /infra-component-type-filter/);
  assert.match(main, /function inferInfrastructureComponentType/);
  assert.match(main, /function applyInfrastructureComponentFilters/);
  assert.match(styles, /\.infra-filter-bar/);
  assert.match(styles, /\.component-row\[hidden\]/);
});

test("run dialog renders user-facing demo brief", () => {
  const server = read("server.mjs");
  const main = read("src/main.js");
  const styles = read("src/styles.css");
  const langfuseWiring = read("docs/wiring/langfuse-hosted-observability.svg");
  const langfuseWiringSource = read("docs/langfuse-demo-wiring.drawio");

  assert.match(server, /function buildRunTrace/);
  assert.match(main, /const demoBriefs/);
  assert.match(main, /function renderRunTrace/);
  assert.match(main, /function showRunNotices/);
  assert.match(main, /function renderLiveLogs/);
  assert.match(main, /run-notice-dialog/);
  assert.match(main, /responses-live-logs/);
  assert.match(main, /responses-code-container-refresh/);
  assert.match(main, /createNewCodeInterpreterContainer/);
  assert.match(main, /demo-details-doc-link/);
  assert.match(main, /demo-details-wiring-link/);
  assert.match(main, /function defaultWiringHref/);
  assert.match(main, /feature\.wiringHref/);
  assert.match(main, /docs\/wiring\/\$\{featureId\}\.svg/);
  assert.match(main, /OCI wiring diagram/);
  assert.match(main, /demo-header-copy/);
  assert.match(main, /action="\/logout"/);
  assert.match(main, /Relevant Output/);
  assert.match(main, /data-output-view="markdown"/);
  assert.match(main, /data-output-view="json"/);
  assert.match(main, /data-more-details-tab/);
  assert.match(main, /Technical details/);
  assert.match(main, /Logs/);
  assert.match(main, /OCI feature code/);
  assert.match(main, /const ociFeatureCodeSnippets/);
  assert.match(main, /function renderMarkdown/);
  assert.match(main, /OCI Enterprise AI architecture canvas/);
  assert.match(main, /Tip: why this OCI AI feature matters/);
  assert.match(main, /const demoTechnicalFlows/);
  assert.match(main, /Technical details/);
  assert.match(main, /Architecture flow/);
  assert.match(main, /Step-by-step OCI flow/);
  assert.match(main, /View raw run details/);
  assert.match(main, /n8n-hosted-workflow-automation/);
  assert.match(main, /langfuse-hosted-observability/);
  assert.match(main, /openclaw-hosted-agent-gateway/);
  assert.match(main, /const hostedUiLaunchDemoIds = \[/);
  assert.match(main, /hostedUiLaunchDemoIds\.includes\(activeDemoId\)/);
  assert.match(main, /hostedUiLaunchDemoIds\.includes\(featureId\)/);
  assert.match(main, /hostedDeploymentStatus/);
  assert.match(main, /Hosted deployment is not active/);
  assert.match(main, /is-launch-demo/);
  assert.match(styles, /\.demo-dialog\.is-launch-demo \.demo-field/);
  assert.match(styles, /\.demo-dialog\.is-launch-demo \.demo-controls label/);
  assert.match(styles, /\.demo-dialog\.is-launch-demo \.demo-output-grid > section:first-child/);
  assert.match(main, /document\.getElementById\("responses-run-button"\)\.textContent = defaults\.button \|\| "Run demo"/);
  assert.doesNotMatch(main, /externalLaunchDemos/);
  assert.match(main, /launchExternalDemo\(activeDemoId\)/);
  assert.match(main, /window\.open\(config\.launchUrl/);
  assert.match(main, /\/api\/openclaw\/launch\//);
  assert.match(main, /\/auth\/sign-in/);
  assert.match(server, /async function proxyN8nLaunch/);
  assert.match(server, /async function proxyLangfuseLaunch/);
  assert.match(server, /isLangfusePassthroughPath/);
  assert.match(server, /\/api\/auth\//);
  assert.match(server, /\/_next\//);
  assert.match(server, /\/assets\//);
  assert.match(server, /rewriteLangfuseLaunchHtml/);
  assert.match(server, /\/favicon\.ico/);
  assert.match(server, /\/icon\.svg/);
  assert.match(server, /rewriteLangfuseLaunchJson/);
  assert.match(server, /http:\/\/0\.0\.0\.0:3000/);
  assert.match(server, /async function getIdcsAccessToken/);
  assert.match(server, /readN8nIdcsLaunchConfig/);
  assert.match(server, /n8n_idcs_client\.json/);
  assert.match(server, /IDCS_CLIENT_SECRET/);
  assert.match(server, /IDCS_TOKEN_URL/);
  assert.match(server, /IDCS rejected the client credentials/);
  assert.match(server, /Authorization: `Bearer \$\{token\}`/);
  assert.match(styles, /\.markdown-output/);
  assert.match(styles, /\.response-output \.relevant-output\.markdown-output/);
  assert.match(styles, /\.relevant-json-output/);
  assert.match(styles, /\.more-details-panel/);
  assert.match(styles, /\.demo-doc-link/);
  assert.match(styles, /\.demo-wiring-link\[hidden\]/);
  assert.match(styles, /\.demo-header-copy/);
  assert.match(styles, /\.output-toggle/);
  assert.match(styles, /background: #05070d/);
  assert.match(styles, /\.run-notice-dialog/);
  assert.match(styles, /\.live-run-logs/);
  assert.match(styles, /\.architecture-canvas/);
  assert.match(styles, /\.canvas-flow/);
  assert.match(styles, /\.canvas-section/);
  assert.match(styles, /\.oci-feature-tip/);
  assert.match(styles, /\.architecture-step/);
  assert.match(server, /"\.drawio": "application\/xml; charset=utf-8"/);
  assert.match(server, /"\.svg": "image\/svg\+xml; charset=utf-8"/);
  assert.match(langfuseWiring, /Langfuse Hosted Observability Demo/);
  assert.match(langfuseWiring, /OCI Hosted Application/);
  assert.match(langfuseWiring, /PostgreSQL/);
  assert.match(langfuseWiring, /ClickHouse/);
  assert.match(langfuseWiring, /Object Storage/);
  assert.match(langfuseWiringSource, /Langfuse Hosted Observability Demo/);
});

test("run dialog hides Code Interpreter container creation outside Code Interpreter demos", () => {
  const styles = read("src/styles.css");
  const main = read("src/main.js");

  assert.match(main, /responses-code-container-refresh-field"\)\.hidden = featureId !== "code-interpreter"/);
  assert.match(styles, /\.demo-controls \.demo-checkbox-field\[hidden\]\s*\{[\s\S]*display: none !important;/);
});
