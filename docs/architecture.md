# Architecture and ownership

[Documentation index](README.md) · [Repository instructions](../AGENTS.md)

## Status

The checkout contains the runtime wiring below, the credential guard and the rate limit, and the
routes of `openapi/public/auth.yaml`, `organizations.yaml`, `members.yaml` and `api-tokens.yaml`
through the clients of identity-service and organization-service (phases P2a, P2b, P2c-1 and P2c-2 of the
integration plan), and the task core routes of `spaces.yaml`, `lists.yaml` and `tasks.yaml`, the
task detail aggregate included, through the client of task-service (phase P3a), with the sharing,
access request, archive, trash and deletion routes of `access.yaml`, `archives.yaml`, `trash.yaml`,
`spaces.yaml` and `lists.yaml` (phase P3b-1). The P3b-2 task-service routes cover comments, participants, watchers, dependencies, milestones, duplication, bulk actions, templates, saved views and favorites. The ownership map below identifies their gateway capabilities.

## Runtime wiring

| File                         | Holds                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/telemetry.ts`           | `startTelemetry` of `@cadenway/nest-common/telemetry`, preloaded by the start command before `main.js`                                                                                                                                                                                                         |
| `src/main.ts`                | Inside `runApplication`: validates the environment once, creates the application, listens on `PORT`; a failed start-up is one JSON line on the standard error and exit code 1                                                                                                                                  |
| `src/gateway-application.ts` | `createApplication` with the options of a public gateway (the validated configuration provided as `CONFIG`, signer only, no internal token verification, incoming `X-Request-Id` and `X-Request-Timeout-Ms` ignored), then `trust proxy` for one hop, `helmet`, `cookie-parser` and CORS for `ALLOWED_ORIGINS` |
| `src/app.module.ts`          | The shared Redis module, `HealthModule` with the Redis indicator and the shutdown delay, and the route modules                                                                                                                                                                                                 |
| `src/config/app-config.ts`   | The zod schema of the environment                                                                                                                                                                                                                                                                              |
| `src/infrastructure/redis/`  | `RedisModule`: the Redis connection of the rate-limit counters, a `ResilientRedisClient` of `@cadenway/nest-common/redis`, closed on shutdown                                                                                                                                                                  |

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

## Authentication

| File                                 | Holds                                                                                                                                                                                                                                                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/clients/generated/`             | The clients orval generates from the internal identity, organization and task-service specifications of the installed `@cadenway/contracts` (`pnpm generate:clients`); committed, never edited                                                                                                            |
| `src/clients/*.client.ts`            | The outgoing adapters of identity-service, organization-service and task-service: the generated functions on an `InternalHttpClient`, the actor of each call, every answer checked against the contract                                                                                                   |
| `src/clients/clients.module.ts`      | One technical client per called service, bound to a separate `InternalHttpClient`                                                                                                                                                                                                                         |
| `src/modules/auth/`                  | `CredentialGuard` (the session cookie or the personal API token, introspected on every request; the security requirement and organization scope of each operation; the organization context), `CsrfGuard`, the cross-site checks and the introspection ports                                              |
| `src/modules/rate-limit/`            | `RateLimitGuard`: 600 requests per minute per session or personal API token, 60 per minute per client address without a credential; the 10 failed bearer authentications per minute per client address the credential guard reads; counted on Redis with rate-limiter-flexible, addresses as keyed hashes |
| `src/problems/`                      | The French titles of the public problems, the translation of internal errors, `Retry-After`, the check of internal answers against their contract                                                                                                                                                         |
| `src/modules/auth-routes/`           | The routes under `/v1/auth` (sign-up, sign-in and its two-step challenge, sign-out, password reset, re-authentication) and their `IdentityAuth` port                                                                                                                                                      |
| `src/modules/me/`                    | The routes under `/v1/me` (the account, its profile, password, address and deletion) and their `IdentityUsers` port                                                                                                                                                                                       |
| `src/modules/sessions/`              | The routes under `/v1/sessions` (list, close one, close the others) and their `SessionRegistry` port                                                                                                                                                                                                      |
| `src/modules/two-step-verification/` | The routes under `/v1/me/two-step-verification` (the authenticator app, the backup codes, the security keys) and their `TwoStepVerificationRegistry` port                                                                                                                                                 |
| `src/modules/organizations/`         | The routes of `openapi/public/organizations.yaml`                                                                                                                                                                                                                                                         |
| `src/modules/members/`               | The member routes of `openapi/public/members.yaml`                                                                                                                                                                                                                                                        |
| `src/modules/invitations/`           | The invitation routes of `openapi/public/members.yaml`                                                                                                                                                                                                                                                    |
| `src/modules/spaces/`                | The routes of `openapi/public/spaces.yaml` and their `SpaceRegistry` port                                                                                                                                                                                                                                 |
| `src/modules/lists/`                 | The routes of `openapi/public/lists.yaml` and their `ListRegistry` port                                                                                                                                                                                                                                   |
| `src/modules/tasks/`                 | The routes of `openapi/public/tasks.yaml`, their `TaskRegistry` port and the task detail aggregate (`GetTaskDetail`)                                                                                                                                                                                      |
| `src/modules/comments/`              | Task comments and eligible participants through `CommentsRegistry`                                                                                                                                                                                                                                        |
| `src/modules/watchers/`              | Task watchers through `WatchersRegistry`                                                                                                                                                                                                                                                                  |
| `src/modules/dependencies/`          | Task dependencies and candidates through `DependenciesRegistry`                                                                                                                                                                                                                                           |
| `src/modules/task-templates/`        | Space task-template library through `TaskTemplatesRegistry`                                                                                                                                                                                                                                               |
| `src/modules/saved-views/`           | List saved views through `SavedViewsRegistry`                                                                                                                                                                                                                                                             |
| `src/modules/favorites/`             | Current actor's favorites through `FavoritesRegistry`                                                                                                                                                                                                                                                     |
| `src/modules/access/`                | The routes of `openapi/public/access.yaml` and their `GrantRegistry` and `AccessRequestRegistry` ports                                                                                                                                                                                                    |
| `src/modules/archives/`              | The routes of `openapi/public/archives.yaml` and their `ArchiveRegistry` port                                                                                                                                                                                                                             |
| `src/modules/trash/`                 | The routes of `openapi/public/trash.yaml` and their `TrashRegistry` port                                                                                                                                                                                                                                  |
| `src/modules/api-tokens/`            | The routes of `openapi/public/api-tokens.yaml`                                                                                                                                                                                                                                                            |
| `src/presentation/http/`             | Shared HTTP helpers for current-user mapping, the client address, query parameters, cache policy, session cookies and the verified credential of a request                                                                                                                                                |

