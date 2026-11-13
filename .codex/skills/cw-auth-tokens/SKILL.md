---
name: cw-auth-tokens
description: "The token types the gateway accepts (session, personal API token), how the organization context and scopes are derived, and the internal token forwarded to services. Load it for any auth change."
---

# Tokens and scopes

| Token | Issued by | Carries | Used for |
| --- | --- | --- | --- |
| Session | identity-service (or the chosen identity provider) | user, organization, member role | webapp |
| Personal API token | identity-service | user, organization, scopes | integrations, scripts |
| Internal token | this gateway, short-lived | user, organization, member role, scopes, trace id | calls to services |

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
- Signing and verification come from `@cadenway/nest-common`.
