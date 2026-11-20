# Watchers

The watchers capability relays task watcher operations to task-service, which owns eligibility, access and subscription decisions.

## Public entry points

This module exposes HTTP routes and publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                                   | Internal call                                           | Scope         |
| ---------------------------------------------- | ------------------------------------------------------- | ------------- |
| `GET /v1/tasks/{taskKey}/watchers`             | `GET /internal/v1/tasks/{taskKey}/watchers`             | `tasks:read`  |
| `PUT /v1/tasks/{taskKey}/watchers/{userId}`    | `PUT /internal/v1/tasks/{taskKey}/watchers/{userId}`    | `tasks:write` |
| `DELETE /v1/tasks/{taskKey}/watchers/{userId}` | `DELETE /internal/v1/tasks/{taskKey}/watchers/{userId}` | `tasks:write` |

## Decisions

Every route invokes an application use case through the task-service port. Both writes are sent once, forward optional `If-Match`, and return the upstream task version as `ETag`. The PUT requires a strict empty JSON body. Public and internal validators check the request and response.

The task-service controls watcher eligibility. `watcher.recipient-invalid` never exposes upstream details; declared access and version-mismatch details are retained. A blank `If-Match` is rejected, and the PUT requires a strict empty JSON body.
