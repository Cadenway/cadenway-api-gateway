---
paths:
  - 'src/clients/**'
---

# Internal clients

- Generated from `openapi/internal/<service>.yaml` of the installed contracts; generated files are
  never edited by hand.
- Generation runs in this repository (`pnpm generate:clients`, orval with the `fetch` client) from
  the spec files shipped in `@cadenway/contracts` (`specs/openapi/internal/<service>.yaml`) into
  `src/clients/generated/`, committed; CI fails when it differs from what the installed contracts
  generate.
- Every generated call goes through an `InternalHttpClient` of `@cadenway/nest-common`, one per
  service; its answers are checked against the zod validators of `@cadenway/contracts`.
- `ClientsModule` exposes technical clients. Each capability owns its port, token, adapter and binding in its own
  `composition/`. Technical clients do not import capability ports or tokens. Guards and
  controllers depend on the capability's application use cases.
- Default timeout, retries only for idempotent calls, the internal token on every call.
- Base URLs from environment variables named `<NAME>_SERVICE_URL` (`TASK_SERVICE_URL`), validated
  by `src/config/app-config.ts` and documented in `.env.example`.
- The route budget travels as a deadline: a call gets the time left, 2 seconds at most.
- One retry, on a connection error or a `503` only.
- One circuit breaker per service.
- A failed call surfaces as an `application/problem+json` error (RFC 9457) with a stable `code`.
- Only the technical client implementation reads `src/clients/generated/`; capability adapters
  use the technical client.
