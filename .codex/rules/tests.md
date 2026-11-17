---
paths:
  - '**/*.spec.ts'
  - 'src/**/*.int-spec.ts'
  - 'tests/**'
---

# Tests

- Use Vitest with contract-based service fakes and Docker Redis for integration tests.
- Cover success, missing scope, wrong organization, slow and failing secondary services, and 429.
  Validate every response against the public schema.
- Follow [focused checks and reporting](../../docs/development.md#full-local-quality-gate).
