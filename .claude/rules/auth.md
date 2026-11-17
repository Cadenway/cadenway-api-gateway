---
paths:
  - 'src/modules/auth/**'
---

# Authentication and authorization

- The organization and the member come from the verified token only. The guard that verified it
  gives the request its context with `setRequestOrganizationContext` of `@cadenway/nest-common`,
  with what the introspection returned, and nothing else sets a request context.
- API tokens carry scopes (`tasks:read`, `tasks:write`, `members:read`, `webhooks:manage`); each route
  declares the `security` of its public operation with `CredentialGuard.requires`, checked against
  the shipped specs by the unit tests. A session holds every scope.
- A request with `Authorization: Bearer` is authenticated with that token alone, introspected with
  `POST /internal/v1/api-tokens/introspect` on every request; its cookie is ignored.
- Failed bearer authentications are limited to 10 per minute per client address: past the limit,
  a bearer token answers `429 rate-limit.exceeded` before any introspection. Requests without a
  credential are limited to 60 per minute per client address. The address is `request.ip` (one
  trusted hop, Traefik) and every counter key holds a keyed hash of it, never the address; a
  valid session or token keeps only its own limit.
- Services receive a short-lived internal token, never the user's credential.
- Verification keys and issuers come from configuration; nothing is hard-coded.
- A session token is opaque: every request is verified with `POST /internal/v1/tokens/introspect` at
  identity-service, never from a cache and never by decoding the token here.
- The session cookie is `__Host-cw_session; HttpOnly; Secure; SameSite=Lax`.
- CSRF: an unsafe method authenticated by the session cookie requires an `Origin` exactly equal to an
  allowed origin and `Content-Type: application/json`; a bodiless `DELETE` passes on its `Origin`
  alone. A bearer token needs no `Origin`. The routes of `openapi/public/auth.yaml` without a
  session require both, signed in or not.
- The internal token is a JWT (`alg: Ed25519`, 60 seconds, `aud` = the called service, `kid`).
- In the V2 layout, keep guards, cookie and CSRF handling in `presentation/http/`. Put
  verification orchestration and its ports under `application/`.
