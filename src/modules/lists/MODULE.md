# Lists

Owns the list and sprint routes of `openapi/public/lists.yaml` on the current organization:
create and list the lists of a space, read, change and delete a list, its counts and its activity.
task-service owns the lists and decides every rule (sprint dates, who sees a list, the role of the
caller on it, its switch "Accès de l’organisation", deletion); the gateway decides none.
The single-list read accepts an optional `If-Organization-Match` UUID. A mismatch returns
`412 organization.context-changed` before Task reads the list.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                        | Internal call                                | Token scope   |
| ----------------------------------- | -------------------------------------------- | ------------- |
| `POST /v1/lists/{listId}/duplicate` | `POST /internal/v1/lists/{listId}/duplicate` | `tasks:write` |
| `POST /v1/spaces/{spaceId}/lists`   | `POST /internal/v1/spaces/{spaceId}/lists`   | `tasks:write` |
| `GET /v1/spaces/{spaceId}/lists`    | `GET /internal/v1/spaces/{spaceId}/lists`    | `tasks:read`  |
| `GET /v1/lists/{listId}`            | `GET /internal/v1/lists/{listId}`            | `tasks:read`  |
| `PATCH /v1/lists/{listId}`          | `PATCH /internal/v1/lists/{listId}`          | `tasks:write` |
| `DELETE /v1/lists/{listId}`         | `DELETE /internal/v1/lists/{listId}`         | `tasks:write` |
| `GET /v1/lists/{listId}/counts`     | `GET /internal/v1/lists/{listId}/counts`     | `tasks:read`  |
| `GET /v1/lists/{listId}/activity`   | `GET /internal/v1/lists/{listId}/activity`   | `tasks:read`  |
| `QUERY /v1/lists/{listId}/activity` | `QUERY /internal/v1/lists/{listId}/activity` | `tasks:read`  |

## Decisions

- Credentials, scopes, organization context, opaque relay and problem translation as in
  [spaces](../spaces/MODULE.md#decisions).
- The creation answers `201` with `Location: /v1/lists/<listId>` and the `ETag` of the list;
  `Idempotency-Key` and `If-Match` are relayed unchanged; a blank `If-Match`, or a required body
  that is zero-byte or not JSON in UTF-8, answers `400 request.invalid` before any call.
- `organizationAccess` of a creation or a change is relayed unchanged in the body; the
  `organizationAccess`, `archivedAt`, `archivedBy` and `callerRole` of a list come from
  task-service and reach the answer through the public validator, an archived list read by its id
  included. The gateway reads none of them. A creation or a change task-service refuses for want
  of `edit` answers `403 access.role-insufficient`, relayed.
- The deletion answers `204` without a body nor an `ETag`, as the contract declares, with
  `If-Match` relayed unchanged; `403 access.role-insufficient`, `404` and `412` are relayed.
  task-service deletes the list, archived or not, and moves its tasks to the trash afterwards; the
  gateway decides nothing about either. task-service serves the deletion once its PR 3 (trash and
  deletion) is merged and deployed; until then the route answers `503 upstream.failed`.
- The counts relay the `today` of the caller; `kind` and `actorId` of the activity are
  comma-separated query parameters, split before the public validator checks them.

`POST /v1/lists/{listId}/duplicate` relays a duplication once with `tasks:write`, source `If-Match` and `Idempotency-Key`; it returns the new list location and version.
