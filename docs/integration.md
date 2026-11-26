# Domain and integration

[Documentation index](README.md) · [Repository instructions](../AGENTS.md)

**Status:** This page records the design from repository instructions and skills. The public edge,
the logs and the telemetry start-up are implemented and covered by `tests/gateway.int-spec.ts`; the
routes of `openapi/public/auth.yaml` and the client of identity-service are implemented (see
[Authentication routes](#authentication-routes)) and covered by the route tests and
`tests/auth.int-spec.ts`; personal API tokens, scopes, the organization context, the rate limit and
the routes of `organizations.yaml`, `members.yaml` and `api-tokens.yaml` are implemented (see
[Credentials, scopes and rate limit](#credentials-scopes-and-rate-limit)) and covered by the route
tests and `tests/rate-limit.int-spec.ts`; the account security routes of `auth.yaml` are
implemented (see [Account security routes](#account-security-routes)) and covered by the route
tests and `tests/account-security.int-spec.ts`; the task core routes of `spaces.yaml`, `lists.yaml`
and `tasks.yaml` and the client of task-service are implemented (see
[Task core routes](#task-core-routes)) and covered by the route tests, the client tests and
`tests/tasks.int-spec.ts`; the sharing, access request, archive, trash and deletion routes are
implemented (see [Access, archive and trash routes](#access-archive-and-trash-routes)) and covered
by the route tests, the client tests and `tests/task-access-lifecycle.int-spec.ts`.

## Public and internal boundaries

The public route contract is owned by `cadenway-api-contracts`; internal service calls use generated clients. Public unauthenticated routes and aggregate composition are listed in [AGENTS.md](../AGENTS.md). The gateway does not own domain decisions or another service's database.

## Authentication routes

The ten routes of `openapi/public/auth.yaml` (version 1.0.0, `@cadenway/contracts` 0.5.1), each
mapped to its internal route of `openapi/internal/identity-service.yaml`:

| Public route                              | Guards                         | Internal call, actor                                            |
| ----------------------------------------- | ------------------------------ | --------------------------------------------------------------- |
| `POST /v1/auth/sign-in-methods`           | Cross-site                     | `POST /internal/v1/auth/sign-in-methods`, `anonymous`           |
| `POST /v1/auth/sign-up`                   | Cross-site                     | `POST /internal/v1/auth/sign-up`, `anonymous`                   |
| `POST /v1/auth/sign-up/code`              | Cross-site                     | `POST /internal/v1/auth/sign-up/code`, `anonymous`              |
| `POST /v1/auth/sign-up/verification`      | Cross-site                     | `POST /internal/v1/auth/sign-up/verification`, `anonymous`      |
| `POST /v1/auth/sign-in`                   | Cross-site                     | `POST /internal/v1/auth/sign-in`, `anonymous`                   |
| `POST /v1/auth/sign-in/code`              | Cross-site                     | `POST /internal/v1/auth/sign-in/code`, `anonymous`              |
| `POST /v1/auth/sign-in/code/verification` | Cross-site                     | `POST /internal/v1/auth/sign-in/code/verification`, `anonymous` |
| `POST /v1/auth/sign-out`                  | Cross-site, session (optional) | `DELETE /internal/v1/sessions/{sessionId}`, `user`              |
| `GET /v1/me`                              | Session                        | `GET /internal/v1/users/{userId}`, `user`                       |
| `PATCH /v1/me`                            | Cross-site, session            | `PATCH /internal/v1/users/{userId}`, `user`                     |

- **Credential guard** (`src/modules/auth/presentation/http/guards/credential/credential.guard.ts`, see
  [Credentials, scopes and rate limit](#credentials-scopes-and-rate-limit)): reads `__Host-cw_session` and introspects it with
  `POST /internal/v1/tokens/introspect` as the actor `system` on every request, without a cache, so
  a revoked session stops at the next request. No cookie answers `401 auth.session-required`; a
  cookie that is not active, or that cannot be a token, `401 auth.session-expired`. An active
  session opens the organization context of the request with `setRequestOrganizationContext`: a
  user actor, and the organization, role and scopes of the introspection. A route without a
  session (`security: []`) never reads the cookie or a bearer token, so a stale one is ignored.
- **Cross-site check** (`src/modules/auth/presentation/http/validation/session/cross-site.validation.ts`): every unsafe route needs an `Origin` exactly
  equal to one of `ALLOWED_ORIGINS` and `Content-Type: application/json`, signed in or not
  (see [Decisions](#decisions-of-the-walking-skeleton)), else `403 auth.csrf-rejected` before the
  route runs. The credential guard applies it to every unsafe request the cookie authenticates.
  An empty `DELETE` or explicitly opted-in Inbox or reminder POST may omit the media type.
- **Cookie** (`src/presentation/http/session/session-cookie.ts`): `__Host-cw_session=<token>; Path=/; Secure; HttpOnly;
SameSite=Lax`, plus `Max-Age` (the seconds until `session.expiresAt`) for a persistent session
  only; the sign-out clears it with `Max-Age=0`. The token leaves the gateway in this header only.
- **Browser**: `client.ipAddress` is `request.ip` behind one trusted proxy hop, `client.userAgent`
  the `User-Agent` header (`null` without one, cut to 1024 code points).
- **Sign-up verification**: the `password` of the body, the one typed in the sign-up form, is
  forwarded to identity-service unchanged when the browser sends it and left out when it does not;
  it is never logged. With the right code, identity-service answers `422 auth.sign-up-replaced`
  when it is not the password of the latest sign-up of the address, or is missing after a repeated
  sign-up; the sign-in by code does not declare that code and answers it `503 upstream.failed`.
- **Answers**: every answer of these routes carries `Cache-Control: no-store`; `GET /v1/me` carries
  `ETag`. A route that sends a code answers `202`, one that signs in `200`, the sign-out `204`.
- **Errors** (`src/problems/`): an internal client error is answered with its `code` and its
  `details` (without `service`) when the public operation declares that status and code, under the
  French title the gateway owns for the codes the web application shows as is; a
  `429` gets `Retry-After` from `details.lockedUntil`, `details.resendAvailableAt` or
  `details.nextAvailableAt`. A refused
  internal token (`401`, or `403` refusing the issuer, the actor or the organization) is
  `503 upstream.unauthorized`; any other client error is `503 upstream.failed`, so an internal
  `404` never surfaces as a `403` or reveals another tenant. The sign-out treats
  `404 session.not-found` as an ended session, and `GET /v1/me` answers `404 user.not-found` as
  `401 auth.session-expired`. When identity-service cannot answer, the sign-out answers `503` and
  keeps the cookie, so it can be retried.

### Account security routes

Phase P2c-1 of the integration plan, `@cadenway/contracts` 0.7.0: the password reset, the recent
re-authentication, the password, the address, the deletion and the open sessions.

| Public route                                | Guards                         | Internal call, actor                                                                    |
| ------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------- |
| `POST /v1/auth/password-reset`              | Cross-site                     | `POST /internal/v1/auth/password-reset`, `anonymous`                                    |
| `POST /v1/auth/password-reset/inspection`   | Cross-site                     | `POST /internal/v1/auth/password-reset/inspection`, `anonymous`                         |
| `POST /v1/auth/password-reset/confirmation` | Cross-site                     | `POST /internal/v1/auth/password-reset/confirmation`, `anonymous`                       |
| `POST /v1/auth/reauthentication`            | Cross-site, session            | `POST /internal/v1/sessions/{sessionId}/reauthentication`, `user`                       |
| `PUT /v1/me/password`                       | Cross-site, session            | `PUT /internal/v1/users/{userId}/password` (body `sessionId`), `user`                   |
| `POST /v1/me/email-change`                  | Cross-site, session            | `POST /internal/v1/users/{userId}/email-change` (body `sessionId`), `user`              |
| `POST /v1/me/email-change/confirmation`     | Cross-site, session            | `POST /internal/v1/users/{userId}/email-change/confirmation` (body `sessionId`), `user` |
| `POST /v1/me/deletion`                      | Cross-site, session            | `POST /internal/v1/users/{userId}/deletion` (body `sessionId`), `user`                  |
| `GET /v1/sessions`                          | Session                        | `GET /internal/v1/users/{userId}/sessions?currentSessionId=`, `user`                    |
| `DELETE /v1/sessions/{sessionId}`           | Cross-site (`Origin`), session | `DELETE /internal/v1/sessions/{sessionId}` with the id of the path, `user`              |
| `POST /v1/sessions/revoke-others`           | Cross-site, session            | `POST /internal/v1/sessions/{sessionId}/revoke-others`, `user`                          |

- **Password reset.** The three routes carry no session (`security: []`): the credential guard
  reads neither the cookie nor a bearer token, the rate limit counts them on the client address
  (60 per minute), and none signs in. The reset token arrives in the body, never in a URL: the
  link keeps it in its fragment (`#token=`), which only the browser reads. identity-service
  throttles the requests of an address (`429 auth.reset-throttled`, `Retry-After` from
  `details.resendAvailableAt`).
- **Session of the request.** The routes of the signed-in person send identity-service the session
  the introspection returned, never one the request names: in the path, in the body
  (`sessionId`) or in the query (`currentSessionId`). identity-service answers
  `404 session.not-found` when it is no longer an open session of the user, which the gateway
  answers `401 auth.session-expired`, as `404 user.not-found`; only
  `DELETE /v1/sessions/{sessionId}`, whose id comes from the public path, relays
  `404 session.not-found` as is. The creation of a personal API token sends the session too
  (`sessionId`).
- **Recent authentication.** identity-service decides it: the change of address, the deletion and
  the creation of a personal API token relay its `403 auth.reauthentication-required` with
  `details.methods` and the French title of the contract.
- **Deletion.** The `202` clears the session cookie (`Max-Age=0`): identity-service has revoked
  every session and token of the account. A refused deletion leaves the cookie.
- **Answers.** `passwordChangedAt` is passed on in `CurrentUser` when identity-service sends it,
  and the routes that sign in pass `deletionCancelled` on. Every answer of the tags `auth`,
  `account` and `sessions` carries `Cache-Control: no-store`; the answers carrying the account
  carry its `ETag`.
- **Retries.** The password change is not retried after a connection error or a `503`, although
  it is a `PUT`: a change identity-service already applied would be repeated with a current
  password that no longer works, counting a failure towards the lockout. The list of sessions is
  retried once, as any `GET`, and the revocation of one session once, as any `DELETE`; the other
  new calls are `POST` and are not retried.
- **Re-authentication guards.** `POST /v1/auth/reauthentication` needs a session, so it is served
  by its own controller with the guards of the session routes rather than behind `CsrfGuard`: a
  request without a cookie answers `401 auth.session-required`, a cookie request without an
  allowed `Origin` `403 auth.csrf-rejected`, and a personal API token, which needs no `Origin`,
  `403 auth.api-token-not-accepted`.
- **Internal `400`.** A route whose internal request the gateway builds from the introspection
  alone (the deletion, the closing of the other sessions, and the revocation of a session, whose
  id is checked as a UUID) answers an internal `400` as `503 upstream.failed`, as the sign-out
  does: it is a defect, not something the browser sent.
- **Secrets.** Passwords, reset tokens and codes travel in request bodies only and are never
  logged (`tests/account-security.int-spec.ts` checks the log lines).

### Two-step verification routes

Phase P2c-2 of the integration plan, `@cadenway/contracts` 0.8.0: the two-step challenge of the
sign-ins, trusted devices, the two-step verification of the account, the authentication policy of
an organization and its withheld organization.

| Public route                                                             | Guards                            | Internal call, actor                                                                           |
| ------------------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `POST /v1/auth/sign-in/challenge/inspection`                             | Cross-site                        | `POST /internal/v1/auth/sign-in/challenge/inspection`, `anonymous`                             |
| `POST /v1/auth/sign-in/challenge/authenticator-app`                      | Cross-site                        | `POST /internal/v1/auth/sign-in/challenge/authenticator-app`, `anonymous`                      |
| `POST /v1/auth/sign-in/challenge/backup-code`                            | Cross-site                        | `POST /internal/v1/auth/sign-in/challenge/backup-code`, `anonymous`                            |
| `POST /v1/auth/sign-in/challenge/security-key/options`                   | Cross-site                        | `POST /internal/v1/auth/sign-in/challenge/security-key/options`, `anonymous`                   |
| `POST /v1/auth/sign-in/challenge/security-key`                           | Cross-site                        | `POST /internal/v1/auth/sign-in/challenge/security-key`, `anonymous`                           |
| `GET /v1/me/two-step-verification`                                       | Session                           | `GET /internal/v1/users/{userId}/two-step-verification`, `user`                                |
| `DELETE /v1/me/two-step-verification`                                    | Cross-site (`Origin`), session    | `POST /internal/v1/users/{userId}/two-step-verification/disable` (body `sessionId`), `user`    |
| `POST /v1/me/two-step-verification/authenticator-app/setup`              | Cross-site, session               | `POST .../authenticator-app/setup` (body `sessionId`), `user`                                  |
| `POST /v1/me/two-step-verification/authenticator-app/setup/confirmation` | Cross-site, session               | `POST .../authenticator-app/setup/confirmation` (body `sessionId`), `user`                     |
| `POST /v1/me/two-step-verification/backup-codes/regenerate`              | Cross-site, session               | `POST .../backup-codes/regenerate` (body `sessionId`), `user`                                  |
| `POST /v1/me/two-step-verification/security-keys/registration`           | Cross-site, session               | `POST .../security-keys/registration` (body `sessionId`), `user`                               |
| `POST /v1/me/two-step-verification/security-keys`                        | Cross-site, session               | `POST .../security-keys` (body `sessionId`), `user`                                            |
| `DELETE /v1/me/two-step-verification/security-keys/{securityKeyId}`      | Cross-site (`Origin`), session    | `POST .../security-keys/{securityKeyId}/remove` (body `sessionId`), `user`                     |
| `GET /v1/organization/authentication-policy`                             | Session, organization             | `GET /internal/v1/organization/authentication-policy`, `user` of the organization              |
| `PATCH /v1/organization/authentication-policy`                           | Cross-site, session, organization | `PATCH /internal/v1/organization/authentication-policy?sessionId=`, `user` of the organization |

- **Challenge of the sign-ins.** For an account with two-step verification on a device it does
  not trust, the internal sign-ins answer `202` with a challenge, no token and no session. The
  gateway checks that body against `InspectSignInChallengeInternalResponse` (orval generates a
  response validator for the first success status only, and the inspection answers the same
  schema) and answers the same `202` with no cookie; only a `200` signs in. The challenge routes
  carry no session (`security: []`), pass the cross-site check and count on the client address
  (60 per minute), on top of the lockout of identity-service (`429 auth.two-step-locked`,
  `Retry-After` from `details.lockedUntil`).
- **Trusted devices.** The gateway reads `__Host-cw_trusted_device` on the two sign-ins only
  (password and email code) and sends it as `trustedDeviceToken` when it holds 1 to 256
  characters. A right answer of a challenge with `trustDevice` writes it from `trustedDevice`:
  `__Host-cw_trusted_device=<token>; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000`,
  beside the session cookie; a device token the answer did not ask for is never written. The
  contract clears the cookie nowhere: identity-service forgets the trusted devices (password
  change or reset, closing the other sessions, disabling two-step verification, scheduling the
  deletion) and ignores a stale cookie, so the sign-out and the deletion clear the session cookie
  only, as before.
- **Withheld organization.** Both introspections may name a `withheldOrganization`. The credential
  guard checks it before the organization and scope checks: a session answers
  `403 organization.mfa-required` (`details.organizationId`) on every operation on the current
  organization, a personal API token on every operation it may call (after
  `403 auth.api-token-not-accepted`, before `403 auth.scope-missing`). The routes that need no
  organization (the account, its two-step verification, the choice of an organization) still run,
  and the request then carries no organization context, whatever the introspection says. A code
  of `withheldOrganization` the public contracts do not declare (the internal enumeration is
  extensible) is never answered as is: the request is refused as a gateway that ignores the field
  would refuse it, `403 organization.not-selected` for a session, `403 auth.scope-missing` for a
  token.
- **Re-authentication.** `POST /v1/auth/reauthentication` passes `password` or `code` as the
  browser sent them; identity-service decides which the account needs. The gateway relays
  `403 auth.reauthentication-required` (a password for an account with two-step verification,
  with `details.methods: [authenticator-app]`) on it and on `PUT /v1/me/password`, besides the
  routes of P2c-1, the starts and removals of two-step verification and the change of the
  authentication policy.
- **Session of the request.** As in P2c-1, every route of the signed-in person sends the session
  the introspection returned, and `404 session.not-found` (or `404 user.not-found`) of
  identity-service answers `401 auth.session-expired`; `404 security-key.not-found` names the key
  of the path and is relayed as is.
- **Passed on.** `OpenSession.inactivityTimeoutMinutes` and `Member.twoStepVerificationEnabled`
  (present for the owner and the admins only) are passed on as the services send them. The
  WebAuthn options identity-service builds and the answers the browser sends are passed on whole,
  members the contract does not list included.
- **Problems.** The ten new codes have their French titles in `PROBLEM_TITLES`:
  `auth.challenge-expired`, `auth.two-step-code-invalid`, `auth.security-key-refused`,
  `auth.two-step-locked`, `auth.two-step-not-enabled`, `auth.two-step-setup-expired`,
  `auth.security-key-limit-reached`, `auth.mfa-required-by-organization`,
  `organization.mfa-required` and `security-key.not-found`.
- **Secrets.** Codes, backup codes, challenge and device tokens, the TOTP secret and its URI, and
  the WebAuthn payloads travel in bodies (and the device token in its cookie) only and are never
  logged. Every answer of the tag `two-step-verification` and of the challenge carries
  `Cache-Control: no-store`.
- **Retries.** Only the reads (`GET`) are retried once; the challenge, the setup, the keys, the
  disabling and the change of the policy are not.

### Decisions of the walking skeleton

Fixed for phase P2a of the integration plan, and open to revision by the maintainers:

- **Login cross-site check.** The gateway requires an exact allowed `Origin` and
  `Content-Type: application/json` on every unsafe route of `openapi/public/auth.yaml`, signed in
  or not, so that another site cannot sign a browser in to an account it chose. The contract
  declares `403 auth.csrf-rejected` on every one of them since `@cadenway/contracts` 0.3.1.
- **French titles.** The gateway owns the mapping from an error `code` to the French `title` of
  the public problem, for the codes the web application shows as is (`src/problems/public-problem.ts`,
  checked against the examples of the contract); the other codes keep the English reason phrase.
- **Sign-out on a failure.** When identity-service cannot revoke the session, the sign-out answers
  `503` and keeps the cookie, so that it can be retried rather than leave an active session the
  browser no longer knows.
- **Account gone.** `GET /v1/me` answers `404 user.not-found` from identity-service as
  `401 auth.session-expired`: the route declares no `404`, and the session can no longer be used.

## Credentials, scopes and rate limit

Phase P2b of the integration plan and its security follow-ups, `@cadenway/contracts` 0.6.0.

- **Security of each operation.** Every handler declares the `security` of its public operation and
  whether it acts on the current organization (`CredentialGuard.requires`), copied from the
  contract. `operation-security.validation.spec.ts` checks every handler against the shipped
  specs: the same routes, `operationId`, `security`, and `organization` when the `403` of the
  operation declares `organization.not-selected`.
- **Bearer before cookie.** A request with `Authorization: Bearer` is authenticated with that token
  alone; its cookie is ignored. A token that does not have the format of the contract answers
  `401 auth.api-token-invalid` without a call; another is introspected with
  `POST /internal/v1/api-tokens/introspect` as the actor `system`, on every request, and an
  inactive one answers `401 auth.api-token-invalid`. Then the operation must accept a token
  (`403 auth.api-token-not-accepted`) and the token must hold its scopes
  (`403 auth.scope-missing`, `details.requiredScopes`). The sign-out, whose credential is optional,
  ignores a bearer token. Another `Authorization` scheme leaves the request to its cookie. A
  malformed or inactive token counts as a failed bearer authentication of the client address (see
  the rate limit below).
- **Cross-site check.** It applies to requests the cookie authenticates, after the credential is
  known and before the introspection: no credential answers `401 auth.session-required`, not
  `403`. A `POST`, `PUT` or `PATCH` needs an exact `Origin` and `Content-Type: application/json`
  (`organizations.yaml`, `auth.yaml`). A bodiless `DELETE` and an explicitly opted-in Inbox or
  reminder POST may omit the media type. A bearer token needs no `Origin`.
- **Organization context.** The organization, role and scopes of a request come from the
  introspection only, into the internal token of every call. A session holds every scope. An
  operation on the current organization answers `403 organization.not-selected` before any call
  when the session has none; a personal token always has its organization.
- **Rate limit** (`src/modules/rate-limit/`): 600 requests per minute per session or personal API
  token, counted by `RateLimitGuard` after the credential guard on the key
  `rate-limit:<session|api-token>:<id>`, never the secret, with rate-limiter-flexible on Redis.
  Beyond, `429 rate-limit.exceeded` with `Retry-After`; no `RateLimit` header, which the contracts
  do not declare. While Redis cannot count (unreachable, not ready, or slower than 100
  milliseconds), the request, and those of the next second, are counted in the memory of the
  instance with the same quota, logged once per outage: the routes stay available, and a
  credential is still limited per instance. Once a second, one request tries Redis again while
  the others keep counting in memory.
- **Limits per client address** (decision 2 of the P2b security follow-ups), with the same `429`,
  `Retry-After` and Redis fallback; a request with a valid session or token keeps only the limit
  of its credential:
  - A request without a credential (the routes of `auth.yaml` with `security: []`, and a sign-out
    without an active session) is counted by `RateLimitGuard` on its client address: 60 per
    minute (`rate-limit:anonymous:<pseudonym>`). A malformed body is counted too; a request the
    cross-site check refuses is not.
  - Failed bearer authentications (`401 auth.api-token-invalid`, a malformed token included) are
    limited to 10 per minute per client address (`rate-limit:bearer-failures:<pseudonym>`). The
    credential guard reads that counter before it looks at a bearer token; past the limit, every
    bearer token from the address answers `429` without an introspection, a valid one too, until
    the window ends, while its sessions are unaffected.
  - The client address is `request.ip` behind one trusted hop, the address Traefik saw, the one
    identity-service records with a session; an IPv6 address counts with its whole `/64`. A key
    holds a pseudonym, never the address: 128 bits of an HMAC-SHA-256 under a key derived with
    HKDF from the private part of `INTERNAL_TOKEN_PRIVATE_JWK`, which every instance holds. An
    unkeyed hash of an IPv4 address would be reversed by hashing the 2^32 addresses. No log line
    carries an address or a pseudonym.
  - While Redis cannot count, the memory fallback holds at most 50,000 keys per counter; new keys
    then share one overflow window. A burst of bad tokens sent concurrently can pass the 10
    failures by the requests it keeps in flight, once per window (see the rate-limit
    `MODULE.md`).
- **Errors.** Each route answers the client errors its operation declares, with the French title
  of the contract; any other is `503 upstream.failed`. On a route about one member or invitation,
  `404 organization.not-found` (the caller left the organization) answers the
  `404 member.not-found` or `404 invitation.not-found` the operation declares. On the choice of
  organization, `404 session.not-found` answers `401 auth.session-expired`. `ETag` comes from the
  `version` of the answer; `If-Match` is relayed unchanged unless blank (see Gateway Patterns).
- **Invitation emails.** organization-service limits them; the gateway relays its refusals with
  their French titles, their `details` and `Retry-After`, the seconds until the instant of the
  details, rounded up:
  - `POST /v1/invitations`: `429 invitation.daily-limit-reached` ("Limite d’invitations atteinte
    pour aujourd’hui : réessayez plus tard."), with `details.remaining` and
    `details.nextAvailableAt`, when the batch needs more of the 100 invitation emails an
    organization may cause in any 24 hours than remain;
  - `POST /v1/invitations/{invitationId}/resend`: `429 invitation.resend-throttled` ("Cette
    invitation vient d’être renvoyée : réessayez dans une heure."), with
    `details.resendAvailableAt`, within an hour of the last email of the invitation, and
    `429 invitation.daily-limit-reached`, with `details.remaining: 0` and
    `details.nextAvailableAt`.

  A code a route does not declare (`invitation.resend-throttled` on `POST /v1/invitations`) is
  `503 upstream.failed`.

- **Query parameters.** The validators generated from the contracts read `limit` from its text;
  the gateway only splits the `role` of `GET /v1/members` on its commas before validation.

## Gateway Patterns

Source: `cw-gateway-patterns` ([Claude](../.claude/skills/cw-gateway-patterns/SKILL.md), [Codex](../.codex/skills/cw-gateway-patterns/SKILL.md)).

### An authenticated route

```text
request → auth guard (token) → scope guard → organization context → rate limit
        → controller → internal client(s) → mapping to openapi/public → response
```

- Every route that relays `If-Match` reads it with `@IfMatchHeader()` (`src/presentation/http/`):
  an absent header stays absent, a present but blank one answers `400 request.invalid` with an
  issue `{ in: header, path: If-Match }` before any call, since the owning service would take it
  for an absent one. Blank means that no member of its comma-separated list is left after
  JavaScript `trim()`, as the owning service reads it: empty, white space only (a no-break space
  included) or commas and white space only (the `", "` of two empty headers). Any other value,
  `W/"7"` and `*` included, is relayed unchanged.
- Every task-domain route whose operation marks `requestBody.required: true` reads its body with
  `@RequiredBody(validator)`, which refuses with `400 request.invalid` before any call a request
  declaring `Content-Length: 0` (issue `{ in: body, path: '', code: required }`), since the JSON
  parser of `@cadenway/nest-common` hands it on as `{}`, and a `Content-Type` other than
  `application/json` with no `charset` or `charset=utf-8` (issue `code: unsupported_media_type`),
  since the form parser NestJS registers turns a body such as `&` into `{}` too. A literal `{}`
  still reaches the validator. Known limit: any JSON body whose decoded text is empty (an empty
  chunked body, an empty body under a `Content-Encoding`, a lone UTF-8 byte-order mark) also
  arrives as `{}` and cannot be told apart in the gateway; that belongs to the parser of
  cadenway-service-kit, which should leave such a body `undefined`.

### Task core routes

- The 29 routes of `openapi/public/spaces.yaml`, `lists.yaml` and `tasks.yaml` call
  task-service through the client generated from `openapi/internal/task-service.yaml`
  (`TASK_SERVICE_URL`), with the user and organization of the verified credential in the
  internal token. Reads need `tasks:read` and writes `tasks:write` for a personal API token,
  spaces and lists included; every route acts on the current organization.
- The client checks each query and body against the internal contract before the call and each
  answer after it; the route maps the answer through its public validator. The gateway reads
  identifiers and versions where needed for public `Location` and `ETag` headers.
- Each route relays only the client errors its public operation declares, with their French
  titles; any other is `503 upstream.failed`. `If-Match`, `Idempotency-Key`, `today` and every
  query parameter are relayed as declared; `ETag` and `Location` are answered as the public
  operation declares them.
- `GET /v1/tasks/{taskKey}/detail` is an aggregate: the core of task-service is its main part,
  and the first comments page is read in parallel within 800 ms. A comments-only upstream
  failure omits the page and names `comments` in `partial`; a visibility denial fails the detail.
  The first page of Git links (`development`) is read from integration-service
  (`listTaskGitLinksInternal`) once the core answered, which authorizes the actor, within its own
  800 ms; any failure of it omits `development` and names it in `partial`. Attachments remain a
  future secondary part.
- `GET /v1/tasks/{taskKey}/git-links` reads the task through task-service, then relays the page
  read to integration-service (`INTEGRATION_SERVICE_URL`) for the same user and organization.

### Access, archive and trash routes

- The 23 routes of phase P3b-1 follow the task core rules above: the 10 of
  `openapi/public/access.yaml` (grants of spaces and lists, access requests), the 6 of
  `archives.yaml`, the 5 of `trash.yaml`, `DELETE /v1/spaces/{spaceId}` and
  `DELETE /v1/lists/{listId}`. Reads need `tasks:read` and writes `tasks:write`; there is no
  sharing scope.
- task-service decides every role and state: `403 access.role-insufficient`,
  `403 space.manage-forbidden`, `409 task.archived` and `404 task.trashed` (with the trash entry
  in `details`, the detail aggregate included) are relayed as each public operation declares
  them, on the task core routes too.
- A grant change answers the `ETag` task-service gives for the version of the space or the list;
  `POST /v1/access-requests` answers `202` without a body, and its
  `429 access-request.limit-reached` gets `Retry-After` from `details.nextAvailableAt`.
- Empty request bodies (`EmptyRequest`) refuse any member, as the contract declares.
- The internal routes `GET /internal/v1/lists/{listId}/access` and
  `GET /internal/v1/tasks/{taskKey}/access` belong to cadenway-realtime-gateway: the client of the
  gateway has no method for them, and its tests check it.

### An aggregate

1. Start the calls that do not depend on each other together.
2. Give each a timeout (default 800 ms for secondary parts, the route budget for the main one).
3. If the main service fails, the route fails. If a secondary service fails, omit and flag
   that part when the public contract allows a partial response. Otherwise return the contract-defined error.
4. Map to the public contract; never forward internal shapes.

### Deadlines and internal calls

- A public route has a default budget of 10 seconds. It travels as a deadline: each internal call gets the
  time left, never its own fresh timeout.
- One internal call waits 2 seconds at most, or the time left when that is shorter. The cap also
  bounds the main call of an aggregate.
- CSV export allows up to 120 seconds to prepare the download. Its Task call keeps the
  two-second header deadline and reads the body within the time left. The gateway prepares the
  file on disk before sending headers. It closes a download after 30 seconds without progress.
- One retry, only on a connection error or a `503`, and only for an idempotent call.
- One circuit breaker per service: while it is open, the call fails at once, as a failing main or
  secondary service does in an aggregate. Integration-service's breaker is shared by the webhook
  relay and the task Git link read: five failed link reads open it for webhook deliveries too, which
  then answer `503 upstream.circuit-open` and are not redelivered by GitHub. Known limit until the
  provider reconciliation of gap B5; a separate transport for the read is the fix if it bites.
- Deadline, retry and breaker belong to the internal HTTP client of `@cadenway/nest-common`; a route
  does not re-implement them.

### Errors

Internal `404` of another organization's resource becomes a public `404`, never `403`: the existence of
another tenant's data is not revealed.

Every error leaves as `application/problem+json` (RFC 9457): `type`, `title`, `status`, `detail`,
`instance`, plus `code` and, when the contract defines them, `details`.

- `code` is `<domain>.<reason>` in kebab-case and stable; its text is French when the webapp shows it
  as is.
- The response carries `X-Request-Id`, the reference the webapp displays.
- The error filter comes from `@cadenway/nest-common`; an internal problem document is translated to
  the public contract, never forwarded.
- Known limit: the `details` of a relayed problem are forwarded as task-service, identity-service or
  organization-service sent them, without `service` but without a check of their members (the
  public `Problem.details` is an open object). Today the internal and public `details` of every
  relayed code are declared identical; an allow-list of the declared members per code in
  `src/problems/` would keep a member a service adds later from reaching the applications before
  the public contract declares it.

## Auth Tokens

Source: `cw-auth-tokens` ([Claude](../.claude/skills/cw-auth-tokens/SKILL.md), [Codex](../.codex/skills/cw-auth-tokens/SKILL.md)).

| Token              | Issued by                                          | Carries                                           | Used for              |
| ------------------ | -------------------------------------------------- | ------------------------------------------------- | --------------------- |
| Session            | identity-service (or the chosen identity provider) | user, organization, member role                   | webapp                |
| Personal API token | identity-service                                   | user, organization, scopes                        | integrations, scripts |
| Internal token     | this gateway, short-lived                          | user, organization, member role, scopes, trace id | calls to services     |

- A session token switches organization only through the explicit organization-selection flow.
- Scopes are checked per route, from the `security` of its public operation; a session holds
  every scope, a personal API token its own.

### Session

- The session token is opaque: 256 random bits, stored by identity-service as a SHA-256 hash. It
  carries nothing itself: the user, organization and member role of the table are what
  introspection returns.
- The webapp holds it in the cookie `__Host-cw_session; HttpOnly; Secure; SameSite=Lax`.
- Every request verifies its token with `POST /internal/v1/tokens/introspect` at identity-service,
  through the generated client and without a cache: a revoked session stops at the next request.
  Known cost: while identity-service is unavailable, so is the API.
- CSRF: a request with an unsafe method (`POST`, `PUT`, `PATCH`, `DELETE`) authenticated by the
  session cookie must carry an `Origin` that is exactly one of the allowed origins (the webapp and
  the website, as for CORS) and `Content-Type: application/json`. A bodiless `DELETE` and the
  explicitly opted-in bodyless Inbox and reminder POST operations may omit the media type.
  Every CSRF refusal happens before introspection.

### Personal API token

- Format: `cw_pat_`, then 30 base62 characters, then 6 characters of CRC32 check.
- identity-service stores its SHA-256 hash, gives it an expiry and shows it once.
- Sent as `Authorization: Bearer`; such a request is authenticated with that token alone and its
  cookie ignored. Every request introspects it with `POST /internal/v1/api-tokens/introspect`, as
  the actor `system` and without a cache; the introspection returns its user, organization, role
  and scopes. It needs no `Origin`: it is no ambient credential.
- A route whose `security` names no `apiToken` answers `403 auth.api-token-not-accepted`; a token
  without the scopes of the `apiToken` requirement `403 auth.scope-missing`.
- Failed bearer authentications are limited per client address: once an address has had 10
  tokens refused (`401 auth.api-token-invalid`, malformed ones included) in the current minute,
  every bearer token it sends answers `429 rate-limit.exceeded` with `Retry-After` before any
  introspection, a valid one too, until the window ends. A valid token counts no failure and keeps
  only its own limit; the sessions of the address are unaffected.

### Internal token

- A JWT signed with `alg: Ed25519`, valid 60 seconds, with `aud` set to the called service and a
  `kid` header.
- It carries the user, organization, member role, scopes and trace id of the table.
- Signing and verification come from `@cadenway/nest-common`. This gateway signs with
  `INTERNAL_TOKEN_ISSUER` (`api-gateway`) and `INTERNAL_TOKEN_PRIVATE_JWK`, a secret of
  cadenway-ops (`API_GATEWAY_INTERNAL_TOKEN_PRIVATE_JWK`), and verifies no internal token
  (`internalTokenVerification: 'off'`): it authenticates the applications itself.

### Organization context

The organization and the actor of a request come from the verified session or API token only.
The guard of `src/modules/auth/` (phase P2a of the integration plan) gives a verified request its context
with `setRequestOrganizationContext(request, context)` of `@cadenway/nest-common`: see
[Organization context](https://github.com/Cadenway/cadenway-service-kit/blob/main/packages/nest-common/README.md#organization-context)
in the kit README. It is the sanctioned way for an application that verifies its callers itself
(`internalTokenVerification: 'off'`) to give an HTTP request an identity.

- Only the code that verified the caller calls it, and only with what the verification
  returned: the answer of `POST /internal/v1/tokens/introspect` for a session or an API token,
  never a value read from the request.
- The handler then reads the context with `getOrganizationContext()`, `InternalHttpClient`
  signs the internal token of its calls from it, and the log lines of the request, its
  completion line included, carry `organizationId` and `userId`.
- It throws when the request already carries a context, and for a context an internal token
  could not carry (an organization id that is not a UUID, an identified actor without an id).
  `runWithOrganizationContext` is never used for an HTTP request.

### Public edge

`src/gateway-application.ts` applies these settings to every request. The rules require the
cookie and the CSRF check; the settings below are inferred from a public API served behind Traefik
on another origin than the applications, not prescribed by a rule:

- `trust proxy` is `1`: Express believes the `X-Forwarded-*` headers of one hop, Traefik, and never
  a header the client wrote itself. `request.ip` is then the address Traefik saw:
  `toClientAddress` of `src/presentation/http/mappers/` reads it for the `client` of a sign-in and
  for the limits per client address.
- `helmet` with its defaults.
- `cookie-parser` without a secret: the session token is opaque and verified by introspection, so
  no cookie is signed.
- CORS answers the origins of `ALLOWED_ORIGINS` only (the webapp `app.<domain>` and the website
  `<domain>`), compared exactly, with credentials; never `*`. A preflight from another origin gets
  no `Access-Control-Allow-Origin`, so the browser refuses the request. The CSRF check compares
  `Origin` to the same list.
- An incoming `X-Request-Id` or `X-Request-Timeout-Ms` is ignored: a client chooses neither the
  reference of its request nor the budget of the internal calls.

## Logging And Tracing

Source: `cw-logging-and-tracing` ([Claude](../.claude/skills/cw-logging-and-tracing/SKILL.md), [Codex](../.codex/skills/cw-logging-and-tracing/SKILL.md)).

The logger, the redaction list, the OpenTelemetry SDK, its
instrumentations and its exporters belong to `@cadenway/nest-common`: the gateway configures them and
installs no logging or telemetry library of its own. `pino-pretty` is the one exception, a
development dependency for readable local output. Check what the installed kit exports before relying
on a name.

### Logs

- JSON lines from the logger of `@cadenway/nest-common`; never `console.log`.
- Fields: `service`, `version`, `traceId`, `spanId`, `organizationId`, `userId`, `route`, `status`,
  `durationMs`. `organizationId` and `userId` come from the verified token, never from the request.
- Redaction: tokens, passwords and e-mail addresses are masked by the list of the kit. No e-mail
  address and no IP address at `info` level.
- The session cookie, the `Authorization` header and the internal token never reach a log line.
- `LOG_LEVEL` sets the level; it is validated at start-up and described in `.env.example`.

### Traces

- W3C Trace Context: the incoming `traceparent` is continued, and every internal call carries it. The
  internal token carries the trace id too.
- SQL values and query strings are excluded from spans.
- An error response carries `X-Request-Id`, the reference the webapp displays.
- Spans come from the instrumentations of the kit (HTTP, Express, ioredis, undici) and its own NestJS
  interceptor. `@opentelemetry/instrumentation-nestjs-core` and `-router` stay out: the first does not
  support NestJS 12, the second doubles the spans under Express 5.

### Start-up (ESM)

The telemetry must be loaded before the application imports Express:

```text
node --max-old-space-size=160 --import @cadenway/nest-common/register --import ./dist/telemetry.js dist/main.js
```

- `@cadenway/nest-common/register` registers the module hooks of the instrumentations with
  `module.register()`, before `telemetry.js` loads them: hence the order of the two `--import`.
  The hooks are named through the kit: pnpm's strict `node_modules` does not expose
  `@opentelemetry/instrumentation` to the application. Nothing is written on the standard error,
  unlike the former `--experimental-loader` form.
- `src/telemetry.ts` only calls `startTelemetry` of `@cadenway/nest-common/telemetry`, which
  imports no NestJS code.
- `--max-old-space-size=160` caps the old generation of the heap at about 60 % of the 256M limit
  of `deploy/compose.yaml`, so the garbage collector reclaims it before the container reaches
  its limit.
- The flags go on the `node` start command (the `CMD` of the `Dockerfile` and `pnpm start:dev`),
  not in application code.
- `OTEL_EXPORTER_OTLP_ENDPOINT` points to the collector; `startTelemetry` refuses anything but an
  HTTP or HTTPS URL, and unset, nothing is exported. It is described in `.env.example` and stays out
  of `deploy/compose.yaml` until an environment has a collector.

### Metrics

- Per route: throughput, errors, duration. The label is the route pattern, never the URL, an id or a
  token.
- Exported over OTLP to the collector; no `prom-client`.
- The gateway has no outbox, no consumer and no database pool: those metrics belong to the services.

## References

[Interactive mockup](https://claude.ai/artifact/KYRM7AnsYLiBLBLKy8i4HE), [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et), and [repositories and packages](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N). Use [AGENTS.md](../AGENTS.md) as the local source for ownership and hard limits.
