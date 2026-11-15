# Domain and integration

[Documentation index](README.md) · [Repository instructions](../AGENTS.md)

**Status:** This page records the design from repository instructions and skills. The public edge,
the logs and the telemetry start-up are implemented and covered by `test/gateway.int-spec.ts`; the
routes, the authentication, the internal clients and the rate limit are not built yet.

## Public and internal boundaries

The public route contract is owned by `cadenway-api-contracts`; internal service calls use generated clients. Public unauthenticated routes and aggregate composition are listed in [AGENTS.md](../AGENTS.md). The gateway does not own domain decisions or another service's database.

## Gateway Patterns

Source: `cw-gateway-patterns` ([Claude](../.claude/skills/cw-gateway-patterns/SKILL.md), [Codex](../.codex/skills/cw-gateway-patterns/SKILL.md)).

### An authenticated route

```text
request → auth guard (token) → scope guard → organization context → rate limit
        → controller → internal client(s) → mapping to openapi/public → response
```

### An aggregate

1. Start the calls that do not depend on each other together.
2. Give each a timeout (default 800 ms for secondary parts, the route budget for the main one).
3. If the main service fails, the route fails. If a secondary service fails, omit and flag
   that part when the public contract allows a partial response. Otherwise return the contract-defined error.
4. Map to the public contract; never forward internal shapes.

### Deadlines and internal calls

- A public route has a budget of 10 seconds. It travels as a deadline: each internal call gets the
  time left, never its own fresh timeout.
- One internal call waits 2 seconds at most, or the time left when that is shorter. The cap also
  bounds the main call of an aggregate.
- One retry, only on a connection error or a `503`, and only for an idempotent call.
- One circuit breaker per service: while it is open, the call fails at once, as a failing main or
  secondary service does in an aggregate.
- Deadline, retry and breaker belong to the internal HTTP client of `@cadenway/nest-common`; a route
  does not re-implement them.

### Errors

Internal `404` of another organization's resource becomes a public `404`, never `403`: the existence of
another tenant's data is not revealed.

Every error leaves as `application/problem+json` (RFC 9457): `type`, `title`, `status`, `detail`,
`instance`, plus `code` and, when the contract defines them, `details`.

- `code` is `<domain>.<reason>` in kebab-case and stable; its text is French when the webapp shows it
  as is.
- The response carries `X-Request-Id`, the reference the webapp displays.
- The error filter comes from `@cadenway/nest-common`; an internal problem document is translated to
  the public contract, never forwarded.

## Auth Tokens

Source: `cw-auth-tokens` ([Claude](../.claude/skills/cw-auth-tokens/SKILL.md), [Codex](../.codex/skills/cw-auth-tokens/SKILL.md)).

| Token              | Issued by                                          | Carries                                           | Used for              |
| ------------------ | -------------------------------------------------- | ------------------------------------------------- | --------------------- |
| Session            | identity-service (or the chosen identity provider) | user, organization, member role                   | webapp                |
| Personal API token | identity-service                                   | user, organization, scopes                        | integrations, scripts |
| Internal token     | this gateway, short-lived                          | user, organization, member role, scopes, trace id | calls to services     |

- A session token switches organization only through the explicit organization-selection flow.
- Scopes are checked per route; a session token has every scope its member role allows.

### Session

- The session token is opaque: 256 random bits, stored by identity-service as a SHA-256 hash. It
  carries nothing itself: the user, organization and member role of the table are what
  introspection returns.
- The webapp holds it in the cookie `__Host-cw_session; HttpOnly; Secure; SameSite=Lax`.
- Every request verifies its token with `POST /internal/v1/tokens/introspect` at identity-service,
  through the generated client and without a cache: a revoked session stops at the next request.
  Known cost: while identity-service is unavailable, so is the API.
- CSRF: a request with an unsafe method (`POST`, `PUT`, `PATCH`, `DELETE`) authenticated by the
  session cookie must carry an `Origin` that is exactly one of the allowed origins (the webapp and
  the website, as for CORS) and `Content-Type: application/json`. It is refused before the
  controller otherwise.

### Personal API token

- Format: `cw_pat_`, then 30 base62 characters, then 6 characters of CRC32 check.
- identity-service stores its SHA-256 hash, gives it an expiry and shows it once.

### Internal token

- A JWT signed with `alg: Ed25519`, valid 60 seconds, with `aud` set to the called service and a
  `kid` header.
- It carries the user, organization, member role, scopes and trace id of the table.
- Signing and verification come from `@cadenway/nest-common`. This gateway signs with
  `INTERNAL_TOKEN_ISSUER` (`api-gateway`) and `INTERNAL_TOKEN_PRIVATE_JWK`, a secret of
  cadenway-ops (`API_GATEWAY_INTERNAL_TOKEN_PRIVATE_JWK`), and verifies no internal token
  (`internalTokenVerification: 'off'`): it authenticates the applications itself.

### Organization context

