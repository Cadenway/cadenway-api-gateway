# Architecture and ownership

[Documentation index](README.md) · [Repository instructions](../AGENTS.md)

## Status

The checkout contains a NestJS bootstrap and health endpoints. The following ownership map governs gateway capabilities as they are implemented.

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

`pnpm test:architecture` runs the gateway profile against this repository's TypeScript configuration. It requires a published release of [`@cadenway/nest-testing`](https://github.com/Cadenway/cadenway-tooling) that exports `/architecture`. Once that release is available and this repository's GitHub Actions has package read access, update the development dependency and frozen lockfile and run the script as part of `pnpm quality` and pull request CI.
