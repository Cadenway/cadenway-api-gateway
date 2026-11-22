# Tasks

Owns the task routes of `openapi/public/tasks.yaml` on the current organization: the tasks of a
list and their groups, a task with its subtasks, checklist, assignees, labels and activity, the
labels of the organization, "Mes tâches" and the task part of "Accueil", and the task detail the
gateway composes. task-service owns the tasks and decides every rule (statuses, subtask depth and
limits, assignees, labels, who sees a task); the gateway decides none.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.
The six operations in `openapi/public/time.yaml` relay work logs, totals and status durations to
task-service. The creation relays `Idempotency-Key` and verifies the internal `Location` before
returning its public path. The producer owns all work log authorization and duration calculations.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                                                  | Internal call                                                          | Token scope   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------- |
| `POST /v1/tasks/bulk-actions`                                 | `POST /internal/v1/tasks/bulk-actions`                                 | `tasks:write` |
| `POST /v1/tasks/{taskKey}/duplicate`                          | `POST /internal/v1/tasks/{taskKey}/duplicate`                          | `tasks:write` |
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

`POST /v1/tasks/bulk-actions` relays an atomic action to `POST /internal/v1/tasks/bulk-actions` with `tasks:write` and an optional `Idempotency-Key`. The gateway validates and forwards the request once; task-service owns the action and its atomicity. Bulk `404` responses omit all upstream details to avoid disclosing hidden targets.

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
  HTTP client: a repeat after a change that succeeded would answer `412`. A blank `If-Match`,
  or a body that is zero-byte or not JSON in UTF-8 on a route whose contract requires one,
  answers `400 request.invalid` before any call.
- The routes addressed by a task key and task bulk actions accept an optional
  `If-Organization-Match` UUIDv7 precondition. After the credential and rate-limit guards, the
  gateway compares it with the verified organization before calling downstream services. An invalid or repeated header answers
  `400 request.invalid`. A mismatch answers `412 organization.context-changed` with
  `Cache-Control: private, no-store` and no resource details. The `If-Match` version precondition
  still applies to writes.
- These routes are marked `no-store`. The gateway ignores read cache validators on these URLs
  because a legacy numeric `ETag` can name different representations in different organizations.
  It still returns the numeric `ETag` where declared for existing `If-Match` writes. Introducing
  representation validators requires a separate contract migration.
- The detail (`GetTaskDetail`, bound in `composition/`) reads the core of task-service and the
  secondary parts in parallel. A core failure cancels any outstanding secondary reads and fails
  the detail immediately. A secondary read is canceled after 800 ms. A failed or timed-out
  secondary part is named in `partial` and left out, subject to the visibility rule below. A task
  in the trash fails the core with `404 task.trashed`: the detail answers that public problem with
  its `details` (`key`, `name`, `entryId`, `rootKey`, `trashedAt`, `trashedBy`, `purgeAt`, without
  `service`), never a `503` or a partial detail. `list.callerRole` of the core is relayed as
  task-service answers it. The first comments page is bound as a secondary part. A comments 404 for `task.not-found`, `task.trashed` or `organization.not-found` before the deadline fails the detail; other failures omit the page and name `comments` in `partial`. A timeout is partial because the core read was authorized at that moment. A core failure takes precedence over every comments outcome. The `ETag` of the detail is the version of the task.

Comments and participants, watchers and dependencies are served by their respective capability modules.

### Goals, reporting and intake

- The six task attachment operations call the single-snapshot Task access check before each
  Storage operation. Reads require `tasks:read`, writes require `tasks:write`. Storage owns
  upload, verification, download and deletion. Signed capability responses carry `no-store`.

- The nine operations in `openapi/public/goals.yaml` relay goals and key results to task-service.
  They preserve declared scopes, conditional requests and idempotency and rewrite creation locations
  to public paths after validating them.
- The five reporting and export operations in `openapi/public/lists.yaml` and
  `openapi/public/reports.yaml` relay the caller's report options. The gateway seals the sprint
  cursor for the actor, organization, list, date and time zone. Task-service selects and authorizes
  CSV rows in a bounded internal stream. The gateway resolves assignee names in bounded
  Organization requests, escapes them and writes the CSV to a private temporary file. For people
  sorting it stores names and row offsets in memory and uses French ordering. It sends the
  download headers only after the internal stream is complete and the CSV is ready.
  The gateway uses two export slots per process, at most one per organization. Each slot uses up
  to 1 GiB of writable disk while preparing and transferring its file. The download has a
  30-second idle timeout and a two-minute transfer deadline.
  Preparation has a 120-second budget.
- The five authenticated intake operations in `openapi/public/intake.yaml` relay the verified
  organization and actor. Anonymous operations use independent per-address windows for form reads,
  submissions, and attachment mutations. They call Task as the unscoped Gateway system actor.
  Reservation and completion use Task's current binding to call Storage with the verified tenant;
  Storage does not receive the applicant's draft key. Release goes to Task, which schedules cleanup
  through its outbox. The Gateway returns only the signed capability or the verification ID and
  answers errors for unknown publications, drafts and reservations without internal details.

`POST /v1/tasks/{taskKey}/duplicate` relays a duplication once with `tasks:write`, source `If-Match` and `Idempotency-Key`; it returns the new task location and version.
