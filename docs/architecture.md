# Architecture and ownership

[Documentation index](README.md) · [Repository instructions](../AGENTS.md)

## Status

The checkout contains the runtime wiring below and no capability yet. The ownership map that
follows governs gateway capabilities as they are implemented.

## Runtime wiring

| File                         | Holds                                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/telemetry.ts`           | `startTelemetry` of `@cadenway/nest-common/telemetry`, preloaded by the start command before `main.js`                                                                                                                                                       |
| `src/main.ts`                | Inside `runApplication`: validates the environment, creates the application, listens on `PORT`; a failed start-up is one JSON line on the standard error and exit code 1                                                                                     |
| `src/gateway-application.ts` | `createApplication` with the options of a public gateway (signer only, no internal token verification, incoming `X-Request-Id` and `X-Request-Timeout-Ms` ignored), then `trust proxy` for one hop, `helmet`, `cookie-parser` and CORS for `ALLOWED_ORIGINS` |
| `src/app.module.ts`          | `ConfigModule` (validated when the application is created), the rate-limit module and `HealthModule` with the Redis indicator and the shutdown delay                                                                                                         |
| `src/config/app-config.ts`   | The zod schema of the environment                                                                                                                                                                                                                            |
| `src/rate-limit/`            | The Redis connection of the counters, a `ResilientRedisClient` of `@cadenway/nest-common/redis`, closed on shutdown; the limiter comes with the first authenticated routes                                                                                   |

Start command, in the `Dockerfile` and `pnpm start:dev`:

```text
node --max-old-space-size=160 --import @cadenway/nest-common/register --import ./dist/telemetry.js dist/main.js
```

Readiness answers 503 from the first moment of a stop, and the gateway keeps serving for
`SHUTDOWN_DELAY_MS` (3 seconds, `src/app.module.ts`) before it closes its listener: the GitOps
agent stops the old container as soon as the new one is healthy, and Traefik may need up to its
2 second provider throttle to route to the new one.

The gateway has no broker connection yet. As cadenway-ops `docs/service-environment.md` lists,
it gets `NATS_URL`, `NATS_USER: api-gateway` and `NATS_PASSWORD` once it publishes its usage
event `api-usage.recorded.v1` (phase P5 of the integration plan), through
`@cadenway/nest-messaging` without an outbox.

## Purpose and target structure

cadenway-api-gateway is the only API the applications and third-party integrations see (`api.<domain>` behind Traefik). It verifies session tokens and personal API tokens, sets the current organization, limits throughput, routes to the internal services and aggregates their responses (task detail, home, command palette). Local port 3000.

| Aggregate       | Composed from                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Task detail     | task-service (task) + integration-service (Git links) + storage-service (attachments) + notification-service (reminders) |
| Home            | task-service (my priorities, sprint) + notification-service (mentions, activity)                                         |
| Command palette | search-service                                                                                                           |

Public routes without a session: a list's intake form, newsletter, contact form, GitHub and GitLab webhooks. API token scopes: `tasks:read`, `tasks:write`, `members:read`, `webhooks:manage`.

## Architectural ownership

Follow the [Cadenway NestJS architecture reference](https://github.com/Cadenway/cadenway-service-kit/blob/main/docs/hexagonal-architecture.md) for ports, adapters, dependency direction, naming and test placement.

- `src/auth/`: token verification, scopes, organization context.
- `src/rate-limit/`: per-token counters in Redis.
- `src/routes/<resource>/`: one folder per public resource.
- `src/aggregates/`: compositions across services.
- `src/public/`: routes without a session.
- `src/clients/`: clients generated from the internal specs, one per service.

## Boundaries

- No database: Redis only, for rate-limit counters.
- No domain decision: a rule that decides something belongs to the owning service.
- Internal services are reached only through clients generated from `openapi/internal/`; never a hand-written URL.
- Webhooks from GitHub and GitLab are relayed unchanged to cadenway-integration-service, which verifies their signature.
- No sibling sources imported, no `file:` or `link:` dependency.

## Cross-repository changes

Each checkout owns its implementation and release. Use published `@cadenway/*` packages instead of sibling source imports or local dependency links. For contract changes, make the contract and generated package available first, then update the producing service, gateways and listeners, and finally the webapp. Each step should remain deployable independently.

## Architecture checks

`pnpm test:architecture` runs the gateway profile from [`@cadenway/nest-testing`](https://github.com/Cadenway/cadenway-tooling) against this repository's TypeScript configuration. It runs locally as part of `pnpm quality` and in the GitHub Actions quality gate.
