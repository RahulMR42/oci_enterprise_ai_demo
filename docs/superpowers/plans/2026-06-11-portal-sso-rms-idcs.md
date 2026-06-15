# Portal SSO RMS IDCS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Oracle IDCS SSO to the hosted portal while keeping the local `oci` bootstrap login.

**Architecture:** Implement server-side OIDC authorization-code flow in `server.mjs`, reusing the existing portal session cookie and audit identity model. Extend RMS/DevOps wiring so the existing Terraform-managed hosted-launch IDCS app receives the hosted invoke callback URI and the portal hosted app receives SSO environment variables.

**Tech Stack:** Node.js built-ins (`crypto`, `fetch`, `node:test`), Terraform, OCI CLI/IDCS SCIM patch via the existing DevOps deployment script.

---

### Task 1: Add Server-Side SSO Helpers

**Files:**
- Modify: `tests/provisioning.test.js`
- Modify: `server.mjs`

- [ ] **Step 1: Write failing tests for SSO config, callback URL, state, authorize URL, and identity mapping**

Add imports from `server.mjs` in `tests/provisioning.test.js`:

```js
  buildPortalSsoAuthorizeUrl,
  consumePortalSsoState,
  createPortalSsoState,
  portalSsoCallbackUrlFromInvokeUrl,
  portalSsoIdentityFromClaims,
  portalSsoIsConfigured,
  resolvePortalSsoConfig,
```

Add tests:

```js
test("portal SSO config reuses hosted IDCS env and builds invoke callback URL", () => {
  const callback = portalSsoCallbackUrlFromInvokeUrl(
    "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/app123/actions/invoke/"
  );
  const config = resolvePortalSsoConfig({
    OCI_PORTAL_SSO_ENABLED: "true",
    OCI_HOSTED_APP_IDCS_DOMAIN_URL: "https://idcs.example.com:443/",
    OCI_HOSTED_APP_IDCS_CLIENT_ID: "client-id",
    OCI_HOSTED_APP_IDCS_CLIENT_SECRET: "client-secret",
    OCI_PORTAL_SSO_REDIRECT_URI: callback,
    OCI_PORTAL_SSO_ADMIN_EMAILS: "admin@example.com, Ops@Example.com"
  });

  assert.equal(callback, "https://application.generativeai.us-chicago-1.oci.oraclecloud.com/20251112/hostedApplications/app123/actions/invoke/auth/sso/callback");
  assert.equal(config.domainUrl, "https://idcs.example.com:443");
  assert.equal(config.tokenUrl, "https://idcs.example.com:443/oauth2/v1/token");
  assert.equal(config.authorizeUrl, "https://idcs.example.com:443/oauth2/v1/authorize");
  assert.equal(config.clientId, "client-id");
  assert.equal(config.clientSecret, "client-secret");
  assert.equal(config.redirectUri, callback);
  assert.equal(config.scope, "openid email profile");
  assert.deepEqual(config.adminEmails, ["admin@example.com", "ops@example.com"]);
  assert.equal(portalSsoIsConfigured(config), true);
});

test("portal SSO state is single-use and authorize URL carries state and nonce", () => {
  const states = new Map();
  const created = createPortalSsoState({ states, now: () => 1700000000000 });
  const config = resolvePortalSsoConfig({
    OCI_PORTAL_SSO_DOMAIN_URL: "https://idcs.example.com",
    OCI_PORTAL_SSO_CLIENT_ID: "client-id",
    OCI_PORTAL_SSO_CLIENT_SECRET: "client-secret",
    OCI_PORTAL_SSO_REDIRECT_URI: "https://portal.example.com/auth/sso/callback"
  });
  const authorize = new URL(buildPortalSsoAuthorizeUrl(config, created));

  assert.equal(authorize.origin + authorize.pathname, "https://idcs.example.com/oauth2/v1/authorize");
  assert.equal(authorize.searchParams.get("response_type"), "code");
  assert.equal(authorize.searchParams.get("client_id"), "client-id");
  assert.equal(authorize.searchParams.get("redirect_uri"), "https://portal.example.com/auth/sso/callback");
  assert.equal(authorize.searchParams.get("scope"), "openid email profile");
  assert.equal(authorize.searchParams.get("state"), created.state);
  assert.equal(authorize.searchParams.get("nonce"), created.nonce);

  assert.equal(consumePortalSsoState(created.state, created.state, { states, now: () => 1700000000001 }).nonce, created.nonce);
  assert.throws(() => consumePortalSsoState(created.state, created.state, { states, now: () => 1700000000002 }), /expired or unknown/i);
});

test("portal SSO identity maps claims and admin allowlist", () => {
  const identity = portalSsoIdentityFromClaims(
    {
      sub: "subject-123",
      email: "Admin@Example.com",
      preferred_username: "admin-user"
    },
    { adminEmails: ["admin@example.com"] }
  );

  assert.deepEqual(identity, {
    userId: "sso:subject-123",
    userEmail: "admin@example.com",
    displayEmail: "Admin@Example.com",
    authType: "sso",
    role: "admin"
  });
  assert.equal(isAdminIdentity(identity), true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/provisioning.test.js`

