---
paths:
  - 'src/auth/**'
---

# Authentication and authorization

- The organization and the member come from the verified token only.
- API tokens carry scopes (`tasks:read`, `tasks:write`, `members:read`, `webhooks:manage`); each route
  declares the scopes it needs.
- Services receive a short-lived internal token, never the user's credential.
- Verification keys and issuers come from configuration; nothing is hard-coded.
- A session token is opaque: every request is verified with `POST /internal/v1/tokens/introspect` at
  identity-service, never from a cache and never by decoding the token here.
- The session cookie is `__Host-cw_session; HttpOnly; Secure; SameSite=Lax`.
- CSRF: an unsafe method authenticated by the session cookie requires an `Origin` exactly equal to an
  allowed origin and `Content-Type: application/json`.
- The internal token is a JWT (`alg: Ed25519`, 60 seconds, `aud` = the called service, `kid`).