The organization and the actor of a request come from the verified session or API token only.
The guard of `src/auth/` (phase P2a of the integration plan) gives a verified request its context
with `setRequestOrganizationContext(request, context)` of `@cadenway/nest-common`: see
[Organization context](https://github.com/Cadenway/cadenway-service-kit/blob/main/packages/nest-common/README.md#organization-context)
in the kit README. It is the sanctioned way for an application that verifies its callers itself
(`internalTokenVerification: 'off'`) to give an HTTP request an identity.

- Only the code that verified the caller calls it, and only with what the verification
  returned: the answer of `POST /internal/v1/tokens/introspect` for a session or an API token,
  never a value read from the request.
- The handler then reads the context with `getOrganizationContext()`, `InternalHttpClient`
  signs the internal token of its calls from it, and the log lines of the request, its
  completion line included, carry `organizationId` and `userId`.
- It throws when the request already carries a context, and for a context an internal token
  could not carry (an organization id that is not a UUID, an identified actor without an id).
  `runWithOrganizationContext` is never used for an HTTP request.

### Public edge

`src/gateway-application.ts` applies these settings to every request. The rules require the
cookie and the CSRF check; the settings below are inferred from a public API served behind Traefik
on another origin than the applications, not prescribed by a rule:

- `trust proxy` is `1`: Express believes the `X-Forwarded-*` headers of one hop, Traefik, and never
  a header the client wrote itself.
- `helmet` with its defaults.
- `cookie-parser` without a secret: the session token is opaque and verified by introspection, so
  no cookie is signed.
- CORS answers the origins of `ALLOWED_ORIGINS` only (the webapp `app.<domain>` and the website
  `<domain>`), compared exactly, with credentials; never `*`. A preflight from another origin gets
  no `Access-Control-Allow-Origin`, so the browser refuses the request. The CSRF check compares
  `Origin` to the same list.
- An incoming `X-Request-Id` or `X-Request-Timeout-Ms` is ignored: a client chooses neither the
  reference of its request nor the budget of the internal calls.

## Logging And Tracing

Source: `cw-logging-and-tracing` ([Claude](../.claude/skills/cw-logging-and-tracing/SKILL.md), [Codex](../.codex/skills/cw-logging-and-tracing/SKILL.md)).

The logger, the redaction list, the OpenTelemetry SDK, its
instrumentations and its exporters belong to `@cadenway/nest-common`: the gateway configures them and
installs no logging or telemetry library of its own. `pino-pretty` is the one exception, a
development dependency for readable local output. Check what the installed kit exports before relying
on a name.

### Logs

- JSON lines from the logger of `@cadenway/nest-common`; never `console.log`.
- Fields: `service`, `version`, `traceId`, `spanId`, `organizationId`, `userId`, `route`, `status`,
  `durationMs`. `organizationId` and `userId` come from the verified token, never from the request.
- Redaction: tokens, passwords and e-mail addresses are masked by the list of the kit. No e-mail
  address and no IP address at `info` level.
- The session cookie, the `Authorization` header and the internal token never reach a log line.
- `LOG_LEVEL` sets the level; it is validated at start-up and described in `.env.example`.

### Traces

- W3C Trace Context: the incoming `traceparent` is continued, and every internal call carries it. The
  internal token carries the trace id too.
- SQL values and query strings are excluded from spans.
- An error response carries `X-Request-Id`, the reference the webapp displays.
- Spans come from the instrumentations of the kit (HTTP, Express, ioredis, undici) and its own NestJS
  interceptor. `@opentelemetry/instrumentation-nestjs-core` and `-router` stay out: the first does not
  support NestJS 12, the second doubles the spans under Express 5.

### Start-up (ESM)

The telemetry must be loaded before the application imports Express:

```text
node --max-old-space-size=160 --import @cadenway/nest-common/register --import ./dist/telemetry.js dist/main.js
```

- `@cadenway/nest-common/register` registers the module hooks of the instrumentations with
  `module.register()`, before `telemetry.js` loads them: hence the order of the two `--import`.
  The hooks are named through the kit: pnpm's strict `node_modules` does not expose
  `@opentelemetry/instrumentation` to the application. Nothing is written on the standard error,
  unlike the former `--experimental-loader` form.
- `src/telemetry.ts` only calls `startTelemetry` of `@cadenway/nest-common/telemetry`, which
  imports no NestJS code.
- `--max-old-space-size=160` caps the old generation of the heap at about 60 % of the 256M limit
  of `deploy/compose.yaml`, so the garbage collector reclaims it before the container reaches
  its limit.
- The flags go on the `node` start command (the `CMD` of the `Dockerfile` and `pnpm start:dev`),
  not in application code.
- `OTEL_EXPORTER_OTLP_ENDPOINT` points to the collector; `startTelemetry` refuses anything but an
  HTTP or HTTPS URL, and unset, nothing is exported. It is described in `.env.example` and stays out
  of `deploy/compose.yaml` until an environment has a collector.

### Metrics

- Per route: throughput, errors, duration. The label is the route pattern, never the URL, an id or a
  token.
- Exported over OTLP to the collector; no `prom-client`.
- The gateway has no outbox, no consumer and no database pool: those metrics belong to the services.

## References

[Interactive mockup](https://claude.ai/artifact/KYRM7AnsYLiBLBLKy8i4HE), [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et), and [repositories and packages](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N). Use [AGENTS.md](../AGENTS.md) as the local source for ownership and hard limits.
