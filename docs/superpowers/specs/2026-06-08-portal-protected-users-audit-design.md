# Portal Protected Users and Audit Design

## Goal

Add email/password sign-in and sign-up to the OCI Enterprise AI Portal while preserving the existing default `oci` credentials. Store protected user credentials in Autonomous Database using salted password hashes, and add user-aware activity reporting for logins, demo runs, hosted launches, durations, and status.

## Approved Approach

Use approach 1: keep the Node portal as the HTTP/UI process and add a small Python-backed Autonomous Database auth/audit store. The existing container already builds a Python virtual environment, so this avoids adding a Node database driver and keeps the portal dependency model simple.

The implementation will use `python-oracledb` in thin mode. The Resource Manager stack will pass Autonomous Database connection metadata to the portal container. The database password remains in OCI Vault and is fetched by the portal with resource principal permissions.

Oracle Autonomous Database supports Python thin-driver connections with walletless TLS when the database allows TLS, and wallet/mTLS when policy requires it. This demo stack will prefer walletless TLS for the portal auth store and keep the connection path explicit in runtime config.

## Current State

The portal currently has:

- A fixed bootstrap username: `oci`.
- A generated or supplied bootstrap password stored outside the browser.
- An in-memory session token set.
- Basic Auth compatibility used by smoke tests and deployment checks.
- Demo run history written to local JSON files and Object Storage records.
- No persistent user identity attached to sessions, launches, or demo runs.
- No direct Autonomous Database client in the portal server.

These behaviors must remain working after the change.

## User Model

There will be two principal types:

- `bootstrap`: the existing `oci` account. It remains an admin path, supports the existing password, and continues to work with form login and Basic Auth.
- `protected_user`: a signed-up email/password account stored in Autonomous Database.

Signed-up users default to role `user`. The `oci` bootstrap account has role `admin`. Admin-wide activity pages and filters require role `admin`; normal users can authenticate, run demos, launch hosted UIs, and see their own run activity where exposed.

Open signup is enabled because the requested flow is email/password sign-up from the UI. Duplicate emails are rejected case-insensitively.

## Credential Storage

Passwords are never stored reversibly. The database stores:

- `password_salt`: random per-user salt.
- `password_hash`: PBKDF2-HMAC-SHA256 hash.
- `hash_algorithm`: `PBKDF2-HMAC-SHA256`.
- `hash_iterations`: an implementation constant, initially at least 210000.

Verification uses constant-time comparison. The raw password is only held in memory for the duration of a sign-in or sign-up request and is never logged.

Signup requires a syntactically valid email address and a password of at least 12 characters. Password quality errors are shown only in the signup form and are not written to audit details.

## Database Schema

The Python auth store initializes schema idempotently on startup or first use.

### `PORTAL_PROTECTED_USERS`

- `user_id`: stable generated identifier.
- `email`: normalized lowercase email, unique.
- `display_email`: original user-facing email casing.
- `password_salt`: base64 salt.
- `password_hash`: base64 hash.
- `hash_algorithm`: algorithm name.
- `hash_iterations`: numeric iteration count.
- `role`: `user` or `admin`.
- `status`: `active`, `disabled`, or `locked`.
- `created_at`: timestamp.
- `updated_at`: timestamp.
- `last_login_at`: timestamp.
- `failed_login_count`: numeric counter.

### `PORTAL_AUTH_SESSIONS`

- `session_id`: generated identifier for audit correlation.
- `session_token_hash`: HMAC-SHA256 hash of the browser session token, never the raw token.
- `user_id`: protected user id or `bootstrap:oci`.
- `user_email`: normalized email or `oci`.
- `auth_type`: `protected_user` or `bootstrap`.
- `role`: effective role at login time.
- `login_at`: timestamp.
- `last_seen_at`: timestamp.
- `logout_at`: timestamp.
- `expires_at`: timestamp.
- `status`: `active`, `expired`, or `logged_out`.
- `ip_hash`: HMAC-SHA256 hash of client IP when available.
- `user_agent_hash`: HMAC-SHA256 hash of user agent when available.

### `PORTAL_AUDIT_EVENTS`

- `event_id`: generated identifier.
- `session_id`: nullable session identifier.
- `user_id`: protected user id or `bootstrap:oci`.
- `user_email`: normalized email or `oci`.
- `auth_type`: `protected_user`, `bootstrap`, or `anonymous`.
- `event_type`: `signup`, `login`, `login_failed`, `logout`, `demo_run`, `hosted_launch`, `admin_query`.
- `feature_id`: nullable demo feature id.
- `action`: run or launch action.
- `status`: `success`, `failed`, `blocked`, or `unknown`.
- `duration_ms`: nullable numeric duration.
- `created_at`: timestamp.
- `request_id`: generated request correlation id.
- `details_json`: redacted JSON details.

## Auth Store Boundary

Add `backend/portal_auth_store.py` as a command-style helper invoked by `server.mjs` with JSON stdin/stdout. It owns:

