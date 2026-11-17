---
name: cw-auth-tokens
description: "The token types the gateway accepts (session, personal API token), how the organization context and scopes are derived, and the internal token forwarded to services. Load it for any auth change."
---

# Tokens and scopes

| Token | Issued by | Carries | Used for |
| --- | --- | --- | --- |
| Session | identity-service (or the chosen identity provider) | user, organization, member role | webapp |
| Personal API token | identity-service | user, organization, scopes | integrations, scripts |
| Internal token | the caller, short-lived: this gateway for the calls it makes | user, organization, member role, scopes, trace id | calls to services |

- A session token switches organization only through the explicit organization-selection flow.
- Scopes are checked per route, from the `security` of its public operation; a session holds
  every scope, a personal API token its own.

## Session

- The session token is opaque: 256 random bits, stored by identity-service as a SHA-256 hash. It
  carries nothing itself: the user, organization and member role of the table are what
  introspection returns.
- The webapp holds it in the cookie `__Host-cw_session; HttpOnly; Secure; SameSite=Lax`.
- Every request verifies its token with `POST /internal/v1/tokens/introspect` at identity-service,
  through the generated client and without a cache: a revoked session stops at the next request.
  Known cost: while identity-service is unavailable, so is the API.
- CSRF: a request with an unsafe method (`POST`, `PUT`, `PATCH`, `DELETE`) authenticated by the
  session cookie must carry an `Origin` that is exactly one of the allowed origins (the webapp and
  the website, as for CORS) and `Content-Type: application/json`; a bodiless `DELETE` passes on
  its `Origin` alone. It is refused before the introspection otherwise.
  Sessionless routes in `openapi/public/auth.yaml` require the allowed `Origin` and
  `Content-Type: application/json` whether or not a session is present.

## Personal API token

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

## Internal token

- A JWT signed with `alg: Ed25519`, valid 60 seconds, with `aud` set to the called service and a
  `kid` header.
- It carries the user, organization, member role, scopes and trace id of the table.
- Signing and verification come from `@cadenway/nest-common`. This gateway signs with
  `INTERNAL_TOKEN_ISSUER` (`api-gateway`) and `INTERNAL_TOKEN_PRIVATE_JWK`, a secret of
  cadenway-ops (`API_GATEWAY_INTERNAL_TOKEN_PRIVATE_JWK`), and verifies no internal token
  (`internalTokenVerification: 'off'`): it authenticates the applications itself.
- This gateway signs the token of the calls it makes. The realtime gateway,
  cadenway-automation-service and cadenway-integration-service sign the token of their own
  calls, each with its own key: a service verifies against the issuers and keys of its
  configuration.
- A call made for nobody yet (sign-up, sign-in, intake form) carries a token with an anonymous
  subject; a call the gateway makes as itself (the introspection, the webhook relay) carries the
  actor `system`. Neither carries an organization.

## Organization context

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

## Public edge

`src/gateway-application.ts` applies these settings to every request. The rules above require the
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