The auth capability and each route module bind their own ports in composition (`composition/` or the module file). The outgoing adapters call the technical clients exported by `ClientsModule`. Controllers call local use cases; the credential guard uses the verification queries and the rate-limit guard the counting command. Route tests run the real bindings and substitute the technical client methods and the request counters.

## Purpose and target structure

cadenway-api-gateway is the only API the applications and third-party integrations see (`api.<domain>` behind Traefik). It verifies session tokens and personal API tokens, sets the current organization, limits throughput, routes to the internal services and aggregates their responses (task detail, home, command palette). Local port 3000.

| Aggregate       | Composed from                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Task detail     | task-service (task) + integration-service (Git links) + storage-service (attachments) + notification-service (reminders) |
| Home            | task-service (my priorities, sprint) + notification-service (mentions, activity)                                         |
| Command palette | search-service                                                                                                           |

Public routes without a session: the sign-up, sign-in and password reset flows of `openapi/public/auth.yaml` (sign-in methods, sign-up with its code and its verification, sign-in by password or by email code and the five routes of its two-step challenge, the password reset with the inspection of its link and its confirmation, and the sign-out, whose session is optional), a list's intake form, newsletter, contact form, GitHub and GitLab webhooks. API token scopes: `tasks:read`, `tasks:write`, `members:read`, `webhooks:manage`.

## Architectural ownership

Follow the [Cadenway NestJS architecture reference](https://github.com/Cadenway/cadenway-service-kit/blob/main/docs/hexagonal-architecture.md) for ports, adapters, dependency direction, naming and test placement.

- Each capability lives at `src/modules/<module>/` with `MODULE.md` and `<module>.module.ts`.
  The existing owners are `auth`, `auth-routes`, `me`, `sessions`, `two-step-verification`, `rate-limit`,
  `organizations`, `members`, `invitations`, `api-tokens`, `spaces`, `lists`, `tasks`, `comments`,
  `watchers`, `dependencies`, `task-templates`, `saved-views`, `favorites`, `access`, `archives` and `trash`. Add new owners for aggregated resources and
  unauthenticated workflows when those capabilities are implemented.
- HTTP controllers, guards and DTOs live in `presentation/http/`. Every route delegates to an
  operation in `application/use-cases/{commands,queries}/<area>/<operation>/`. Application uses
  capability-local outbound ports. `infrastructure/adapters/` contains their implementations.
  Bind ports and register factories in `<module>.module.ts`, using the optional `composition/`
  wiring directory for separate files.
- `ClientsModule` exposes technical clients using `src/clients/generated/`. Shared infrastructure,
  problem mappers and HTTP session, cache and mapping helpers stay outside the capability folders.
  The Redis connection of the counters and its readiness integration live under
  `src/infrastructure/redis/`; the counters themselves belong to `rate-limit`.

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
