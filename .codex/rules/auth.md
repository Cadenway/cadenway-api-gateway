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