Expected: FAIL because the new SSO helper exports do not exist.

- [ ] **Step 3: Implement minimal SSO helper exports in `server.mjs`**

Add `createVerify` to the crypto import. Add constants for `oci_portal_sso_state`, the state map, and exported helpers with these concrete behaviors:

```js
export function portalSsoCallbackUrlFromInvokeUrl(invokeUrl = "") {
  // trim trailing slash from the hosted invoke URL and append /auth/sso/callback
}
export function resolvePortalSsoConfig(env = process.env) {
  // normalize enabled flag, domain URL, authorize URL, token URL, client ID,
  // secret, redirect URI, scope, and lower-cased admin email allowlist
}
export function portalSsoIsConfigured(config = resolvePortalSsoConfig()) {
  // return true only when enabled, domain/client/secret/redirect/scope are present
}
export function createPortalSsoState({ states = portalSsoStates, now = Date.now } = {}) {
  // generate state and nonce, store expiresAt, and return the state cookie value
}
export function consumePortalSsoState(state = "", cookieState = "", { states = portalSsoStates, now = Date.now } = {}) {
  // compare query state to cookie state, enforce expiry, delete the record, return nonce
}
export function buildPortalSsoAuthorizeUrl(config, stateRecord) {
  // build /oauth2/v1/authorize with response_type=code, client_id, redirect_uri,
  // scope, state, and nonce
}
export function portalSsoIdentityFromClaims(claims = {}, config = resolvePortalSsoConfig()) {
  // map sub/email/preferred_username to the portal identity shape and admin role
}
```

Implement only config normalization, callback URL construction, in-memory state/nonce storage, authorize URL construction, and identity mapping in this task.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/provisioning.test.js`

Expected: PASS for the new helper tests and existing provisioning tests.

### Task 2: Add OIDC Token Validation and Callback Login

**Files:**
- Modify: `tests/provisioning.test.js`
- Modify: `server.mjs`

- [ ] **Step 1: Write failing tests for ID token validation and session creation helpers**

Add tests that create an RSA keypair with `generateKeyPairSync`, sign an RS256 JWT, expose JWKS, and verify `validatePortalSsoIdToken` accepts valid claims and rejects bad nonce/audience. Add a route-level test that starts the local server, injects SSO env with mocked fetch responses, hits `/auth/sso/start`, then `/auth/sso/callback`, and expects a `Set-Cookie` header containing `oci_portal_session=`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/provisioning.test.js`

Expected: FAIL because token validation and SSO routes do not exist.

- [ ] **Step 3: Implement token exchange, JWKS validation, and routes**

In `server.mjs`, add:

```js
export async function fetchPortalSsoJson(url, options = {}, fetchImpl = fetch) {
  // fetch JSON and throw a redacted error for non-2xx or invalid JSON
}
export async function exchangePortalSsoCode(config, code, fetchImpl = fetch) {
  // POST authorization_code grant to the token endpoint with confidential-client auth
}
export async function validatePortalSsoIdToken(idToken, config, options = {}) {
  // parse JWT, load discovery/JWKS when needed, verify RS256 signature and claims
}
```

Implement RS256 JWT verification using Node `crypto.createPublicKey({ key: jwk, format: "jwk" })` and `createVerify("RSA-SHA256")`.

