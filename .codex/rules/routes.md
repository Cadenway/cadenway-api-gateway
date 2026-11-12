---
paths:
  - 'src/routes/**'
---

# Public routes

- One folder per public resource; a route exists only if `openapi/public/` of the installed
  `@cadenway/contracts` declares it, with the same path, fields, status codes and scopes.
- Apply the shared guards: authentication, scopes, organization context, rate limit.
- Map the internal response to the public contract explicitly; never pass an internal object through.
- Translate internal errors to the public error format with stable `code`s.
