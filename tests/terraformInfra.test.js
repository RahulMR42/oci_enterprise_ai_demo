import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("file search terraform owns vector store provisioning contract", () => {
  const terraform = read("infra/file-search-vector-store-rag/vector_store.tf");

  assert.match(terraform, /resource "terraform_data" "file_search_vector_store"/);
  assert.match(terraform, /triggers_replace\s+=\s+\[[\s\S]*var\.resource_suffix[\s\S]*var\.oci_genai_project_id/);
  assert.match(terraform, /resource-manager-generated-runtime-files-20260608/);
  assert.match(terraform, /resource "terraform_data" "file_search_seed_documents"/);
  assert.match(terraform, /resource "terraform_data" "file_search_seed_documents"[\s\S]*triggers_replace\s+=\s+\[terraform_data\.file_search_vector_store\.id\]/);
  assert.match(terraform, /from openai import OpenAI/);
  assert.match(terraform, /shared_api_key_file/);
  assert.match(terraform, /shared_project_file/);
  assert.match(terraform, /project=project_id/);
  assert.doesNotMatch(terraform, /Missing OCI signer for Vector Store control-plane create/);
  assert.match(terraform, /existing_vector_store/);
  assert.match(terraform, /client\.vector_stores\.list/);
  assert.match(terraform, /Vector store metadata does not contain an id/);
  assert.match(terraform, /base_url="\$\{self\.input\.openai_base_url\}"/);
  assert.match(terraform, /vector_stores\.create/);
  assert.match(terraform, /client\.files\.create/);
  assert.match(terraform, /existing_seed_document/);
  assert.match(terraform, /client\.vector_stores\.files\.list/);
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
  assert.match(terraform, /triggers_replace\s+=\s+\[[\s\S]*resource-manager-generated-runtime-files-20260608/);
  assert.match(terraform, /containers\.create/);
  assert.match(terraform, /existing_container/);
  assert.match(terraform, /client\.containers\.list/);
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
  assert.match(terraform, /manage repos in compartment id/);
  assert.match(terraform, /compute-container-family/);
  assert.match(terraform, /virtual-network-family/);
  assert.match(terraform, /load-balancers/);
});

test("repository no longer includes n8n demo or provisioning artifacts", () => {
  const repositoryText = [
    read("README.md"),
    read("bash.sh"),
    read("server.mjs"),
    read("src/main.js"),
    read("src/data/aiFeatures.js"),
    read("infra/resource-manager-demo/variables.tf"),
    read("infra/resource-manager-demo/schema.yaml"),
    read("infra/resource-manager-demo/main.tf"),
    read("infra/resource-manager-demo/portal_container.tf"),
    read("infra/devops-hosted-image-build/locals.tf"),
    read("infra/devops-hosted-image-build/main.tf"),
    read("infra/devops-hosted-image-build/scripts/deploy_hosted_application.sh"),
    read("infra/hosted-agentic-applications/locals.tf"),
    read("infra/hosted-agentic-applications/variables.tf"),
    read("infra/hosted-agentic-applications/outputs.tf"),
    read("infra/hosted-agentic-applications/ocir_repositories.tf")
  ].join("\n");

  assert.doesNotMatch(repositoryText, /n8n/i);
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
  assert.match(terraform, /resource "time_sleep" "sql_search_vault_dns"/);
  assert.match(terraform, /resource "oci_kms_key" "sql_search"/);
  assert.match(terraform, /resource "oci_vault_secret" "sql_search_admin_password"/);
  assert.match(terraform, /resource "oci_database_autonomous_database" "sql_search"/);
  assert.match(terraform, /admin_password\s+=\s+random_password\.sql_search_admin\.result/);
  assert.match(terraform, /create_duration\s+=\s+"120s"/);
  assert.match(terraform, /depends_on\s+=\s+\[time_sleep\.sql_search_vault_dns\]/);
  assert.match(terraform, /resource "oci_database_tools_database_tools_connection" "enrichment"/);
  assert.match(terraform, /resource "oci_database_tools_database_tools_connection" "query"/);
  assert.match(terraform, /secret_id\s+=\s+local\.database_password_secret_id/);
  assert.doesNotMatch(terraform, /resource "oci_identity_policy"/);
  assert.doesNotMatch(terraform, /dynamic-group/);
  assert.doesNotMatch(terraform, /policy_group_name/);
  assert.doesNotMatch(terraform, /variable "autonomous_database_admin_password"/);
});

test("portal protected users reuse the nl2sql autonomous database", () => {
  const nl2sqlOutputs = read("infra/nl2sql-sql-search/outputs.tf");
  const resourceManagerMain = read("infra/resource-manager-demo/main.tf");
  const resourceManagerReadme = read("infra/resource-manager-demo/README.md");
  const devopsVariables = read("infra/devops-hosted-image-build/variables.tf");
  const devopsMain = read("infra/devops-hosted-image-build/main.tf");
  const bootstrapBuildSpec = read("infra/devops-hosted-image-build/build_spec_bootstrap_portal_auth_schema.yaml");
  const deployScript = read("infra/devops-hosted-image-build/scripts/deploy_portal_hosted_application.sh");

  assert.match(nl2sqlOutputs, /output "autonomous_database_connection_string"/);
  assert.match(nl2sqlOutputs, /value\s+=\s+local\.sql_search_connection_string/);
  assert.match(nl2sqlOutputs, /output "autonomous_database_id"/);
  assert.match(nl2sqlOutputs, /output "database_user_name"/);
  assert.match(resourceManagerMain, /portal_auth_db_dsn\s+=\s+module\.nl2sql_sql_search\.autonomous_database_connection_string/);
  assert.match(resourceManagerMain, /portal_auth_db_id\s+=\s+module\.nl2sql_sql_search\.autonomous_database_id/);
  assert.match(resourceManagerMain, /portal_auth_db_user\s+=\s+module\.nl2sql_sql_search\.database_user_name/);
  assert.match(resourceManagerMain, /portal_auth_db_password_secret_id\s+=\s+module\.nl2sql_sql_search\.database_password_secret_id/);
  assert.match(devopsVariables, /variable "portal_auth_db_dsn"/);
  assert.match(devopsVariables, /variable "portal_auth_db_id"/);
  assert.match(devopsVariables, /variable "portal_auth_db_password_secret_id"/);
  assert.match(devopsMain, /PORTAL_AUTH_DB_DSN/);
  assert.match(devopsMain, /PORTAL_AUTH_DB_ID/);
  assert.match(devopsMain, /PORTAL_AUTH_DB_PASSWORD_SECRET_ID/);
  assert.match(devopsMain, /bootstrap_portal_auth_schema/);
  assert.match(devopsMain, /build_spec_bootstrap_portal_auth_schema\.yaml/);
  assert.match(devopsMain, /oci_devops_build_pipeline_stage\.deploy_portal[\s\S]*depends_on\s+=\s+\[[\s\S]*oci_devops_build_pipeline_stage\.bootstrap_portal_auth_schema/);
  assert.match(bootstrapBuildSpec, /backend\/portal_auth_store\.py/);
  assert.match(bootstrapBuildSpec, /"action": "init_schema"/);
  assert.match(bootstrapBuildSpec, /PORTAL_AUTH_DB_DSN is required/);
  assert.match(bootstrapBuildSpec, /PORTAL_AUTH_DB_ID is required/);
  assert.match(bootstrapBuildSpec, /PORTAL_AUTH_DB_PASSWORD_SECRET_ID is required/);
  assert.match(bootstrapBuildSpec, /export OCI_PORTAL_AUTH_DB_DSN="\$PORTAL_AUTH_DB_DSN"/);
  assert.match(bootstrapBuildSpec, /export OCI_PORTAL_AUTH_DB_ID="\$PORTAL_AUTH_DB_ID"/);
  assert.match(bootstrapBuildSpec, /export OCI_PORTAL_AUTH_DB_USER="\$\{PORTAL_AUTH_DB_USER:-ADMIN\}"/);
  assert.match(bootstrapBuildSpec, /export OCI_PORTAL_AUTH_DB_PASSWORD_SECRET_ID="\$PORTAL_AUTH_DB_PASSWORD_SECRET_ID"/);
  assert.match(bootstrapBuildSpec, /export OCI_RESOURCE_PRINCIPAL_VERSION="\$\{OCI_RESOURCE_PRINCIPAL_VERSION:-2\.2\}"/);
  assert.match(bootstrapBuildSpec, /export OCI_PORTAL_AUTH_DEBUG="\$\{OCI_PORTAL_AUTH_DEBUG:-public\}"/);
  assert.match(bootstrapBuildSpec, /export PIP_CONFIG_FILE=\/dev\/null/);
  assert.match(bootstrapBuildSpec, /python -m pip --isolated install/);
  assert.match(bootstrapBuildSpec, /json\.loads\(os\.environ\["PORTAL_AUTH_SCHEMA_RESPONSE"\]\)/);
  assert.match(bootstrapBuildSpec, /response\.get\("status"\) != "success"/);
  assert.match(bootstrapBuildSpec, /Portal auth schema bootstrap failed/);
  assert.match(deployScript, /OCI_PORTAL_AUTH_DB_DSN/);
  assert.match(deployScript, /OCI_PORTAL_AUTH_DB_ID/);
  assert.match(deployScript, /PORTAL_AUTH_DB_PASSWORD_SECRET_ID/);
  assert.match(deployScript, /OCI_PORTAL_AUTH_DB_PASSWORD/);
  assert.match(resourceManagerReadme, /bootstrap-portal-auth-schema/);
  assert.match(resourceManagerReadme, /init_schema/);
  assert.doesNotMatch(resourceManagerMain, /module "portal_auth_database"/);
});

test("hosted agent terraform creates OCIR repository and OCI hosted deployment", () => {
  const hostedAppIdcsClient = read("infra/hosted-agentic-applications/hosted_app_idcs_client.tf");
  const terraform = [
    read("infra/hosted-agentic-applications/hosted_application.tf"),
    read("infra/hosted-agentic-applications/langgraph_hosted_application.tf"),
    hostedAppIdcsClient,
    read("infra/hosted-agentic-applications/state_migrations.tf"),
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
  const langfuseDockerfile = read("apps/hosted-langfuse/Dockerfile");
  const openclawDockerfile = read("apps/hosted-openclaw/Dockerfile");
  const openclawServer = read("apps/hosted-openclaw/server.mjs");
  const llamaIndexDockerfile = read("apps/hosted-llamaindex-control-tower/Dockerfile");
  const langgraphApp = read("apps/hosted-langgraph-agent/app.py");
  const llamaIndexApp = read("apps/hosted-llamaindex-control-tower/app.py");
  const hostedDeployScript = read("infra/devops-hosted-image-build/scripts/deploy_hosted_application.sh");

  assert.match(terraform, /resource "terraform_data" "hosted_agentic_application"/);
  assert.match(terraform, /resource "terraform_data" "langgraph_hosted_agentic_application"/);
  assert.match(terraform, /resource "terraform_data" "langfuse_hosted_observability"/);
  assert.match(terraform, /resource "terraform_data" "openclaw_hosted_agent_gateway"/);
  assert.match(terraform, /resource "terraform_data" "llamaindex_control_tower"/);
  assert.match(terraform, /resource "oci_artifacts_container_repository" "hosted_agent"/);
  assert.match(terraform, /resource "oci_artifacts_container_repository" "langgraph"/);
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
  assert.match(terraform, /resource "oci_identity_domains_app" "hosted_app_launch_client"/);
  assert.match(terraform, /hosted UI launch proxies/);
  assert.match(terraform, /is_oauth_client\s+=\s+true/);
  assert.match(terraform, /client_type\s+=\s+"confidential"/);
  assert.match(terraform, /when\s+=\s+destroy/);
  assert.match(terraform, /oci identity-domains app patch/);
  assert.doesNotMatch(hostedAppIdcsClient, /identity-domains app patch[\s\S]*--auth resource_principal/);
  assert.match(terraform, /"path":"active","value":false/);
  assert.match(terraform, /hosted_app_idcs_allowed_grants\s+=\s+length\(local\.hosted_app_idcs_redirect_uris\) > 0 \? \["client_credentials", "authorization_code"\] : \["client_credentials"\]/);
  assert.match(terraform, /allowed_grants\s+=\s+local\.hosted_app_idcs_allowed_grants/);
  assert.match(terraform, /redirect_uris\s+=\s+local\.hosted_app_idcs_redirect_uris/);
  assert.match(terraform, /hosted_app_idcs_client\.json/);
  assert.match(terraform, /HOSTED_APP_IDCS_CLIENT_SECRET = oci_identity_domains_app\.hosted_app_launch_client\[0\]\.client_secret/);
  assert.match(terraform, /hosted_app_idcs_launch_client_id/);
  assert.match(terraform, /terraform_data\.hosted_app_idcs_launch_client_metadata/);
  assert.match(terraform, /oci artifacts container repository create/);
  assert.match(terraform, /langgraph_hosted_agent\.json/);
  assert.match(terraform, /langgraph_hosted_application\.json/);
  assert.match(terraform, /langgraph_hosted_deployment\.json/);
  assert.match(terraform, /langgraph_ocir_repository\.json/);
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
  assert.match(terraform, /langfuse-hosted-observability/);
  assert.match(terraform, /openclaw-hosted-agent-gateway/);
  assert.match(terraform, /agentic-control-tower/);
  assert.match(terraform, /variable "container_cli"/);
  assert.match(terraform, /variable "ocir_region_key"/);
  assert.match(terraform, /variable "langfuse_image_repository_uri"/);
  assert.match(terraform, /variable "langfuse_database_url"/);
  assert.match(terraform, /variable "langfuse_clickhouse_url"/);
  assert.match(terraform, /variable "langfuse_redis_connection_string"/);
  assert.match(terraform, /variable "langfuse_s3_event_upload_bucket"/);
  assert.match(terraform, /variable "openclaw_image_repository_uri"/);
  assert.match(terraform, /variable "llamaindex_image_repository_uri"/);
  assert.match(terraform, /variable "llamaindex_app_source_dir"/);
  assert.match(terraform, /variable "openclaw_gateway_token"/);
  assert.match(terraform, /variable "hosted_app_idcs_launch_client_enabled"/);
  assert.match(terraform, /variable "hosted_app_idcs_scope"/);
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
  assert.match(langfuseDockerfile, /FROM docker\.io\/langfuse\/langfuse:3/);
  assert.match(langfuseDockerfile, /HOSTNAME=0\.0\.0\.0/);
  assert.match(langfuseDockerfile, /PORT=3000/);
  assert.match(langfuseDockerfile, /EXPOSE 3000/);
  assert.match(openclawDockerfile, /FROM docker\.io\/library\/node:22-alpine/);
  assert.match(openclawDockerfile, /OPENCLAW_GATEWAY_BIND=lan/);
  assert.match(openclawDockerfile, /OPENCLAW_GATEWAY_PORT=8080/);
  assert.match(openclawDockerfile, /PORT=8080/);
  assert.match(openclawDockerfile, /COPY server\.mjs \./);
  assert.match(openclawDockerfile, /CMD \["node", "server\.mjs"\]/);
  assert.match(openclawDockerfile, /EXPOSE 8080/);
  assert.match(openclawServer, /runtime: "openclaw-hosted-gateway"/);
  assert.match(hostedDeployScript, /"name":"OPENCLAW_GATEWAY_PORT","type":"PLAINTEXT","value":"8080"/);
  assert.match(llamaIndexDockerfile, /requirements\.txt/);
  assert.match(llamaIndexDockerfile, /EXPOSE 8080/);
  assert.match(read("apps/hosted-agent/app.py"), /\/\.well-known\/agent-card\.json/);
  assert.match(read("apps/hosted-agent/app.py"), /\/a2a\/tasks/);
  assert.match(langgraphApp, /\/\.well-known\/agent-card\.json/);
  assert.match(langgraphApp, /\/a2a\/tasks/);
  assert.match(langgraphApp, /from langgraph\.graph import END, StateGraph/);
  assert.match(langgraphApp, /\/agent\/langgraph-mcp\/respond/);
  assert.match(llamaIndexApp, /from llama_index\.core\.workflow import Event, StartEvent, StopEvent, Workflow, step/);
  assert.match(llamaIndexApp, /except ModuleNotFoundError/);
  assert.match(llamaIndexApp, /deterministic_workflow/);
  assert.match(llamaIndexApp, /\/agent\/control-tower\/respond/);
});

test("startup script provisions selected demo modules and exports generated runtime ids", () => {
  const script = read("bash.sh");

  assert.match(script, /PROVISION_DEMOS/);
  assert.match(script, /conversation-store,file-search-vector-store-rag,code-interpreter,nl2sql-sql-search,hosted-agentic-applications/);
  assert.match(script, /REQUIRE_DEMO_INFRA="\$\{REQUIRE_DEMO_INFRA:-true\}"/);
  assert.match(script, /PROVISION_SHARED_INFRA="\$\{PROVISION_SHARED_INFRA:-true\}"/);
  assert.match(script, /apply_shared_module/);
  assert.match(script, /infra\/shared-demo-security/);
  assert.match(script, /OCI_TENANCY_ID/);
  assert.match(script, /apply_demo_module/);
  assert.match(script, /conversation-store/);
  assert.match(script, /file-search-vector-store-rag/);
  assert.match(script, /code-interpreter/);
  assert.match(script, /nl2sql-sql-search/);
  assert.match(script, /hosted-agentic-applications/);
  assert.doesNotMatch(script, /TF_VAR_autonomous_database_admin_password/);
  assert.doesNotMatch(script, /OCI_SQL_SEARCH_DB_PASSWORD_SECRET_ID/);
  assert.doesNotMatch(script, /OCI_SQL_SEARCH_POLICY_GROUP_NAME/);
  assert.match(script, /OCI_GENAI_VECTOR_STORE_ID/);
  assert.match(script, /OCI_GENAI_CONVERSATION_ID/);
  assert.match(script, /OCI_GENAI_CODE_INTERPRETER_CONTAINER/);
});

test("startup script passes active hosted app provisioning inputs only", () => {
  const script = read("bash.sh");

  assert.match(script, /-var="langfuse_image_repository_uri=\$\{OCI_HOSTED_LANGFUSE_IMAGE_REPOSITORY_URI:-\}"/);
  assert.match(script, /-var="langfuse_database_url=\$\{LANGFUSE_DATABASE_URL:-\}"/);
  assert.match(script, /-var="langfuse_clickhouse_url=\$\{LANGFUSE_CLICKHOUSE_URL:-\}"/);
  assert.match(script, /-var="langfuse_redis_connection_string=\$\{LANGFUSE_REDIS_CONNECTION_STRING:-\}"/);
  assert.match(script, /-var="langfuse_s3_event_upload_bucket=\$\{LANGFUSE_S3_EVENT_UPLOAD_BUCKET:-\}"/);
  assert.match(script, /-var="openclaw_image_repository_uri=\$\{OCI_HOSTED_OPENCLAW_IMAGE_REPOSITORY_URI:-\}"/);
  assert.match(script, /-var="llamaindex_image_repository_uri=\$\{OCI_HOSTED_LLAMAINDEX_IMAGE_REPOSITORY_URI:-\}"/);
  assert.doesNotMatch(script, /N8N|n8n/);
});

test("startup script can destroy all Terraform modules in cleanup order", () => {
  const script = read("bash.sh");

  assert.match(script, /DESTROY_INFRA/);
  assert.match(script, /DESTROY_DEMOS="\$\{DESTROY_DEMOS:-hosted-agentic-applications,nl2sql-sql-search,code-interpreter,file-search-vector-store-rag,conversation-store\}"/);
  assert.match(script, /destroy_demo_module/);
  assert.match(script, /destroy_shared_module/);
  assert.match(script, /terraform -chdir="\$module_path" destroy -auto-approve/);
  assert.match(script, /terraform -chdir=infra\/responses-api destroy -auto-approve/);
  assert.match(script, /Infrastructure cleanup complete\./);
  assert.match(script, /exit 0/);
});

test("conversation store terraform provisions an OCI Conversations API object", () => {
  const terraform = [
    read("infra/conversation-store/variables.tf"),
    read("infra/conversation-store/conversation.tf"),
    read("infra/conversation-store/outputs.tf")
  ].join("\n");

  assert.match(terraform, /resource "terraform_data" "conversation_store"/);
  assert.match(terraform, /resource "terraform_data" "conversation_store"[\s\S]*triggers_replace\s+=\s+\[[\s\S]*var\.resource_suffix[\s\S]*var\.oci_genai_project_id/);
  assert.match(terraform, /resource "terraform_data" "conversation_store"[\s\S]*resource-manager-generated-runtime-files-20260608/);
  assert.match(terraform, /client\.conversations\.create/);
  assert.match(terraform, /existing_conversation/);
  assert.match(terraform, /client\.conversations\.list/);
  assert.match(terraform, /client\.conversations\.delete/);
  assert.match(terraform, /OCI_GENAI_CONVERSATION_ID/);
  assert.match(terraform, /conversation\.json/);
  assert.match(terraform, /oci_genai_project_id/);
  assert.match(terraform, /oci_genai_api_key/);
});

test("resource manager aggregate stack covers all Terraform deployment modules", () => {
  const terraform = [
    read("infra/resource-manager-demo/versions.tf"),
    read("infra/resource-manager-demo/variables.tf"),
    read("infra/resource-manager-demo/schema.yaml"),
    read("infra/resource-manager-demo/main.tf"),
    read("infra/resource-manager-demo/portal_container.tf"),
    read("infra/resource-manager-demo/outputs.tf"),
    read("infra/conversation-store/variables.tf"),
    read("infra/conversation-store/conversation.tf"),
    read("infra/shared-demo-security/identity.tf"),
    read("infra/file-search-vector-store-rag/variables.tf"),
    read("infra/file-search-vector-store-rag/vector_store.tf"),
    read("infra/code-interpreter/variables.tf"),
    read("infra/code-interpreter/container.tf"),
    read("infra/devops-hosted-image-build/variables.tf"),
    read("infra/devops-hosted-image-build/locals.tf"),
    read("infra/devops-hosted-image-build/main.tf"),
    read("infra/devops-hosted-image-build/outputs.tf"),
    read("infra/devops-hosted-image-build/build_spec_images.yaml"),
    read("infra/devops-hosted-image-build/build_spec_image_hosted.yaml"),
    read("infra/devops-hosted-image-build/build_spec_image_langgraph.yaml"),
    read("infra/devops-hosted-image-build/build_spec_image_langfuse.yaml"),
    read("infra/devops-hosted-image-build/build_spec_image_openclaw.yaml"),
    read("infra/devops-hosted-image-build/build_spec_image_llamaindex.yaml"),
    read("infra/devops-hosted-image-build/build_spec_image_portal.yaml"),
    read("infra/devops-hosted-image-build/build_spec_deploy_hosted.yaml"),
    read("infra/devops-hosted-image-build/build_spec_deploy_langgraph.yaml"),
    read("infra/devops-hosted-image-build/build_spec_deploy_langfuse.yaml"),
    read("infra/devops-hosted-image-build/build_spec_deploy_openclaw.yaml"),
    read("infra/devops-hosted-image-build/build_spec_deploy_llamaindex.yaml"),
    read("infra/devops-hosted-image-build/build_spec_provision_generated_runtime.yaml"),
    read("infra/devops-hosted-image-build/build_spec_deploy_portal.yaml"),
    read("infra/devops-hosted-image-build/scripts/deploy_hosted_application.sh"),
    read("infra/devops-hosted-image-build/scripts/provision_generated_runtime.py"),
    read("infra/devops-hosted-image-build/scripts/deploy_portal_hosted_application.sh")
  ].join("\n");
  const readme = read("infra/resource-manager-demo/README.md");
  const deployDocs = read("docs/deployment/resource-manager-one-click.md");
  const releaseWorkflow = read(".github/workflows/release-resource-manager-stack.yml");
  const devopsLocals = read("infra/devops-hosted-image-build/locals.tf");
  const hostedAppTerraform = [
    read("infra/hosted-agentic-applications/hosted_application.tf"),
    read("infra/hosted-agentic-applications/langgraph_hosted_application.tf"),
    read("infra/hosted-agentic-applications/langfuse_hosted_application.tf"),
    read("infra/hosted-agentic-applications/openclaw_hosted_application.tf"),
    read("infra/hosted-agentic-applications/llamaindex_control_tower_hosted_application.tf")
  ].join("\n");

  assert.match(terraform, /module "responses_api"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/responses-api"/);
  assert.match(terraform, /module "conversation_store"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/conversation-store"/);
  assert.match(terraform, /conversation_store_local_exec_enabled/);
  assert.match(terraform, /portal_conversation_id/);
  assert.match(terraform, /conversationId/);
  assert.match(terraform, /file_search_local_exec_enabled"[\s\S]*default\s+=\s+false/);
  assert.match(terraform, /code_interpreter_local_exec_enabled"[\s\S]*default\s+=\s+false/);
  assert.match(terraform, /module "shared_demo_security"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/shared-demo-security"/);
  assert.match(terraform, /module "file_search_vector_store_rag"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/file-search-vector-store-rag"/);
  assert.match(terraform, /module "code_interpreter"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/code-interpreter"/);
  assert.match(terraform, /module "conversation_store"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/conversation-store"/);
  assert.match(terraform, /module "guardrails"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/guardrails"/);
  assert.match(terraform, /module "nl2sql_sql_search"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/nl2sql-sql-search"/);
  assert.match(terraform, /module "devops_hosted_image_build"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/devops-hosted-image-build"/);
  assert.match(terraform, /variable "devops_repository_branch"/);
  assert.match(terraform, /variable "deploy_only_app"/);
  assert.match(terraform, /variable "existing_hosted_deployment_exports_json"/);
  assert.match(terraform, /variable "existing_portal_runtime_config_json"/);
  assert.doesNotMatch(terraform, /variable "devops_ocir_username"/);
  assert.doesNotMatch(terraform, /variable "devops_ocir_auth_token"/);
  assert.doesNotMatch(terraform, /variable "ocir_username"/);
  assert.doesNotMatch(terraform, /variable "ocir_auth_token"/);
  assert.match(terraform, /file_search_local_exec_enabled:[\s\S]*OCI DevOps creates or reuses the Vector Store/);
  assert.match(terraform, /conversation_store_local_exec_enabled:[\s\S]*OCI DevOps creates or reuses the OCI Conversations API object/);
  assert.match(terraform, /code_interpreter_local_exec_enabled:[\s\S]*OCI DevOps creates or reuses the Code Interpreter container/);
  assert.match(terraform, /DEPLOY_ONLY_APP/);
  assert.match(terraform, /variable "devops_source_branch"[\s\S]*default\s+=\s+"oci-rms"/);
  assert.match(terraform, /schemaVersion: 1\.1\.0/);
  assert.match(terraform, /devops_source_branch:[\s\S]*default: oci-rms/);
  assert.match(terraform, /deploy_only_app:[\s\S]*default: false/);
  assert.match(terraform, /existing_hosted_deployment_exports_json:[\s\S]*type: text/);
  assert.match(terraform, /existing_portal_runtime_config_json:[\s\S]*type: text/);
  assert.doesNotMatch(terraform, /devops_ocir_username:/);
  assert.doesNotMatch(terraform, /devops_ocir_auth_token:/);
  assert.doesNotMatch(deployDocs, /OCIR username|OCIR auth token/);
  assert.match(terraform, /devops_source_revision:[\s\S]*pattern: "\^\$\|\^\[A-Fa-f0-9\]\{7,40\}\$"/);
  assert.match(terraform, /validation\s+\{[\s\S]*resource_suffix[\s\S]*\^\[a-z0-9\]\{6\}\$/);
  assert.match(terraform, /validation\s+\{[\s\S]*contains\(\["GITHUB", "DEVOPS_CODE_REPOSITORY"\]/);
  assert.match(terraform, /portal_auth_password_secret_id must be a valid OCI Vault secret OCID/);
  assert.match(terraform, /devops_repository_branch\s+=\s+var\.devops_repository_branch/);
  assert.match(terraform, /resource "oci_devops_project" "this"/);
  assert.match(terraform, /resource "oci_devops_build_pipeline" "this"/);
  assert.match(terraform, /resource "oci_devops_build_pipeline_stage" "build"/);
  assert.match(terraform, /count = var\.enabled && !local\.effective_deploy_only_app \? 1 : 0/);
  assert.match(terraform, /display_name\s+=\s+"build-hosted-images"/);
  assert.match(terraform, /build_spec_file\s+=\s+"infra\/devops-hosted-image-build\/build_spec_images\.yaml"/);
  assert.match(terraform, /source_package_revision\s+=\s+sha256/);
  assert.match(terraform, /filesha256\("\$\{local\.source_package_root\}\//);
  assert.match(terraform, /terraform_data" "seed_devops_repository"[\s\S]*local\.source_package_revision/);
  assert.match(terraform, /name\s+=\s+"SOURCE_PACKAGE_REVISION"[\s\S]*value = local\.source_package_revision/);
  assert.match(terraform, /resource "oci_devops_build_pipeline_stage" "build_image"/);
  assert.match(terraform, /resource "oci_devops_deploy_artifact" "image"/);
  assert.match(terraform, /resource "oci_devops_build_pipeline_stage" "deliver_image"/);
  assert.match(terraform, /resource "oci_devops_build_pipeline_stage" "deploy_hosted"/);
  assert.match(terraform, /selected_hosted_application_deployments\s+=\s+\{/);
  assert.match(terraform, /deploy_all_hosted_applications\s+=\s+trimspace\(var\.app_deploy\) == "" \|\| lower\(var\.app_deploy\) == "all"/);
  assert.match(terraform, /effective_deploy_only_app\s+=\s+local\.deploy_all_hosted_applications \? false : var\.deploy_only_app/);
  assert.match(terraform, /app_deploy_pipeline_value\s+=\s+local\.deploy_all_hosted_applications \? "all" : "none"/);
  assert.match(terraform, /deploy_only_app_pipeline_value\s+=\s+local\.effective_deploy_only_app \? "true" : "false"/);
  assert.match(devopsLocals, /selected_hosted_image_artifacts\s+=\s+\{/);
  assert.match(devopsLocals, /selected_hosted_image_artifacts\s+=\s+\{[\s\S]*if key != "portal"/);
  assert.doesNotMatch(devopsLocals, /selected_hosted_image_artifacts\s+=\s+\{[\s\S]*!var\.deploy_only_app/);
  assert.doesNotMatch(devopsLocals, /selected_hosted_image_artifacts\s+=\s+\{[\s\S]*contains\(keys\(local\.selected_hosted_application_deployments\), key\)/);
  assert.doesNotMatch(devopsLocals, /if key != "portal" && \(var\.deploy_only_app \|\| contains/);
  assert.match(terraform, /selected_image_artifacts\s+=\s+merge\(/);
  assert.match(terraform, /name\s+=\s+"DEPLOY_ONLY_APP"[\s\S]*default_value = local\.deploy_only_app_pipeline_value/);
  assert.match(terraform, /name\s+=\s+"APP_DEPLOY"[\s\S]*default_value = local\.app_deploy_pipeline_value/);
  assert.match(terraform, /name\s+=\s+"APP_DEPLOY"[\s\S]*value = local\.app_deploy_pipeline_value/);
  assert.match(terraform, /for_each = var\.enabled \? local\.selected_image_artifacts : \{\}/);
  assert.match(terraform, /for_each = var\.enabled \? local\.hosted_application_deployments : \{\}/);
  assert.match(terraform, /id = contains\(keys\(oci_devops_build_pipeline_stage\.deliver_image\), each\.key\) \? oci_devops_build_pipeline_stage\.deliver_image\[each\.key\]\.id : oci_devops_build_pipeline\.this\[0\]\.id/);
  assert.doesNotMatch(terraform, /for_each = var\.deploy_only_app \? \{\} : oci_devops_build_pipeline_stage\.deploy_hosted/);
  assert.match(terraform, /for_each = oci_devops_build_pipeline_stage\.deploy_hosted/);
  assert.match(terraform, /variable "app_deploy"/);
  assert.match(terraform, /variable "oci_ha_hosted_agent_deploy"/);
  assert.match(terraform, /variable "oci_ha_langgraph_deploy"/);
  assert.match(terraform, /variable "oci_ha_langfuse_deploy"[\s\S]*default\s+=\s+false/);
  assert.match(terraform, /variable "deploy_langfuse_hosted_application"[\s\S]*default\s+=\s+false/);
  assert.match(terraform, /variable "oci_ha_openclaw_deploy"/);
  assert.match(terraform, /variable "oci_ha_llamaindex_deploy"/);
  assert.match(terraform, /app_deploy:[\s\S]*title: APP_DEPLOY/);
  assert.match(terraform, /app_deploy:[\s\S]*default: all/);
  assert.match(terraform, /oci_ha_langfuse_deploy:[\s\S]*default: false/);
  assert.match(terraform, /codeSourceRepoUrl\s+=\s+var\.devops_source_repo_url/);
  assert.match(terraform, /codeSourceBranch\s+=\s+var\.devops_source_branch/);
  assert.match(terraform, /devopsHostedImageBuildRunId\s+=\s+module\.devops_hosted_image_build\.build_run_id/);
  assert.match(terraform, /devopsHostedImageBuildPipelineId\s+=\s+module\.devops_hosted_image_build\.build_pipeline_id/);
  assert.match(terraform, /portal\s+=\s+"enterprise-ai-demo\/portal-rm"/);
  assert.match(terraform, /artifact_name\s+=\s+"portal-image"/);
  assert.match(terraform, /build_spec_file\s+=\s+"infra\/devops-hosted-image-build\/build_spec_image_portal\.yaml"/);
  assert.match(terraform, /build_spec_deploy_portal\.yaml/);
  assert.match(terraform, /build_spec_provision_generated_runtime\.yaml/);
  assert.match(terraform, /resource "oci_devops_build_pipeline_stage" "provision_generated_runtime"/);
  assert.match(terraform, /display_name\s+=\s+"provision-generated-runtime"/);
  assert.match(terraform, /id\s+=\s+oci_devops_build_pipeline_stage\.provision_generated_runtime\[0\]\.id/);
  assert.match(terraform, /resource "oci_devops_build_pipeline_stage" "deploy_portal"/);
  assert.match(terraform, /display_name\s+=\s+"deploy-portal-hosted-application"/);
  assert.match(terraform, /id\s+=\s+oci_devops_build_pipeline_stage\.deliver_image\["portal"\]\.id/);
  assert.match(terraform, /Legacy build stage retained for OCI DevOps state compatibility/);
  assert.match(terraform, /podman build --platform linux\/amd64 -t portal-image/);
  assert.match(terraform, /resource "oci_artifacts_container_repository" "portal"/);
  assert.match(terraform, /resource "oci_objectstorage_bucket" "portal_config"/);
  assert.match(terraform, /resource "oci_objectstorage_object" "portal_runtime_config"/);
  assert.match(terraform, /resource "terraform_data" "portal_runtime_config_generated_values"/);
  assert.match(terraform, /PORTAL_RUNTIME_CONFIG_JSON/);
  assert.match(terraform, /PORTAL_CONVERSATION_ID/);
  assert.match(terraform, /OCI_GENAI_CONVERSATION_ID/);
  assert.match(terraform, /retained_generated_runtime_config/);
  assert.match(terraform, /conversation_store_generated_file/);
  assert.match(terraform, /file_search_vector_store_generated_file/);
  assert.match(terraform, /Prepared portal runtime config generated keys:/);
  assert.match(terraform, /Skipping portal runtime config generated Object Storage update/);
  assert.match(terraform, /terraform_data" "portal_runtime_config_generated_values"[\s\S]*depends_on\s+=\s+\[[\s\S]*oci_objectstorage_object\.portal_runtime_config[\s\S]*module\.conversation_store[\s\S]*module\.file_search_vector_store_rag/);
  assert.match(terraform, /resource "oci_objectstorage_object" "portal_run_history"/);
  assert.match(terraform, /variable "portal_container_repository_id"/);
  assert.match(terraform, /var\.portal_container_repository_id != ""/);
  assert.match(terraform, /try\(oci_artifacts_container_repository\.portal\[0\]\.id, ""\)/);
  assert.match(terraform, /variable "portal_auth_password_secret_id"/);
  assert.match(terraform, /portal_auth_password_secret_id\s+=\s+var\.portal_auth_password_secret_id/);
  assert.match(terraform, /PORTAL_AUTH_PASSWORD_SECRET_ID/);
  assert.match(terraform, /OCI_GENAI_API_KEY_SECRET_ID/);
  assert.match(terraform, /OCI_HOSTED_APP_IDCS_CLIENT_SECRET_ID/);
  assert.match(terraform, /deploy_portal_hosted_application\.sh/);
  assert.match(terraform, /create_or_update_portal_hosted_application/);
  assert.match(terraform, /NO_AUTH_CONFIG/);
  assert.match(terraform, /"type": "VAULT"/);
  assert.match(terraform, /PORTAL_HOSTED_APPLICATION_ID/);
  assert.match(terraform, /PORTAL_HOSTED_DEPLOYMENT_ID/);
  assert.match(terraform, /PORTAL_URL/);
  assert.match(terraform, /shared_policy_id\s+=\s+module\.shared_demo_security\.policy_id/);
  assert.match(terraform, /build_pipeline_stage_type\s+=\s+"DELIVER_ARTIFACT"/);
  assert.match(terraform, /deploy_artifact_type\s+=\s+"DOCKER_IMAGE"/);
  assert.match(terraform, /argument_substitution_mode\s+=\s+"NONE"/);
  assert.match(terraform, /artifact_name\s+=\s+each\.value\.artifact_name/);
  assert.match(terraform, /hosted_application_deployments\s+=\s+\{/);
  assert.match(terraform, /build_spec_file\s+=\s+each\.value\.build_spec_file/);
  assert.match(terraform, /display_name\s+=\s+each\.value\.stage_name/);
  assert.match(terraform, /id\s+=\s+oci_devops_build_pipeline_stage\.build_image\[each\.key\]\.id/);
  assert.match(terraform, /id\s+=\s+contains\(keys\(oci_devops_build_pipeline_stage\.deliver_image\), each\.key\)/);
  assert.match(terraform, /build_spec_deploy_hosted\.yaml/);
  assert.match(terraform, /build_spec_deploy_langgraph\.yaml/);
  assert.match(terraform, /build_spec_deploy_langfuse\.yaml/);
  assert.match(terraform, /build_spec_deploy_openclaw\.yaml/);
  assert.match(terraform, /build_spec_deploy_llamaindex\.yaml/);
  assert.match(terraform, /\. infra\/devops-hosted-image-build\/scripts\/deploy_hosted_application\.sh HOSTED_AGENT/);
  assert.match(terraform, /\. infra\/devops-hosted-image-build\/scripts\/deploy_hosted_application\.sh LANGGRAPH/);
  assert.match(terraform, /\. infra\/devops-hosted-image-build\/scripts\/deploy_hosted_application\.sh LANGFUSE/);
  assert.match(terraform, /\. infra\/devops-hosted-image-build\/scripts\/deploy_hosted_application\.sh OPENCLAW/);
  assert.match(terraform, /\. infra\/devops-hosted-image-build\/scripts\/deploy_hosted_application\.sh LLAMAINDEX/);
  assert.match(terraform, /DEPLOY_ONLY_APP/);
  assert.match(terraform, /\$\{deploy_only_app,,\}" = "true"/);
  assert.match(terraform, /Skipping \$\{HOSTED_APP_KEY\} hosted deployment because \$\{reason\}\./);
  assert.match(terraform, /skip_hosted_deployment "DEPLOY_ONLY_APP is true"/);
  assert.match(terraform, /export "\$\{url_var\}="/);
  assert.match(terraform, /export "\$\{deployment_var\}="/);
  assert.doesNotMatch(terraform, /for_each = oci_devops_build_pipeline_stage\.deliver_image[\s\S]*items\.value\.id/);
  assert.match(terraform, /resource "oci_devops_build_run" "this"/);
  assert.match(terraform, /name\s+=\s+"DEPLOY_ONLY_APP"[\s\S]*value\s+=\s+local\.deploy_only_app_pipeline_value/);
  assert.match(terraform, /for build_output in try\(oci_devops_build_run\.this\[0\]\.build_outputs, \[\]\)/);
  assert.match(terraform, /jsondecode\(var\.existing_hosted_deployment_exports_json\)/);
  assert.match(terraform, /non_empty_current_hosted_deployment_exports/);
  assert.match(terraform, /selected_hosted_deployment_export_keys/);
  assert.match(terraform, /retained_existing_hosted_deployment_exports/);
  assert.match(terraform, /contains\(local\.selected_hosted_deployment_export_keys, key\)/);
  assert.match(terraform, /merge\([\s\S]*local\.default_hosted_deployment_exports[\s\S]*local\.retained_existing_hosted_deployment_exports[\s\S]*local\.non_empty_current_hosted_deployment_exports[\s\S]*\)/);
  assert.match(terraform, /portal_runtime_config_bucket\s+=\s+oci_objectstorage_bucket\.portal_config\[0\]\.name/);
  assert.match(terraform, /portal_runtime_config_object\s+=\s+"portal-runtime-config\.json"/);
  assert.match(terraform, /portal_run_history_object\s+=\s+"portal-demo-run-summary\.json"/);
  assert.match(terraform, /content\s+=\s+jsonencode\(local\.portal_runtime_config\)/);
  assert.match(terraform, /ignore_changes\s+=\s+\[content\]/);
  assert.match(terraform, /timeouts\s+\{[\s\S]*create\s+=\s+"90m"[\s\S]*\}/);
  assert.match(terraform, /resource "oci_ons_notification_topic" "this"/);
  assert.match(terraform, /resource "oci_logging_log_group" "devops"/);
  assert.match(terraform, /resource "oci_logging_log" "devops"/);
  assert.match(terraform, /category\s+=\s+"all"/);
  assert.match(terraform, /podman build --platform linux\/amd64/);
  assert.doesNotMatch(terraform, /podman push/);
  assert.match(terraform, /default_branch\s+=\s+var\.devops_repository_branch/);
  assert.match(terraform, /git clone --branch '\$\{self\.input\.source_branch\}'/);
  assert.match(terraform, /HEAD:refs\/heads\/\$\{self\.input\.devops_repository_branch\}/);
  assert.match(terraform, /branch\s+=\s+var\.create_devops_repository \? var\.devops_repository_branch : var\.source_branch/);
  assert.doesNotMatch(terraform, /resource "oci_core_vcn" "portal"/);
  assert.doesNotMatch(terraform, /resource "oci_core_internet_gateway" "portal"/);
  assert.doesNotMatch(terraform, /resource "oci_core_nat_gateway" "portal"/);
  assert.doesNotMatch(terraform, /resource "oci_core_subnet" "portal_public"/);
  assert.doesNotMatch(terraform, /resource "oci_core_subnet" "portal_private"/);
  assert.doesNotMatch(terraform, /resource "oci_core_network_security_group" "portal"/);
  assert.doesNotMatch(terraform, /resource "oci_core_network_security_group" "portal_lb"/);
  assert.doesNotMatch(terraform, /resource "oci_load_balancer_load_balancer" "portal"/);
  assert.doesNotMatch(terraform, /resource "oci_load_balancer_backend_set" "portal"/);
  assert.doesNotMatch(terraform, /resource "oci_load_balancer_listener" "portal_http"/);
  assert.doesNotMatch(terraform, /resource "oci_load_balancer_backend" "portal"/);
  assert.doesNotMatch(terraform, /resource "oci_container_instances_container_instance" "portal"/);
  assert.doesNotMatch(terraform, /data "oci_core_vnic" "portal"/);
  assert.doesNotMatch(terraform, /destination\s+=\s+var\.portal_private_subnet_cidr/);
  assert.doesNotMatch(terraform, /network_entity_id\s+=\s+oci_core_nat_gateway\.portal\[0\]\.id/);
  assert.doesNotMatch(terraform, /default_backend_set_name\s+=\s+oci_load_balancer_backend_set\.portal\[0\]\.name/);
  assert.doesNotMatch(terraform, /portal_private_subnet_id\s+=/);
  assert.doesNotMatch(terraform, /portal_network_security_group_id\s+=/);
  assert.doesNotMatch(terraform, /portal_load_balancer_id\s+=/);
  assert.doesNotMatch(terraform, /portal_backend_set_name\s+=/);
  assert.doesNotMatch(terraform, /PORTAL_PRIVATE_SUBNET_ID/);
  assert.doesNotMatch(terraform, /PORTAL_NETWORK_SECURITY_GROUP_ID/);
  assert.doesNotMatch(terraform, /PORTAL_LOAD_BALANCER_ID/);
  assert.doesNotMatch(terraform, /PORTAL_BACKEND_SET_NAME/);
  assert.match(terraform, /PORTAL_RUNTIME_CONFIG_BUCKET/);
  assert.doesNotMatch(terraform, /name\s+=\s+"PORTAL_AUTH_PASSWORD"/);
  assert.match(terraform, /variable "oci_genai_project_id"/);
  assert.match(terraform, /variable "oci_genai_api_key"/);
  assert.match(terraform, /oci_genai_project_id\s+=\s+var\.oci_genai_project_id/);
  assert.match(terraform, /oci_genai_api_key\s+=\s+var\.oci_genai_api_key/);
  assert.match(terraform, /plain\("OCI_GENAI_REGION", os\.environ\["OCI_REGION"\]\)/);
  assert.match(terraform, /plain\("OCI_GENAI_PROJECT_ID", os\.getenv\("OCI_GENAI_PROJECT_ID", ""\)\)/);
  assert.match(terraform, /value = var\.portal_vector_store_id != null && var\.portal_vector_store_id != "" \? var\.portal_vector_store_id : " "/);
  assert.match(terraform, /value = var\.portal_code_interpreter_container_id != null && var\.portal_code_interpreter_container_id != "" \? var\.portal_code_interpreter_container_id : " "/);
  assert.doesNotMatch(terraform, /ocir_username\s+=\s+var\.devops_ocir_username/);
  assert.doesNotMatch(terraform, /ocir_auth_token\s+=\s+var\.devops_ocir_auth_token/);
  assert.doesNotMatch(terraform, /name\s+=\s+"OCIR_USERNAME"/);
  assert.doesNotMatch(terraform, /name\s+=\s+"OCIR_AUTH_TOKEN"/);
  assert.doesNotMatch(terraform, /name\s+=\s+"OCI_GENAI_API_KEY"/);
  assert.doesNotMatch(terraform, /name\s+=\s+"OCI_HOSTED_APP_IDCS_CLIENT_SECRET"/);
  assert.match(terraform, /plain\("OCI_RESOURCE_SUFFIX", os\.environ\["RESOURCE_SUFFIX"\]\)/);
  assert.match(terraform, /vault\("OCI_PORTAL_PASSWORD", os\.environ\["PORTAL_AUTH_PASSWORD_SECRET_ID"\]\)/);
  assert.match(terraform, /data "external" "file_search_vector_store"/);
  assert.match(terraform, /data "external" "code_interpreter_container"/);
  assert.match(terraform, /data "external" "conversation_store"/);
  assert.match(terraform, /count = var\.portal_container_enabled && var\.file_search_local_exec_enabled \? 1 : 0/);
  assert.match(terraform, /count = var\.portal_container_enabled && var\.code_interpreter_local_exec_enabled \? 1 : 0/);
  assert.doesNotMatch(terraform, /fileexists\(local\.file_search_vector_store_generated_file\)/);
  assert.doesNotMatch(terraform, /fileexists\(local\.code_interpreter_container_generated_file\)/);
  assert.match(terraform, /output "portal_vector_store_id"/);
  assert.match(terraform, /output "portal_code_interpreter_container_id"/);
  assert.match(terraform, /vault\("OCI_GENAI_API_KEY", os\.getenv\("OCI_GENAI_API_KEY_SECRET_ID", ""\)\)/);
  assert.match(terraform, /vault\("OCI_PORTAL_PASSWORD", os\.environ\["PORTAL_AUTH_PASSWORD_SECRET_ID"\]\)/);
  assert.doesNotMatch(terraform, /--image-pull-secrets/);
  assert.doesNotMatch(terraform, /"secretType": "BASIC"/);
  assert.doesNotMatch(terraform, /image_pull_secrets/);
  assert.match(terraform, /matching_rule\s+=\s+"ALL \{resource\.compartment\.id = '\$\{var\.compartment_id\}'\}"/);
  assert.match(terraform, /manage repos in compartment id/);
  assert.match(terraform, /module "hosted_agentic_applications"/);
  assert.match(terraform, /source\s+=\s+"\.\.\/hosted-agentic-applications"/);
  assert.doesNotMatch(terraform, /count\s+=\s+var\.hosted_applications_local_exec_enabled\s+\?\s+1\s+:\s+0/);
  assert.match(terraform, /hosted_cli_deployments_enabled\s+=\s+var\.hosted_applications_local_exec_enabled/);
  assert.match(terraform, /resource_suffix\s+=\s+var\.resource_suffix/);
  assert.match(terraform, /push_image\s+=\s+var\.hosted_app_push_image/);
  assert.equal((hostedAppTerraform.match(/hosted_image_build_run_id\s+=\s+var\.hosted_image_build_run_id/g) || []).length, 5);
  assert.doesNotMatch(hostedAppTerraform, /push_image\s+=\s+true/);
  assert.match(terraform, /output "resource_suffix"/);
  assert.match(terraform, /output "portal_public_ip"/);
  assert.match(terraform, /output "portal_url"/);
  assert.doesNotMatch(terraform, /oci_load_balancer_load_balancer\.portal\[0\]\.ip_address_details\[0\]\.ip_address/);
  assert.doesNotMatch(terraform, /"http:\/\/\$\{oci_load_balancer_load_balancer\.portal\[0\]\.ip_address_details\[0\]\.ip_address\}"/);
  assert.match(terraform, /output "portal_login_user"/);
  assert.match(terraform, /output "portal_login_password"/);
  assert.match(terraform, /output "portal_login_password_secret_id"/);
  assert.match(terraform, /output "portal_container_repository_id"/);
  assert.match(terraform, /output "langfuse_postgres_private_endpoint"/);
  assert.match(terraform, /output "langfuse_clickhouse_url"/);
  assert.match(terraform, /output "langfuse_redis_endpoint"/);
  assert.match(terraform, /output "langfuse_object_storage_bucket"/);
  assert.match(terraform, /output "langfuse_networking_config_json"/);
  assert.match(terraform, /output "portal_runtime_note"/);
  assert.match(readme, /OCI Resource Manager/);
  assert.match(readme, /working directory `infra\/resource-manager-demo`/);
  assert.match(readme, /resource principal auth/);
  assert.match(readme, /Enterprise AI portal image repository/);
  assert.match(readme, /Langfuse hosted observability/);
  assert.match(readme, /default source branch is `oci-rms`/);
  assert.match(readme, /create-or-update semantics/);
  assert.match(readme, /no-auth hosted application/);
  assert.match(deployDocs, /`devops_source_branch` \| `oci-rms`/);
  assert.match(deployDocs, /OCI code links/);
  assert.match(deployDocs, /`devops_source_revision=<commit SHA on oci-rms>`/);
  assert.match(deployDocs, /deploy-langfuse/);
  assert.match(deployDocs, /`conversation_store_local_exec_enabled` \| `false`/);
  assert.match(deployDocs, /`file_search_local_exec_enabled` \| `false`/);
  assert.match(deployDocs, /`code_interpreter_local_exec_enabled` \| `false`/);
  assert.match(deployDocs, /Keep `conversation_store_local_exec_enabled=false`, `file_search_local_exec_enabled=false`, and `code_interpreter_local_exec_enabled=false`/);
  assert.match(releaseWorkflow, /infra\/resource-manager-demo\/schema\.yaml/);
});

test("generated runtime local-exec modules can be forced to refresh in Resource Manager", () => {
  const terraform = [
    read("infra/conversation-store/conversation.tf"),
    read("infra/file-search-vector-store-rag/vector_store.tf"),
    read("infra/code-interpreter/container.tf")
  ].join("\n");

  assert.match(terraform, /resource "terraform_data" "conversation_store"[\s\S]*resource-manager-generated-runtime-files-20260608/);
  assert.match(terraform, /resource "terraform_data" "file_search_vector_store"[\s\S]*resource-manager-generated-runtime-files-20260608/);
  assert.match(terraform, /resource "terraform_data" "code_interpreter_container"[\s\S]*resource-manager-generated-runtime-files-20260608/);
});

test("DevOps build pipeline provisions generated runtime resources before portal rollout", () => {
  const main = read("infra/devops-hosted-image-build/main.tf");
  const buildSpec = read("infra/devops-hosted-image-build/build_spec_provision_generated_runtime.yaml");
  const script = read("infra/devops-hosted-image-build/scripts/provision_generated_runtime.py");

  assert.match(main, /resource "oci_devops_build_pipeline_stage" "provision_generated_runtime"/);
  assert.match(main, /display_name\s+=\s+"provision-generated-runtime"/);
  assert.match(main, /build_spec_file\s+=\s+"infra\/devops-hosted-image-build\/build_spec_provision_generated_runtime\.yaml"/);
  assert.match(main, /build_pipeline_stage_predecessor_collection[\s\S]*oci_devops_build_pipeline_stage\.deliver_image\["portal"\]\.id/);
  assert.match(main, /resource "oci_devops_build_pipeline_stage" "deploy_portal"[\s\S]*oci_devops_build_pipeline_stage\.provision_generated_runtime\[0\]\.id/);
  assert.match(main, /depends_on = \[[\s\S]*oci_devops_build_pipeline_stage\.provision_generated_runtime/);
  assert.match(buildSpec, /provision_generated_runtime\.py/);
  assert.match(script, /OciResourcePrincipalAuth/);
  assert.match(script, /service_endpoint=f"https:\/\/generativeai\.\{region\}\.oci\.oraclecloud\.com\/20231130"/);
  assert.match(script, /existing_vector_store/);
  assert.match(script, /client\.vector_stores\.create/);
  assert.match(script, /client\.containers\.create/);
  assert.match(script, /client\.conversations\.create/);
  assert.match(script, /vector_stores\.files\.create/);
  assert.match(script, /"os",[\s\S]*"object",[\s\S]*"put"/);
  assert.match(script, /PORTAL_VECTOR_STORE_ID=/);
  assert.match(script, /PORTAL_CONVERSATION_ID=/);
  assert.match(script, /PORTAL_CODE_INTERPRETER_CONTAINER_ID=/);
});

test("DevOps deploys the portal as a no-auth hosted application with create-or-update rollout", () => {
  const main = read("infra/devops-hosted-image-build/main.tf");
  const variables = read("infra/devops-hosted-image-build/variables.tf");
  const buildSpec = read("infra/devops-hosted-image-build/build_spec_deploy_portal.yaml");
  const script = read("infra/devops-hosted-image-build/scripts/deploy_portal_hosted_application.sh");

  assert.match(variables, /variable "portal_auth_password_secret_id"/);
  assert.match(variables, /variable "portal_runtime_config_bucket"/);
  assert.match(main, /resource "oci_devops_build_pipeline_stage" "deploy_portal"/);
  assert.match(main, /display_name\s+=\s+"deploy-portal-hosted-application"/);
  assert.match(main, /build_spec_file\s+=\s+"infra\/devops-hosted-image-build\/build_spec_deploy_portal\.yaml"/);
  assert.match(main, /PORTAL_AUTH_PASSWORD_SECRET_ID/);
  assert.match(main, /OCI_GENAI_API_KEY_SECRET_ID/);
  assert.match(main, /OCI_HOSTED_APP_IDCS_CLIENT_SECRET_ID/);
  assert.match(main, /PORTAL_RUNTIME_CONFIG_BUCKET/);
  assert.doesNotMatch(main, /PORTAL_LOAD_BALANCER_ID/);
  assert.doesNotMatch(main, /PORTAL_BACKEND_SET_NAME/);
  assert.doesNotMatch(main, /name\s+=\s+"PORTAL_AUTH_PASSWORD"/);
  assert.match(buildSpec, /deploy_portal_hosted_application\.sh/);
  assert.match(script, /hosted-application-collection list-hosted-applications/);
  assert.match(script, /hosted-deployment-collection list-hosted-deployments/);
  assert.match(script, /create_or_update_portal_hosted_application/);
  assert.match(script, /add-artifact-create-single-docker-artifact-details/);
  assert.match(script, /hosted-deployment update/);
  assert.match(script, /NO_AUTH_CONFIG/);
  assert.match(script, /"type": "VAULT"/);
  assert.match(script, /OCI_PORTAL_PASSWORD/);
  assert.match(script, /PORTAL_AUTH_PASSWORD_SECRET_ID/);
  assert.match(script, /OCI_GENAI_API_KEY_SECRET_ID/);
  assert.match(script, /OCI_HOSTED_APP_IDCS_CLIENT_SECRET_ID/);
  assert.match(script, /invoke_url/);
  assert.match(script, /\/health/);
  assert.match(script, /\/api\/admin\/demo-runs/);
  assert.match(script, /\/api\/features\/responses-api\/state/);
  assert.doesNotMatch(script, /container-instances container-instance create/);
  assert.doesNotMatch(script, /lb backend create/);
  assert.doesNotMatch(script, /PORTAL_AUTH_PASSWORD:\?/);
  assert.doesNotMatch(script, /os\.environ\["PORTAL_AUTH_PASSWORD"\]/);
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
  assert.match(server, /logFile/);
  assert.match(server, /"authorization"/);
  assert.match(server, /portalSessionCookie/);
});

test("administration page is separate while runtime metadata stays available", () => {
  const server = read("server.mjs");
  const main = read("src/main.js");
  const adminHtml = read("admin.html");
  const admin = read("src/admin.js");
  const styles = read("src/styles.css");

  assert.match(server, /generated\.file_search_vector_store/);
  assert.match(server, /generated\.file_search_seed_documents/);
  assert.match(server, /generated\.hosted_agent_ocir_repository_id/);
  assert.match(server, /generated\.hosted_agent_ocir_image_count/);
  assert.match(server, /generated\.hosted_agent_application_work_request/);
  assert.match(server, /generated\.hosted_agent_deployment_artifact/);
  assert.match(server, /generated\.langgraph_hosted_agent_ocir_repository_id/);
  assert.match(server, /generated\.langgraph_hosted_agent_deployment_artifact/);
  assert.match(server, /generated\.langfuse_hosted_observability_url/);
  assert.match(server, /generated\.openclaw_hosted_gateway_url/);
  assert.match(server, /langfuse_hosted_application\.json/);
  assert.match(server, /langfuse_hosted_deployment\.json/);
  assert.match(server, /openclaw_hosted_application\.json/);
  assert.match(server, /openclaw_hosted_deployment\.json/);
  assert.match(server, /OCI Langfuse hosted application refresh/);
  assert.match(server, /OCI Langfuse hosted deployment refresh/);
  assert.match(server, /OCI OpenClaw hosted application refresh/);
  assert.match(server, /OCI OpenClaw hosted deployment refresh/);
  assert.match(server, /langfuseHostedUrl/);
  assert.match(server, /openclawHostedUrl/);
  assert.match(server, /portalRuntimeHostedValue/);
  assert.match(server, /readObjectStorageJson/);
  assert.match(server, /writePersistentDemoRunRecord/);
  assert.match(server, /OCI_PORTAL_RUN_HISTORY_OBJECT/);
  assert.match(server, /hostedApplicationInvokeUrl/);
  assert.match(server, /application\.generativeai\.\$\{region\}\.oci\.oraclecloud\.com\/20251112\/hostedApplications/);
  assert.doesNotMatch(server, /IDCS_CLIENT_SECRET=.*[0-9a-f-]{30,}/);
  assert.match(main, /href="\$\{portalRelativeUrl\("\/admin\.html"\)\}"/);
  assert.doesNotMatch(main, /id="administration"/);
  assert.match(adminHtml, /id="administration"/);
  assert.match(adminHtml, /admin-tab-runs/);
  assert.match(adminHtml, /admin-tab-infra/);
  assert.match(adminHtml, /admin-tab-logs/);
  assert.match(adminHtml, /admin-tab-changes/);
  assert.match(adminHtml, /admin-panel-runs/);
  assert.match(adminHtml, /admin-panel-infra/);
  assert.match(adminHtml, /admin-panel-logs/);
  assert.match(adminHtml, /admin-panel-changes/);
  assert.match(adminHtml, /admin-demo-table/);
  assert.match(adminHtml, /admin-run-log-panel/);
  assert.match(adminHtml, /admin-change-log/);
  assert.match(adminHtml, /admin-infra-panel/);
  assert.match(adminHtml, /admin-resource-list/);
  assert.match(adminHtml, /admin-schema-grid/);
  assert.match(adminHtml, /admin-log-source-filter/);
  assert.match(adminHtml, /admin-container-log-note/);
  assert.doesNotMatch(admin, /admin-connection-grid/);
  assert.doesNotMatch(adminHtml, /Hosted application references/);
  assert.match(adminHtml, /admin-run-status-filter/);
  assert.match(admin, /admin-run-status-filter/);
  assert.match(admin, /\/api\/admin\/infra/);
  assert.match(admin, /\/api\/admin\/logs/);
  assert.match(admin, /\/api\/admin\/change-log/);
  assert.match(admin, /entry\.status \|\| "unknown"/);
  assert.match(admin, /entry\.preview \|\| ""/);
  assert.match(admin, /component\.status \|\| "unknown"/);
  assert.doesNotMatch(admin, /clientSecret|apiKey|password/i);
  assert.match(main, /loadResponsesInfrastructureState/);
  assert.doesNotMatch(main, /id="infra-panel"/);
  assert.doesNotMatch(main, /infra-component-search/);
  assert.doesNotMatch(main, /infra-component-type-filter/);
  assert.match(styles, /\.admin-metric-grid/);
  assert.match(styles, /\.admin-run-log/);
  assert.match(styles, /\.admin-change-entry/);
});

test("server refresh discovers hosted runtime metadata when generated files are absent", () => {
  const server = read("server.mjs");
  const portalRollout = [
    read("infra/resource-manager-demo/main.tf"),
    read("infra/devops-hosted-image-build/scripts/deploy_portal_hosted_application.sh")
  ].join("\n");

  assert.match(server, /function resolveHostedRuntimeResourceSuffix/);
  assert.match(server, /async function discoverGeneratedHostedRuntimeState/);
  assert.match(server, /structured-search/);
  assert.match(server, /enterprise-ai-demo-langfuse-\$\{resourceSuffix\}/);
  assert.match(server, /langfuse_hosted_observability\.json/);
  assert.match(server, /process\.env\.OCI_HOSTED_LANGFUSE_URL/);
  assert.match(server, /discoverGeneratedHostedRuntimeState/);
  assert.match(portalRollout, /OCI_RESOURCE_SUFFIX/);
  assert.match(portalRollout, /hosted_app_idcs_client_id\s+=\s+module\.hosted_agentic_applications\.hosted_app_idcs_launch_client_id/);
  assert.match(portalRollout, /hosted_app_idcs_client_secret_id\s+=\s+var\.hosted_app_idcs_client_secret_id/);
  assert.match(portalRollout, /OCI_HOSTED_APP_IDCS_CLIENT_SECRET_ID/);
  assert.doesNotMatch(portalRollout, /hosted_app_idcs_client_secret\s+=\s+module\.hosted_agentic_applications\.hosted_app_idcs_launch_client_secret/);
});

test("DevOps hosted deployment creates replacements before best-effort cleanup", () => {
  const buildSpec = read("infra/devops-hosted-image-build/build_spec_deploy_hosted.yaml");
  const deployScript = read("infra/devops-hosted-image-build/scripts/deploy_hosted_application.sh");
  const portalContainer = read("infra/resource-manager-demo/portal_container.tf");
  const resourceManager = read("infra/resource-manager-demo/main.tf");

  assert.match(buildSpec, /deploy_hosted_application\.sh HOSTED_AGENT/);
  assert.match(deployScript, /case "\$HOSTED_APP_KEY" in/);
  assert.match(deployScript, /Skipping \$\{HOSTED_APP_KEY\} hosted deployment/);
  assert.match(deployScript, /\$\{deploy_selector,,\}.*!= "all"/);
  assert.match(deployScript, /OCI_HA_\$\{HOSTED_APP_KEY\}_DEPLOY/);
  assert.doesNotMatch(deployScript, /delete_existing_hosted_resources "\$deployment_display" "\$display"/);
  assert.match(deployScript, /cleanup_previous_hosted_resources "\$display" "\$app_id" "\$dep_id"/);
  assert.match(deployScript, /OCI did not allow deletion/);
  assert.match(deployScript, /create_hosted HOSTED_AGENT/);
  assert.match(deployScript, /create_hosted LANGGRAPH/);
  assert.match(deployScript, /create_hosted LANGFUSE/);
  assert.match(deployScript, /create_hosted OPENCLAW/);
  assert.match(deployScript, /create_hosted LLAMAINDEX/);
  assert.match(deployScript, /write_exported_variables "\$HOSTED_APP_KEY"/);
  assert.match(deployScript, /previous_app_ids/);
  assert.match(deployScript, /hosted-application-collection list-hosted-applications/);
  assert.match(deployScript, /hosted-deployment-collection list-hosted-deployments/);
  assert.match(deployScript, /--display-name "\$display_name"/);
  assert.match(deployScript, /--application-id "\$app_id"/);
  assert.doesNotMatch(deployScript, /raw-request/);
  assert.match(deployScript, /cleanup_previous_hosted_resources/);
  assert.match(deployScript, /reuse_existing_hosted_resource/);
  assert.match(deployScript, /Reusing active \${HOSTED_APP_KEY} hosted application/);
  assert.match(deployScript, /if reuse_existing_hosted_resource "\$key" "\$display" "\$deployment_display"; then/);
  assert.match(deployScript, /hosted-application delete/);
  assert.match(deployScript, /hosted-deployment delete/);
  assert.doesNotMatch(deployScript, /"\$old_app_id" != "\$new_app_id"/);
  assert.doesNotMatch(deployScript, /"\$old_dep_id" != "\$new_dep_id"/);
  assert.doesNotMatch(deployScript, /^display_name = sys\.argv\[1\]$/m);
  assert.match(resourceManager, /image_tag\s+=\s+local\.devops_image_tag/);
  assert.match(portalContainer, /devops_image_tag\s+=\s+var\.devops_source_revision != "" \? var\.devops_source_revision : var\.portal_container_image_tag/);
  assert.match(portalContainer, /non_empty_current_hosted_deployment_exports/);
  assert.match(portalContainer, /retained_generated_runtime_config/);
  assert.match(portalContainer, /stale_hosted_deployment_export_keys/);
  assert.match(portalContainer, /stale_hosted_deployment_export_keys\s+=\s+local\.effective_deploy_only_app\s+\?\s+\[\]\s+:/);
  assert.match(portalContainer, /local\.stale_hosted_deployment_export_keys/);
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
  assert.match(main, /id="responses-model-field"/);
  assert.match(main, /id="responses-project-field"/);
  assert.match(main, /id="responses-temperature-field"/);
  assert.match(main, /createNewCodeInterpreterContainer/);
  assert.match(main, /demo-details-doc-link/);
  assert.match(main, /demo-details-wiring-link/);
  assert.match(main, /function defaultWiringHref/);
  assert.match(main, /feature\.wiringHref/);
  assert.match(main, /docs\/wiring\/\$\{featureId\}\.svg/);
  assert.match(main, /OCI wiring diagram/);
  assert.match(main, /demo-header-copy/);
  assert.match(main, /action="\$\{portalRelativeUrl\("\/logout"\)\}"/);
  assert.doesNotMatch(main, /demo-quick-actions/);
  assert.doesNotMatch(main, /demo-flow-button/);
  assert.doesNotMatch(main, /demo-code-button/);
  assert.doesNotMatch(main, /demo-logs-button/);
  assert.doesNotMatch(main, /demo-run-count-shell/);
  assert.match(main, /demo-details-doc-link/);
  assert.match(main, /demo-details-wiring-link/);
  assert.match(main, /Relevant Output/);
  assert.match(main, /data-output-view="markdown"/);
  assert.match(main, /data-output-view="json"/);
  assert.match(main, /data-more-details-tab/);
  assert.match(main, /Technical details/);
  assert.match(main, /Logs/);
  assert.match(main, /OCI feature code/);
  assert.match(main, /const ociFeatureCodeSnippets/);
  assert.match(main, /const ociFeatureSourceFiles/);
  assert.match(main, /function buildSourceLink/);
  assert.match(main, /sourceRepoUrl/);
  assert.match(main, /sourceBranch/);
  assert.match(main, /Source:/);
  assert.match(main, /function renderMarkdown/);
  assert.match(main, /OCI Enterprise AI architecture canvas/);
  assert.match(main, /Tip: why this OCI AI feature matters/);
  assert.match(main, /const demoTechnicalFlows/);
  assert.match(main, /Technical details/);
  assert.match(main, /Architecture flow/);
  assert.match(main, /Step-by-step OCI flow/);
  assert.match(main, /View raw run details/);
  assert.match(main, /langfuse-hosted-observability/);
  assert.match(main, /openclaw-hosted-agent-gateway/);
  assert.match(main, /agentic-control-tower/);
  assert.match(main, /const hostedApplicationLaunchConfigs = \{/);
  assert.match(main, /responses-launch-button/);
  assert.match(main, /hostedApplicationLaunchConfig\(featureId\)/);
  assert.match(main, /hostedDeploymentStatus/);
  assert.match(main, /Hosted deployment is not active/);
  assert.match(main, /has-hosted-launch/);
  assert.match(styles, /\.demo-dialog\.has-hosted-launch \.secondary-run-action/);
  assert.doesNotMatch(styles, /\.demo-dialog\.is-launch-demo \.demo-output-grid > section:first-child/);
  assert.doesNotMatch(styles, /\.demo-dialog\.is-launch-demo \.more-details-panel/);
  assert.match(styles, /\.oci-source-link\s*\{[^}]*font-size: 0\.72rem;[^}]*text-decoration: underline;/);
  assert.match(main, /function demoCardActionLabel/);
  assert.match(main, /demoCardActionLabel\(feature\.id\)/);
  assert.match(main, /document\.getElementById\("responses-run-button"\)\.textContent = defaults\.button \|\| "Run demo"/);
  assert.match(main, /classList\.toggle\("is-launch-only", isLaunchOnly\)/);
  assert.match(main, /responses-model-field"\)\.hidden = isLaunchOnly/);
  assert.match(main, /responses-project-field"\)\.hidden = isLaunchOnly/);
  assert.match(main, /responses-temperature-field"\)\.hidden = isLaunchOnly/);
  assert.doesNotMatch(main, /externalLaunchDemos/);
  assert.match(main, /launchExternalDemo\(activeDemoId\)/);
  assert.doesNotMatch(main, /hostedUiLaunchDemoIds\.includes\(activeDemoId\)/);
  assert.match(main, /window\.open\(launchTarget/);
  assert.match(main, /\/api\/openclaw\/launch\//);
  assert.match(main, /\/api\/langfuse\/launch\/auth\/sign-in/);
  assert.doesNotMatch(main, /\/api\/llamaindex\/launch\//);
  assert.match(server, /async function proxyLangfuseLaunch/);
  assert.match(server, /isLangfusePassthroughPath/);
  assert.match(server, /\/api\/auth\//);
  assert.match(server, /\/_next\//);
  assert.match(server, /\/assets\//);
  assert.match(server, /rewriteLangfuseLaunchHtml/);
  assert.match(server, /rewriteLangfuseRootRelativeUrl/);
  assert.match(server, /rewrittenLocation/);
  assert.match(server, /rewroteBody/);
  assert.match(server, /\/favicon\.ico/);
  assert.match(server, /\/icon\.svg/);
  assert.match(server, /rewriteLangfuseLaunchJson/);
  assert.match(server, /http:\/\/0\.0\.0\.0:3000/);
  assert.match(server, /async function getIdcsAccessToken/);
  assert.match(server, /readHostedAppIdcsLaunchConfig/);
  assert.match(server, /hosted_app_idcs_client\.json/);
  assert.match(server, /IDCS_CLIENT_SECRET/);
  assert.match(server, /IDCS_TOKEN_URL/);
  assert.match(server, /IDCS rejected the client credentials/);
  assert.match(server, /Authorization: `Bearer \$\{token\}`/);
  assert.match(styles, /\.markdown-output/);
  assert.match(styles, /\.response-output \.relevant-output\.markdown-output/);
  assert.match(styles, /\.relevant-json-output/);
  assert.match(styles, /\.more-details-panel/);
  assert.doesNotMatch(styles, /\.demo-quick-actions/);
  assert.match(styles, /\.demo-dialog\.is-launch-only \.demo-controls/);
  assert.match(styles, /\.demo-controls label\[hidden\]/);
  assert.match(styles, /\.demo-doc-link/);
  assert.match(styles, /\.demo-wiring-link\[hidden\]/);
  assert.match(styles, /\.demo-header-copy/);
  assert.match(styles, /\.output-toggle/);
  assert.match(styles, /background: #191513/);
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