Add `GET /auth/sso/start` and `GET /auth/sso/callback` in the main request handler before auth gating. On callback success, create the normal portal session, open the audit session, set `oci_portal_session`, clear the SSO state cookie, and redirect to `./`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/provisioning.test.js`

Expected: PASS.

### Task 3: Update Login UI and Preserve Local `oci`

**Files:**
- Modify: `tests/provisioning.test.js`
- Modify: `server.mjs`

- [ ] **Step 1: Write failing tests for visible auth options**

Update login-page tests to assert:

```js
assert.match(rootHtml, /Sign in with Oracle SSO/);
assert.match(rootHtml, /action="\\.\\/login"/);
assert.doesNotMatch(rootHtml, /Protected user sign-up/);
```

Add a source scan asserting `/signup` route is no longer exposed from the main login UI.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/provisioning.test.js`

Expected: FAIL because login page still shows protected-user signup and no SSO button.

- [ ] **Step 3: Update `renderLoginPage`**

Show a relative-link or form button to `./auth/sso/start` when SSO is configured. Keep the local `oci` username/password form. Remove the protected-user signup form from the login page.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/provisioning.test.js`

Expected: PASS.

### Task 4: Wire RMS and DevOps SSO Configuration

**Files:**
- Modify: `tests/provisioning.test.js`
- Modify: `infra/resource-manager-demo/variables.tf`
- Modify: `infra/resource-manager-demo/main.tf`
- Modify: `infra/hosted-agentic-applications/variables.tf`
- Modify: `infra/hosted-agentic-applications/locals.tf`
- Modify: `infra/devops-hosted-image-build/variables.tf`
- Modify: `infra/devops-hosted-image-build/main.tf`
- Modify: `infra/devops-hosted-image-build/scripts/deploy_portal_hosted_application.sh`

- [ ] **Step 1: Write failing Terraform/provisioning tests**

Add assertions that:

```js
assert.match(resourceManagerVariables, /variable "portal_sso_enabled"/);
assert.match(resourceManagerVariables, /variable "portal_sso_admin_emails"/);
assert.match(resourceManagerMain, /portal_sso_enabled\\s+=\\s+var\\.portal_sso_enabled/);
assert.match(devopsVariables, /variable "portal_sso_enabled"/);
assert.match(portalScript, /OCI_PORTAL_SSO_ENABLED/);
assert.match(portalScript, /auth\\/sso\\/callback/);
assert.match(portalScript, /identity-domains app patch/);
assert.match(portalScript, /allowedGrants/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/provisioning.test.js`

Expected: FAIL because Terraform and script SSO wiring is missing.

- [ ] **Step 3: Add Terraform variables and module wiring**

Add Resource Manager variables:

```hcl
variable "portal_sso_enabled" { type = bool default = true }
variable "portal_sso_admin_emails" { type = list(string) default = [] }
variable "portal_sso_redirect_uris" { type = list(string) default = [] }
```

Pass them into `module.devops_hosted_image_build` and pass `portal_sso_redirect_uris` into `module.hosted_agentic_applications` as `hosted_app_idcs_redirect_uris`.

Add corresponding variables in `infra/devops-hosted-image-build/variables.tf`, add build-run arguments in `main.tf`, and include them in the portal deploy stage environment.

- [ ] **Step 4: Update the portal deploy script**

In `deploy_portal_hosted_application.sh`:

- derive `portal_sso_callback_url="${invoke_url "$app_id"}auth/sso/callback"`,
- patch the existing IDCS app to include the callback redirect URI and `authorization_code`,
- pass `OCI_PORTAL_SSO_*` environment variables to the hosted portal app,
- keep secret values as Vault references,
- do not print the client secret.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/provisioning.test.js`

Expected: PASS.

### Task 5: Final Verification

**Files:**
- All modified files

- [ ] **Step 1: Run syntax checks**

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Run Terraform formatting checks**

Run:

```bash
terraform -chdir=infra/resource-manager-demo fmt -check
terraform -chdir=infra/hosted-agentic-applications fmt -check
terraform -chdir=infra/devops-hosted-image-build fmt -check
```

Expected: all exit 0.

- [ ] **Step 4: Review git diff**

Run: `git diff --stat` and `git diff --check`.

Expected: no whitespace errors; only SSO-related files changed.
