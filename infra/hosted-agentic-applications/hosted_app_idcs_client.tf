resource "oci_identity_domains_app" "hosted_app_launch_client" {
  count         = var.hosted_app_idcs_launch_client_enabled ? 1 : 0
  idcs_endpoint = local.hosted_app_idcs_domain_url
  schemas = [
    "urn:ietf:params:scim:schemas:oracle:idcs:App",
    "urn:ietf:params:scim:schemas:oracle:idcs:extension:OCITags"
  ]

  based_on_template {
    value         = "CustomWebAppTemplateId"
    well_known_id = "CustomWebAppTemplateId"
  }

  active          = true
  display_name    = local.hosted_app_idcs_client_display_name
  name            = local.hosted_app_idcs_client_name
  description     = "Enterprise AI demo confidential OAuth client used by hosted UI launch proxies."
  is_oauth_client = true
  client_type     = "confidential"
  allowed_grants  = local.hosted_app_idcs_allowed_grants
  audience        = local.hosted_app_idcs_audience
  bypass_consent  = true
  redirect_uris   = local.hosted_app_idcs_redirect_uris
  trust_scope     = "Explicit"
  force_delete    = true

  allowed_scopes {
    fqs = local.hosted_app_idcs_scope_fqs
  }

  provisioner "local-exec" {
    when = destroy

    command = <<-EOT
      set -euo pipefail
      # IDCS rejects deleting active apps. Terraform owns the delete, but the
      # provider does not deactivate before issuing DeleteApp.
      oci identity-domains app patch \
        --endpoint '${self.idcs_endpoint}' \
        --app-id '${self.id}' \
        --schemas '["urn:ietf:params:scim:api:messages:2.0:PatchOp"]' \
        --operations '[{"op":"replace","path":"active","value":false}]' \
        --auth resource_principal \
        --output json >/dev/null
    EOT
  }
}

resource "terraform_data" "hosted_app_idcs_launch_client_metadata" {
  count = var.hosted_app_idcs_launch_client_enabled ? 1 : 0

  input = {
    app_id        = oci_identity_domains_app.hosted_app_launch_client[0].id
    audience      = local.hosted_app_idcs_audience
    client_id     = local.hosted_app_idcs_client_name
    display_name  = local.hosted_app_idcs_client_display_name
    domain_url    = local.hosted_app_idcs_domain_url
    generated_dir = local.generated_dir
    redirect_uris = local.hosted_app_idcs_redirect_uris
    scope         = local.hosted_app_idcs_scope
    token_url     = "${trimsuffix(local.hosted_app_idcs_domain_url, "/")}/oauth2/v1/token"
  }

  provisioner "local-exec" {
    environment = {
      HOSTED_APP_IDCS_CLIENT_SECRET = oci_identity_domains_app.hosted_app_launch_client[0].client_secret
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
    "clientSecret": os.environ["HOSTED_APP_IDCS_CLIENT_SECRET"],
    "audience": "${self.input.audience}",
    "redirectUris": json.loads('''${jsonencode(self.input.redirect_uris)}'''),
    "scope": "${self.input.scope}",
    "scopeFqs": "${local.hosted_app_idcs_scope_fqs}",
    "source": "terraform",
}
target = Path("${self.input.generated_dir}") / "hosted_app_idcs_client.json"
target.write_text(json.dumps(payload, indent=2))
target.chmod(0o600)
PY
    EOT
  }
}
