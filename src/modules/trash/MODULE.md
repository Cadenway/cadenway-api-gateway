# Trash

Owns the routes of `openapi/public/trash.yaml` on the current organization: delete a task with
its subtasks, list the trash, restore or erase an entry, empty the trash. task-service owns the
trash and decides every rule (who may delete, restore or erase what, what a restoration brings
back, when an entry is erased); the gateway decides none.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                               | Internal call                                       | Token scope   |
| ------------------------------------------ | --------------------------------------------------- | ------------- |
| `POST /v1/tasks/{taskKey}/trash`           | `POST /internal/v1/tasks/{taskKey}/trash`           | `tasks:write` |
| `GET /v1/trash/entries`                    | `GET /internal/v1/trash/entries`                    | `tasks:read`  |
| `POST /v1/trash/entries/{entryId}/restore` | `POST /internal/v1/trash/entries/{entryId}/restore` | `tasks:write` |
| `DELETE /v1/trash/entries/{entryId}`       | `DELETE /internal/v1/trash/entries/{entryId}`       | `tasks:write` |
| `POST /v1/trash/empty`                     | `POST /internal/v1/trash/empty`                     | `tasks:write` |

## Decisions

- Credentials, scopes, organization context, opaque relay and problem translation as in
  [spaces](../spaces/MODULE.md#decisions).
- The deletion of a task and the restoration of an entry answer `200`, the erasure `204` without
  a body, the emptying `202` with `entryCount`. No success answer of the contract declares an
  `ETag` or a `Location`, and no body has a top-level `version`, so none is set. The optional
  `If-Match` of the deletion is relayed unchanged, a blank one refused with
  `400 request.invalid`; the other routes declare none.
- The `EmptyRequest` bodies of the deletion, the restoration and the emptying are required: a
  zero-byte body (`Content-Length: 0`) or a `Content-Type` other than JSON in UTF-8 (a form
  body `&` included) answers `400 request.invalid`, a literal `{}` is accepted. A body whose
  decoded text is empty (empty chunked, empty under a `Content-Encoding`, lone UTF-8 byte-order
  mark) still reads as `{}`: a limit of the parser of cadenway-service-kit. They are checked
  with `.strict()`: the contract declares `additionalProperties: false`, which the generated
  validator does not enforce, so a body with any member answers `400 request.invalid` before
  any call.
- The `details` of `404 task.trashed` (the entry the task is in), of `409 task.archived` (`key`)
  and of `403 access.role-insufficient` (`role`, `requiredRole`) are relayed without
  `details.service`.
- Each route relays the codes both its public and its internal operation declare. The public
  `403 access.role-insufficient` of the restoration, the erasure and the emptying is not declared
  by their internal operations (an entry the caller may not manage is not found), so it is never
  relayed there: task-service answering it would be `503 upstream.failed`.
- task-service serves the trash routes, and the deletion of a list or a space that sends their
  tasks here, only once its PR 3 (trash and deletion) is merged and deployed. Until then these
  routes answer `503 upstream.failed`: task-service answers its unknown route with a `404` whose
  code no public operation declares.

The restoration forwards `reportNotReady` and relays `409 trash-entry.not-restorable-yet`.
