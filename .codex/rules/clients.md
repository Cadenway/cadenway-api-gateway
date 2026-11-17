---
paths:
  - 'src/clients/**'
---

# Internal clients

- Follow [client generation](../../docs/development.md#internal-clients) for installed contract
  specs, `pnpm generate:clients`, generated output, CI drift checks, and response validation.
- `ClientsModule` exports technical clients. Only those implementations import
  `src/clients/generated/`. Each capability owns its port, token, adapter, and `composition/`
  binding. Technical clients import no capability ports or tokens. Guards and controllers use
  capability use cases.
- Use one `InternalHttpClient` from `@cadenway/nest-common` per service. Follow
  [shared deadlines, retries, and breakers](../../docs/integration.md#deadlines-and-internal-calls)
  and send an internal token on every call.
- Validate each `<NAME>_SERVICE_URL` (for example `TASK_SERVICE_URL`) in
  `src/config/app-config.ts` and document it in `.env.example`.
- Map failures to [public problem responses](../../docs/integration.md#errors) with stable `code`s.

## Review example

For example, before proposing a cache for `GET /v1/me`, measure session introspection and account
lookup separately. Preserve `Cache-Control: no-store` and verify that revoking the session makes the
next request fail. Reuse the shared client's deadline and retry policy.
