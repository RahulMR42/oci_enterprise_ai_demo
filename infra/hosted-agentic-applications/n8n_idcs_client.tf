resource "oci_identity_domains_app" "n8n_launch_client" {
  count         = var.n8n_idcs_launch_client_enabled ? 1 : 0
  idcs_endpoint = local.n8n_idcs_domain_url
  schemas = [
    "urn:ietf:params:scim:schemas:oracle:idcs:App",
    "urn:ietf:params:scim:schemas:oracle:idcs:extension:OCITags"
  ]

  based_on_template {
    value         = "CustomWebAppTemplateId"
    well_known_id = "CustomWebAppTemplateId"
  }

  active          = true
  display_name    = local.n8n_idcs_client_display_name
  name            = local.n8n_idcs_client_name
  description     = "Enterprise AI demo confidential OAuth client used by hosted UI launch proxies."
  is_oauth_client = true
  client_type     = "confidential"
  allowed_grants  = local.n8n_idcs_allowed_grants
  audience        = local.n8n_idcs_audience
  bypass_consent  = true
  redirect_uris   = local.n8n_idcs_redirect_uris
  trust_scope     = "Explicit"
  force_delete    = true

  allowed_scopes {
    fqs = local.n8n_idcs_scope_fqs
  }
}

resource "terraform_data" "n8n_idcs_launch_client_metadata" {
  count = var.n8n_idcs_launch_client_enabled ? 1 : 0

  input = {
    app_id        = oci_identity_domains_app.n8n_launch_client[0].id
    audience      = local.n8n_idcs_audience
    client_id     = local.n8n_idcs_client_name
    display_name  = local.n8n_idcs_client_display_name
    domain_url    = local.n8n_idcs_domain_url
    generated_dir = local.generated_dir
    redirect_uris = local.n8n_idcs_redirect_uris
    scope         = local.n8n_idcs_scope
    token_url     = "${trimsuffix(local.n8n_idcs_domain_url, "/")}/oauth2/v1/token"
  }

  provisioner "local-exec" {
    environment = {
      N8N_IDCS_CLIENT_SECRET = oci_identity_domains_app.n8n_launch_client[0].client_secret
    }

    command = <<-EOT
      set -euo pipefail
      mkdir -p '${self.input.generated_dir}'
      python3 - <<PY
import json
import os
from pathlib import Path

payload = {
    "appId": "${self.input.app_id}",
    "displayName": "${self.input.display_name}",
    "domainUrl": "${self.input.domain_url}",
    "tokenUrl": "${self.input.token_url}",
    "clientId": "${self.input.client_id}",
    "clientSecret": os.environ["N8N_IDCS_CLIENT_SECRET"],
    "audience": "${self.input.audience}",
    "redirectUris": json.loads('''${jsonencode(self.input.redirect_uris)}'''),
    "scope": "${self.input.scope}",
    "scopeFqs": "${local.n8n_idcs_scope_fqs}",
    "source": "terraform",
}
target = Path("${self.input.generated_dir}") / "n8n_idcs_client.json"
target.write_text(json.dumps(payload, indent=2))
target.chmod(0o600)
PY
    EOT
  }
}
