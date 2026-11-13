---
paths:
  - 'src/clients/**'
---

# Internal clients

- Generated from `openapi/internal/<service>.yaml` of the installed contracts; generated files are
  never edited by hand.
- Default timeout, retries only for idempotent calls, the internal token on every call.
- Base URLs from environment variables named `<SERVICE>_URL`, documented in `.env.example`.
- The route budget travels as a deadline: a call gets the time left, 2 seconds at most.
- One retry, on a connection error or a `503` only.
- One circuit breaker per service.
- A failed call surfaces as an `application/problem+json` error (RFC 9457) with a stable `code`.
