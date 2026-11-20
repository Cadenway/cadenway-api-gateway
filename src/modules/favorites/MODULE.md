# Favorites

This capability relays the current actor's favorites to task-service, which owns visibility, ownership, target eligibility and capacity. The internal token carries the verified actor and organization.

## Public entry points

This module exposes HTTP routes and publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                           | Internal call                                   | Scope         |
| -------------------------------------- | ----------------------------------------------- | ------------- |
| `GET /v1/me/favorites`                 | `GET /internal/v1/me/favorites`                 | `tasks:read`  |
| `POST /v1/me/favorites`                | `POST /internal/v1/me/favorites`                | `tasks:write` |
| `GET /v1/me/favorites/{favoriteId}`    | `GET /internal/v1/me/favorites/{favoriteId}`    | `tasks:read`  |
| `DELETE /v1/me/favorites/{favoriteId}` | `DELETE /internal/v1/me/favorites/{favoriteId}` | `tasks:write` |

## Decisions

Each route invokes an application use case through the task-service port. Writes are sent once. Creation forwards the optional `Idempotency-Key` and returns the public `Location`; deletion forwards optional `If-Match`. Creation and reading return the validated resource version as `ETag`.

The task-service controls actor-scoped favorites. Declared version-mismatch details are retained, while undeclared upstream failures are translated to `503 upstream.failed`. A blank `If-Match` on deletion is rejected; creation requires a JSON body.
