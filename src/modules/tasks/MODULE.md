# Tasks

Owns the task routes of `openapi/public/tasks.yaml` on the current organization: the tasks of a
list and their groups, a task with its subtasks, checklist, assignees, labels and activity, the
labels of the organization, "Mes tâches" and the task part of "Accueil", and the task detail the
gateway composes. task-service owns the tasks and decides every rule (statuses, subtask depth and
limits, assignees, labels, who sees a task); the gateway decides none.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                                                  | Internal call                                                          | Token scope   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------- |
| `GET /v1/lists/{listId}/tasks`                                | `GET /internal/v1/lists/{listId}/tasks`                                | `tasks:read`  |
| `POST /v1/lists/{listId}/tasks`                               | `POST /internal/v1/lists/{listId}/tasks`                               | `tasks:write` |
| `GET /v1/lists/{listId}/task-groups`                          | `GET /internal/v1/lists/{listId}/task-groups`                          | `tasks:read`  |
| `GET /v1/tasks/{taskKey}`                                     | `GET /internal/v1/tasks/{taskKey}`                                     | `tasks:read`  |
| `PATCH /v1/tasks/{taskKey}`                                   | `PATCH /internal/v1/tasks/{taskKey}`                                   | `tasks:write` |
| `GET /v1/tasks/{taskKey}/detail`                              | `GET /internal/v1/tasks/{taskKey}/detail` (aggregate)                  | `tasks:read`  |
| `GET /v1/tasks/{taskKey}/subtasks`                            | `GET /internal/v1/tasks/{taskKey}/subtasks`                            | `tasks:read`  |
| `POST /v1/tasks/{taskKey}/subtasks`                           | `POST /internal/v1/tasks/{taskKey}/subtasks`                           | `tasks:write` |
| `POST /v1/tasks/{taskKey}/checklist-items`                    | `POST /internal/v1/tasks/{taskKey}/checklist-items`                    | `tasks:write` |
| `PATCH /v1/tasks/{taskKey}/checklist-items/{checklistItemId}` | `PATCH /internal/v1/tasks/{taskKey}/checklist-items/{checklistItemId}` | `tasks:write` |
| `PUT /v1/tasks/{taskKey}/assignees/{userId}`                  | `PUT /internal/v1/tasks/{taskKey}/assignees/{userId}`                  | `tasks:write` |
| `DELETE /v1/tasks/{taskKey}/assignees/{userId}`               | `DELETE /internal/v1/tasks/{taskKey}/assignees/{userId}`               | `tasks:write` |
| `POST /v1/tasks/{taskKey}/labels/add`                         | `POST /internal/v1/tasks/{taskKey}/labels/add`                         | `tasks:write` |
| `POST /v1/tasks/{taskKey}/labels/remove`                      | `POST /internal/v1/tasks/{taskKey}/labels/remove`                      | `tasks:write` |
| `GET /v1/tasks/{taskKey}/activity`                            | `GET /internal/v1/tasks/{taskKey}/activity`                            | `tasks:read`  |
| `GET /v1/labels`                                              | `GET /internal/v1/labels`                                              | `tasks:read`  |
| `GET /v1/me/tasks`                                            | `GET /internal/v1/users/{userId}/tasks`                                | `tasks:read`  |
| `GET /v1/me/home`                                             | `GET /internal/v1/users/{userId}/home`                                 | `tasks:read`  |

## Decisions

- Credentials, scopes, organization context, opaque relay and problem translation as in
  [spaces](../spaces/MODULE.md#decisions). A client error task-service declares internally but
  the public operation does not (`task.list-invalid` on a creation, for example) is
  `503 upstream.failed`.
- Roles, the trash and archives are decided by task-service, never by the gateway, which reads
  no role and no state of a task. Every write, the creation of a task included, relays
  `403 access.role-insufficient` (the caller lacks `edit` on the list, `details.role` and
  `details.requiredRole`). Every route of a task key, reads and writes, the detail and
  `/checklist-items/{checklistItemId}` included, relays `404 task.trashed` beside
  `404 task.not-found`: task-service answers the first to a caller who could change the list of
  a task in the trash, the second to anyone else. `409 task.archived` (`details.key`) is relayed
  by the changes of a task (`PATCH`, assignees, labels, checklist item) and by the creation of a
  subtask or a checklist item, with `idempotency.request-in-progress` there. An archived task
  reads normally: `GET /v1/tasks/{taskKey}` and the detail answer it with `archivedAt` and
  `archivedBy`. The archive, unarchive and trash routes of a task belong to the `archives` and
  `trash` modules.
- A task is named by its key in every path. `assignee=me` is relayed for task-service to resolve;
  the array filters (`status`, `priority`, `assignee`, `label`, `kind`) are comma-separated.
- `GET /v1/me/tasks` and `GET /v1/me/home` call task-service with the user of the verified
  credential, never one the request names; `home` relays the `today` of the caller.
- Creations answer `201` with `Location: /v1/tasks/<key>` and the `ETag` of the task; a checklist
  item with `Location: /v1/tasks/<key>/checklist-items/<checklistItemId>`, its id read from the
  `Location` task-service answers. The unassignment answers `204` with the `ETag` task-service
  sent. The label routes answer `200`. A call with `If-Match` is never retried by the internal
  HTTP client: a repeat after a change that succeeded would answer `412`.
- The detail (`GetTaskDetail`, bound in `composition/`) reads the core of task-service and the
  secondary parts in parallel. The core is the main part: its failure fails the detail. A
  secondary part that fails or takes more than 800 ms is named in `partial` and left out. A task
  in the trash fails the core with `404 task.trashed`: the detail answers that public problem with
  its `details` (`key`, `name`, `entryId`, `rootKey`, `trashedAt`, `trashedBy`, `purgeAt`, without
  `service`), never a `503` or a partial detail. `list.callerRole` of the core is relayed as
  task-service answers it. In this
  version no part is bound, so `partial` is `[]`; a later part (attachments, development links,
  comments) is one more `TaskDetailPart` adapter and one more member of the public mapping. The
  `ETag` of the detail is the version of the task.
