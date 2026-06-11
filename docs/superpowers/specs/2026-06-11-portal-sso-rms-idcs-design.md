# Portal SSO With RMS IDCS Design

## Goal

Add Oracle Identity Cloud Service SSO to the OCI Enterprise AI Portal while preserving the existing local `oci` bootstrap login. The Resource Manager deployment should reuse the RMS-managed IDCS confidential application when it exists, and provision/update the required OAuth configuration through Terraform and the existing DevOps portal deployment flow.

## Approved Approach

Use server-side OpenID Connect authorization-code login in `server.mjs`. The hosted portal application remains `NO_AUTH_CONFIG`; the portal itself owns login, session cookie creation, audit identity, and admin authorization.

Reuse the existing Terraform-managed IDCS app created by `infra/hosted-agentic-applications/hosted_app_idcs_client.tf` for hosted UI launch proxy credentials. That app already has the right confidential-client shape, client credentials support, generated metadata, and Vault-backed secret path. SSO will extend that same app with an authorization-code redirect URI for the portal callback.

Keep the local `oci` form login and Basic Auth compatibility. SSO adds a second login option, not a replacement for the bootstrap path.

## Current State

The portal currently has:

- Server-rendered login HTML from `server.mjs`.
- A bootstrap `oci` identity with admin role.
- Local protected-user signup/login through `backend/portal_auth_store.py`.
- Browser sessions stored as `oci_portal_session` cookies and mapped to identities in memory.
- Audit/session records written through the auth store.
- IDCS client-credentials support for hosted UI launch proxying.
- RMS/DevOps portal deployment as a public no-auth OCI Generative AI hosted application.

The latest active hosted portal app is launched through the OCI hosted invoke URL. The SSO callback must use that same invoke URL base:

```text
https://application.generativeai.<region>.oci.oraclecloud.com/20251112/hostedApplications/<portal-hosted-application-id>/actions/invoke/auth/sso/callback
```

## User Experience

The login page will offer:

- `Sign in with Oracle SSO`
- Local username/password sign-in for `oci`

The existing protected-user signup form will be removed from the login page for this SSO change. Existing auth store code remains available for audit/session persistence and future protected-user needs, but the visible frontend auth options are SSO and local `oci` only.

After a successful SSO login, the user lands on the portal home page with the same session cookie mechanism as local login. Demo runs, hosted launches, and admin audit records receive the SSO user identity.

## Identity Model

There will be two supported identity types:

- `bootstrap`: the existing `oci` account, role `admin`, local password, Basic Auth compatible.
- `sso_user`: an IDCS-authenticated user, role `user` by default unless a configured admin allowlist marks them as admin.

An SSO identity contains:

- `userId`: stable IDCS subject claim, prefixed as `sso:<sub>`.
- `userEmail`: normalized email claim when present, otherwise preferred username.
- `displayEmail`: original email or username for UI/audit display.
- `authType`: `sso`.
- `role`: `user` or `admin`.

Admin SSO access will be controlled by an optional comma-separated env var such as `OCI_PORTAL_SSO_ADMIN_EMAILS`. The bootstrap `oci` user remains admin regardless of SSO configuration.

## OIDC Flow

Add these server routes:

- `GET /auth/sso/start`
- `GET /auth/sso/callback`

`/auth/sso/start` will:

- require SSO config to be present and enabled,
- generate cryptographically random `state` and `nonce`,
- store them in an HttpOnly, SameSite=Lax, short-lived cookie,
- redirect to `${domainUrl}/oauth2/v1/authorize`.

The authorize request will include:

- `response_type=code`
- `client_id`
- `redirect_uri`
- `scope=openid email profile`
- `state`
- `nonce`

`/auth/sso/callback` will:

- validate the returned state against the SSO state cookie,
- exchange the code at `${domainUrl}/oauth2/v1/token`,
- authenticate with the confidential client secret,
- validate the returned `id_token`,
- verify issuer, audience, expiration, nonce, and signature,
- create the normal `oci_portal_session` cookie,
- call the auth store `open_session` path with the resolved SSO identity,
- redirect to `./`.

Token exchange and ID token validation must not log raw tokens, codes, secrets, cookies, or full authorization headers.

## ID Token Validation

Use IDCS discovery and JWKS:

- discovery URL: `${domainUrl}/.well-known/openid-configuration`
- JWKS URL from discovery when available, otherwise `${domainUrl}/admin/v1/SigningCert/jwk`

The implementation should use Node built-ins where practical. If a dependency is required, keep it narrow and justify it in the implementation plan. Validation must cover:

- `iss` equals the configured IDCS issuer/domain,
- `aud` includes the configured client ID,
- `exp` and `nbf` are valid with a small clock skew,
- `nonce` matches the state cookie record,
- signature verifies against the matching JWKS key.

If validation fails, clear the SSO state cookie and render the login page with a generic SSO failure message.

## Terraform and RMS Wiring

The existing IDCS app is Terraform-owned in `infra/hosted-agentic-applications/hosted_app_idcs_client.tf`. Extend that app rather than creating a second app by default.

Add Resource Manager variables for portal SSO:

- `portal_sso_enabled`: default `true`.
- `portal_sso_admin_emails`: default `[]`.
- `portal_sso_redirect_uris`: default `[]`, optional explicit redirect URIs.
- `portal_sso_reuse_hosted_launch_idcs_client`: default `true`.

