# Task templates

This capability relays the space task-template library to task-service, which owns access, eligibility, snapshot and capacity decisions.

## Public entry points

This module exposes HTTP routes and publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                                              | Internal call                                                      | Scope         |
| --------------------------------------------------------- | ------------------------------------------------------------------ | ------------- |
| `GET /v1/spaces/{spaceId}/task-templates`                 | `GET /internal/v1/spaces/{spaceId}/task-templates`                 | `tasks:read`  |
| `POST /v1/spaces/{spaceId}/task-templates`                | `POST /internal/v1/spaces/{spaceId}/task-templates`                | `tasks:write` |
| `GET /v1/spaces/{spaceId}/task-templates/{templateId}`    | `GET /internal/v1/spaces/{spaceId}/task-templates/{templateId}`    | `tasks:read`  |
| `DELETE /v1/spaces/{spaceId}/task-templates/{templateId}` | `DELETE /internal/v1/spaces/{spaceId}/task-templates/{templateId}` | `tasks:write` |

## Decisions

Each route invokes an application use case through the task-service port. Writes are sent once. Creation forwards the optional `Idempotency-Key` and returns the public `Location`; deletion forwards optional `If-Match`. Creation and reading return the validated resource version as `ETag`.

The task-service controls template visibility and creation. Declared task-trash and access details are retained. A blank `If-Match` on deletion is rejected; creation requires a JSON body and forwards `Idempotency-Key`.
