# Comments

The comments capability relays task comments and eligible participants to task-service. The service owns authorization, comment versions and mention decisions.

## Public entry points

This module exposes HTTP routes and publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                                      | Internal call                                              | Scope         |
| ------------------------------------------------- | ---------------------------------------------------------- | ------------- |
| `GET /v1/tasks/{taskKey}/comments`                | `GET /internal/v1/tasks/{taskKey}/comments`                | `tasks:read`  |
| `POST /v1/tasks/{taskKey}/comments`               | `POST /internal/v1/tasks/{taskKey}/comments`               | `tasks:write` |
| `GET /v1/tasks/{taskKey}/comments/{commentId}`    | `GET /internal/v1/tasks/{taskKey}/comments/{commentId}`    | `tasks:read`  |
| `PATCH /v1/tasks/{taskKey}/comments/{commentId}`  | `PATCH /internal/v1/tasks/{taskKey}/comments/{commentId}`  | `tasks:write` |
| `DELETE /v1/tasks/{taskKey}/comments/{commentId}` | `DELETE /internal/v1/tasks/{taskKey}/comments/{commentId}` | `tasks:write` |
| `GET /v1/tasks/{taskKey}/participants`            | `GET /internal/v1/tasks/{taskKey}/participants`            | `tasks:read`  |

## Decisions

Each route calls an application use case through the task-service port. Writes are sent once. Comment creation forwards the idempotency key; edits require `If-Match`, and deletion accepts it. Comment responses carry the comment version as `ETag`; creation also returns its public `Location`. Query and response bodies use the installed contract validators.

The first comments page is part of the task-detail aggregate. A `mention.recipient-invalid` response never exposes upstream details; declared `task.trashed`, `access.role-insufficient` and `request.version-mismatch` details are retained. A blank `If-Match` is rejected; PATCH requires it, DELETE accepts it optionally.