The RMS path must support two redirect URI sources:

1. Explicit `portal_sso_redirect_uris` provided to Terraform.
2. The active RMS hosted invoke URL discovered by the DevOps portal deployment stage.

Because the hosted application ID appears in the callback URL and is discovered during deployment, the DevOps portal deployment script will:

- create or locate the active portal hosted application,
- derive the callback URL using `invoke_url "$app_id"`,
- update the existing IDCS app redirect URIs to include that callback when `portal_sso_enabled=true`,
- ensure `authorization_code` remains allowed in addition to `client_credentials`,
- write portal environment variables with the final callback URL,
- update the portal hosted app environment before promoting the active artifact.

To avoid silent drift, Terraform should also accept explicit redirect URIs and continue to model `authorization_code` support in the IDCS app. The DevOps stage is allowed to add the discovered callback URI because the callback depends on the deployed hosted application ID. Subsequent RMS applies should retain the callback by passing the previous invoke URL through `portal_sso_redirect_uris` or by reapplying the DevOps update after app discovery.

## Portal Environment

The portal hosted application will receive:

- `OCI_PORTAL_SSO_ENABLED=true`
- `OCI_PORTAL_SSO_DOMAIN_URL`
- `OCI_PORTAL_SSO_CLIENT_ID`
- `OCI_PORTAL_SSO_CLIENT_SECRET` as a Vault secret reference
- `OCI_PORTAL_SSO_REDIRECT_URI`
- `OCI_PORTAL_SSO_SCOPE=openid email profile`
- `OCI_PORTAL_SSO_ADMIN_EMAILS`

For reuse, these may map to the existing hosted-launch IDCS values:

- `OCI_HOSTED_APP_IDCS_DOMAIN_URL`
- `OCI_HOSTED_APP_IDCS_CLIENT_ID`
- `OCI_HOSTED_APP_IDCS_CLIENT_SECRET`

The implementation should normalize aliases so local runs can use either `OCI_PORTAL_SSO_*` or the existing hosted-app IDCS variables.

## Existing IDCS App Reuse

When `portal_sso_reuse_hosted_launch_idcs_client=true`, use the existing app name:

```text
enterprise-ai-demo-hosted-launch-<resource_suffix>
```

and display name:

```text
enterprise-ai-demo-hosted-launch-client-<resource_suffix>
```

If the app already exists from a previous RMS run, Terraform should continue to manage it through the existing resource/state. The DevOps script should patch by app ID or client name only for callback URI additions that depend on the discovered portal app ID.

If reuse is disabled in a later version, a separate portal SSO IDCS app can be added, but that is out of scope for this first implementation.

## Session and Audit Behavior

SSO sessions use the same `oci_portal_session` cookie as local login. The server must store SSO identity in `portalSessionIdentities`, call `openPortalAuthSession`, and include the resulting public session ID in audit records.

Add audit event type support for SSO login outcomes:

- `login` with `authType=sso` on success.
- `login_failed` with `authType=sso` on callback/state/token/validation failure.
- existing `logout`, `demo_run`, and `hosted_launch` behavior remains unchanged.

Audit writes remain best effort. A failed audit insert must not block login.

## Logout

For the first implementation, logout clears only the portal session cookie and local server session maps. It does not need to perform global IDCS logout. The login page can show a neutral notice after logout if needed.

## Error Handling

- Missing SSO configuration hides or disables the SSO button and keeps local `oci` login available.
- IDCS authorize URL construction errors render the login page with a generic SSO configuration error.
- Callback state mismatch returns the login page with a generic SSO failure.
- Token exchange failures do not leak IDCS response bodies containing sensitive content.
- ID token validation failures do not expose raw token claims to the browser.
- JWKS/discovery failures disable only SSO, not local login.
- `oci` login remains available during all SSO failures.

## Testing

Add focused Node tests for:

- SSO config normalization from `OCI_PORTAL_SSO_*` and existing `OCI_HOSTED_APP_IDCS_*` env vars.
- Callback URI construction from the RMS invoke URL.
- Authorize URL includes expected scope, state, nonce, client ID, and redirect URI.
- Callback rejects missing or mismatched state.
- Callback exchanges code and creates the existing portal session cookie when token validation succeeds.
- SSO identity maps email/sub claims to the expected portal identity shape.
- `oci` local form login and Basic Auth still work.
- Missing SSO config does not block local login.

Add Terraform/provisioning tests for:

- existing IDCS app reuse remains the default,
- `authorization_code` is enabled when redirect URIs are configured,
- portal deploy env includes SSO variables,
- portal deploy script derives `/auth/sso/callback` from the hosted invoke URL,
- the DevOps stage updates IDCS redirect URIs without emitting client secrets.

Live validation after deployment:

- latest RMS apply succeeds,
- DevOps `deploy-portal-hosted-application` stage succeeds,
- portal invoke URL returns the login page,
- SSO button redirects to the IDCS authorize endpoint,
- IDCS login returns to `/auth/sso/callback`,
- portal home loads with an authenticated session,
- local `oci` login still works.

## Out of Scope

- Enforcing IDCS auth at the OCI hosted application inbound-auth layer.
- Removing the `oci` bootstrap user.
- Global IDCS logout.
- SCIM group synchronization.
- A full role-management UI.
- Creating a separate portal-only IDCS application unless reuse proves impossible.
