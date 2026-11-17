---
paths:
  - 'src/modules/**/presentation/http/**'
---

# Public routes

- Match the installed `@cadenway/contracts` spec in `openapi/public/` for every route's existence,
  path, fields, status codes, and scopes. Apply shared auth, scope, organization, and rate-limit guards.
- Use one folder per resource with controllers, DTOs and mappers in `presentation/http/` under V2.
  Delegate every route to an application use case. Forwarded commands and queries inject the
  capability port. Aggregate in an application query.
- Map responses to the public contract explicitly. Translate internal errors to public problems with
  stable `code`s.
