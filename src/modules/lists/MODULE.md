# Lists

Owns the list and sprint routes of `openapi/public/lists.yaml` on the current organization:
create and list the lists of a space, read and change a list, its counts and its activity.
task-service owns the lists and decides every rule (sprint dates, who sees a list); the gateway
decides none.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                      | Internal call                              | Token scope   |
| --------------------------------- | ------------------------------------------ | ------------- |
| `POST /v1/spaces/{spaceId}/lists` | `POST /internal/v1/spaces/{spaceId}/lists` | `tasks:write` |
| `GET /v1/spaces/{spaceId}/lists`  | `GET /internal/v1/spaces/{spaceId}/lists`  | `tasks:read`  |
| `GET /v1/lists/{listId}`          | `GET /internal/v1/lists/{listId}`          | `tasks:read`  |
| `PATCH /v1/lists/{listId}`        | `PATCH /internal/v1/lists/{listId}`        | `tasks:write` |
| `GET /v1/lists/{listId}/counts`   | `GET /internal/v1/lists/{listId}/counts`   | `tasks:read`  |
| `GET /v1/lists/{listId}/activity` | `GET /internal/v1/lists/{listId}/activity` | `tasks:read`  |

## Decisions

- Credentials, scopes, organization context, opaque relay and problem translation as in
  [spaces](../spaces/MODULE.md#decisions).
- The creation answers `201` with `Location: /v1/lists/<listId>` and the `ETag` of the list;
  `Idempotency-Key` and `If-Match` are relayed unchanged.
- The counts relay the `today` of the caller; `kind` and `actorId` of the activity are
  comma-separated query parameters, split before the public validator checks them.
