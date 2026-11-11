---
paths:
  - '**/*.spec.ts'
  - 'test/**'
---

# Tests

- Vitest. Internal services are faked from their contracts; Redis runs in Docker for integration tests.
- Cover: success, missing scope, wrong organization, slow and failing secondary services, 429.
- Validate every response against the public schema.