- schema initialization,
- signup,
- login verification,
- session audit open/touch/close,
- audit event insert,
- user activity queries,
- run summary queries by user, feature, status, and duration.

Node owns:

- HTTP routing,
- cookies,
- in-memory active session map,
- UI rendering,
- authorization decisions after a session is established,
- passing identity into demo runs and hosted launch logs.

This keeps database logic isolated and testable without spreading SQL through `server.mjs`.

## Server Flow

`server.mjs` will replace boolean-only auth checks with an identity resolver:

- If a valid session cookie exists, return its stored identity.
- If Basic Auth matches `oci`, return bootstrap admin identity.
- If neither exists, request login.

`POST /login` accepts either:

- username `oci` plus the existing bootstrap password, or
- an email plus a protected-user password verified through the auth store.

`POST /signup` creates a protected user through the auth store, signs the user in, records `signup` and `login` events, and redirects to the portal.

`POST /logout` closes the current session audit record when available, removes the in-memory session, clears the cookie, and preserves the existing redirect behavior.

If ADB auth storage is not configured or temporarily unavailable, protected-user login/sign-up returns a clear UI error, but the `oci` bootstrap login remains available.

## Demo and Launch Audit

Every demo run should include the resolved identity in the redacted run record:

- `userId`
- `userEmail`
- `authType`
- `sessionId`

`writeDemoLog()` and `writePersistentDemoRunRecord()` will preserve this identity metadata without exposing secrets. For each demo run and hosted UI/API launch, the server writes a best-effort `PORTAL_AUDIT_EVENTS` row with feature id, action, status, duration, and redacted details.

Audit insert failures must not fail the demo. They should be recorded in server logs with redaction.

## Administration UI

The existing Administration area will gain user-aware filters in the runs/logs views:

- user/email,
- from timestamp,
- to timestamp,
- feature/demo,
- status,
- event type.

Admin users see all activity. In the first implementation, `/admin.html` and `/api/admin/*` require role `admin`; signed-up protected users do not receive admin access by default. The bootstrap `oci` account is an admin and can see all users, login sessions during a duration, demos executed, launch events, and status.

The UI should keep the current compact admin style and add only relevant controls. It should not add another large card layer.

## Infrastructure

Reuse the same Autonomous Database created by the `infra/nl2sql-sql-search` module. Do not create a second database for portal users or audit logs.

Extend the Resource Manager/DevOps wiring to pass the NL2SQL Autonomous Database details from the stack into the portal deployment:

- database connect string,
- database username,
- database password secret OCID,
- auth store mode,
- optional wallet/mTLS variables if a deployment disables walletless TLS.

The portal container will fetch the database password from Vault using resource principal. The existing shared-demo security policy already allows the dynamic group to read secrets.

Add `python-oracledb` to `requirements.txt`. The Dockerfile does not need a Node dependency install change for this approach.

## Error Handling

- Invalid signup email or weak password returns a form-level error.
- Duplicate email returns a form-level error without revealing extra account details beyond the submitted email already being registered.
- Disabled or locked users cannot sign in.
- ADB unavailable disables protected-user auth but not bootstrap `oci`.
- Audit write failures are best effort and do not block demos.
- Admin audit queries return an empty result with an error message if ADB is unavailable.
- Sensitive values are passed through existing redaction helpers before logs or UI responses.

## Testing

Add focused tests for:

- `oci` login still works through form and Basic Auth.
- Protected-user signup stores a salted hash and never returns or logs the password.
- Protected-user login verifies correct passwords and rejects incorrect passwords.
- Duplicate email signup is rejected.
- Session identity is attached to demo run records.
- Audit events are written for login, signup, logout, demo run, and hosted launch.
- Admin queries filter by user, duration, feature, event type, and status.
- Protected non-admin users cannot retrieve all-user audit data.
- ADB-unavailable mode preserves bootstrap login.

Run the existing validation set after implementation:

- `npm test`
- `npm run build`
- Python syntax checks for the new helper
- Terraform format/validate for touched infra modules

## Deployment

Implementation deployment should:

1. Bump the app version and changelog.
2. Commit code changes.
3. Push to `oci-rms`.
4. Run a new Resource Manager apply job.
5. Confirm DevOps build and portal deployment succeed.
6. Confirm the active load balancer backend points to the new container instance.
7. Verify live login for `oci`, sign-up/sign-in for a protected user, one demo run, one hosted launch audit event, and admin filtering.

## Out of Scope

- Replacing the bootstrap `oci` account.
- Storing reversible password values.
- Full user management UI for role promotion or disabling users.
- External identity provider/OAuth login.
- Making audit writes a hard dependency for demo execution.

## References

- Oracle Autonomous Database Python walletless TLS documentation: https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/connecting-python-tls.html
- Oracle Autonomous Database Python wallet/mTLS documentation: https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/connecting-python-mtls.html
