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
- Scopes are checked per route; a session token has every scope its member role allows.

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
  the website, as for CORS) and `Content-Type: application/json`. It is refused before the
  controller otherwise.

## Personal API token

- Format: `cw_pat_`, then 30 base62 characters, then 6 characters of CRC32 check.
- identity-service stores its SHA-256 hash, gives it an expiry and shows it once.

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
- A route without a user or an organization (sign-up, sign-in, introspection, intake form,
  webhooks) carries a token with an anonymous subject.

## Public edge

`src/gateway-application.ts` applies these settings to every request. The rules above require the
cookie and the CSRF check; the settings below are inferred from a public API served behind Traefik
on another origin than the applications, not prescribed by a rule:

- `trust proxy` is `1`: Express believes the `X-Forwarded-*` headers of one hop, Traefik, and never
  a header the client wrote itself.
- `helmet` with its defaults.
- `cookie-parser` without a secret: the session token is opaque and verified by introspection, so
  no cookie is signed.
- CORS answers the origins of `ALLOWED_ORIGINS` only (the webapp `app.<domain>` and the website
  `<domain>`), compared exactly, with credentials; never `*`. A preflight from another origin gets
  no `Access-Control-Allow-Origin`, so the browser refuses the request. The CSRF check compares
  `Origin` to the same list.
- An incoming `X-Request-Id` or `X-Request-Timeout-Ms` is ignored: a client chooses neither the
  reference of its request nor the budget of the internal calls.
