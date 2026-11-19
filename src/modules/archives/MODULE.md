# Archives

Owns the routes of `openapi/public/archives.yaml` on the current organization: archive and
restore a list or a sprint, archive and restore a task with its subtasks, and list the archived
lists and tasks of the page "Archives". task-service owns the archives and decides every rule
(who may archive, what an archive takes with it, where a restored task goes); the gateway decides
none.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                         | Internal call                                 | Token scope   |
| ------------------------------------ | --------------------------------------------- | ------------- |
| `POST /v1/lists/{listId}/archive`    | `POST /internal/v1/lists/{listId}/archive`    | `tasks:write` |
| `POST /v1/lists/{listId}/unarchive`  | `POST /internal/v1/lists/{listId}/unarchive`  | `tasks:write` |
| `POST /v1/tasks/{taskKey}/archive`   | `POST /internal/v1/tasks/{taskKey}/archive`   | `tasks:write` |
| `POST /v1/tasks/{taskKey}/unarchive` | `POST /internal/v1/tasks/{taskKey}/unarchive` | `tasks:write` |
| `GET /v1/archives/lists`             | `GET /internal/v1/archives/lists`             | `tasks:read`  |
| `GET /v1/archives/tasks`             | `GET /internal/v1/archives/tasks`             | `tasks:read`  |

## Decisions

- Credentials, scopes, organization context, opaque relay and problem translation as in
  [spaces](../spaces/MODULE.md#decisions).
- The four actions answer `200` with the list or the task and its `ETag`, the `version` of the
  body; `If-Match` is optional, refused blank with `400 request.invalid` by the shared
  `@IfMatchHeader()` and otherwise relayed unchanged. Their body is the empty object of
  `EmptyRequest`, required (a zero-byte body answers `400 request.invalid`), refused with any
  other member, and relayed.
- `403 access.role-insufficient` and `404 task.trashed` are relayed with their `details` (the
  roles; the trash entry of the task).
- The listings relay `cursor` and `limit`; they carry no `ETag`.
