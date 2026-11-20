# Saved views

This capability relays a list's saved views to task-service, which owns access, configuration, ordering and capacity decisions.

## Public entry points

This module exposes HTTP routes and publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                                             | Internal call                                                     | Scope         |
| -------------------------------------------------------- | ----------------------------------------------------------------- | ------------- |
| `GET /v1/lists/{listId}/saved-views`                     | `GET /internal/v1/lists/{listId}/saved-views`                     | `tasks:read`  |
| `POST /v1/lists/{listId}/saved-views`                    | `POST /internal/v1/lists/{listId}/saved-views`                    | `tasks:write` |
| `GET /v1/lists/{listId}/saved-views/{viewId}`            | `GET /internal/v1/lists/{listId}/saved-views/{viewId}`            | `tasks:read`  |
| `PATCH /v1/lists/{listId}/saved-views/{viewId}`          | `PATCH /internal/v1/lists/{listId}/saved-views/{viewId}`          | `tasks:write` |
| `DELETE /v1/lists/{listId}/saved-views/{viewId}`         | `DELETE /internal/v1/lists/{listId}/saved-views/{viewId}`         | `tasks:write` |
| `POST /v1/lists/{listId}/saved-views/{viewId}/duplicate` | `POST /internal/v1/lists/{listId}/saved-views/{viewId}/duplicate` | `tasks:write` |

## Decisions

Every route uses an application use case through the task-service port. Writes are sent once. Create and duplicate forward `Idempotency-Key` and return a public `Location`; update, delete and duplicate forward optional `If-Match`. Responses with a view return its validated version as `ETag`.

The task-service controls view visibility and changes. Declared access and version-mismatch details are retained. A blank `If-Match` is rejected, duplicate requires a strict empty JSON body, and create and patch require JSON bodies.
