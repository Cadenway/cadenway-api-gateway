---
paths:
  - 'src/clients/**'
---

# Internal clients

- Generated from `openapi/internal/<service>.yaml` of the installed contracts; generated files are
  never edited by hand.
- Default timeout, retries only for idempotent calls, the internal token on every call.
- Base URLs from environment variables named `<SERVICE>_URL`, documented in `.env.example`.
