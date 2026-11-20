# Dependencies

This capability relays task dependencies and candidate queries to task-service. The service owns graph, access, cycle and eligibility decisions.

## Public entry points

This module exposes HTTP routes and publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                                             | Internal call                                                     | Scope         |
| -------------------------------------------------------- | ----------------------------------------------------------------- | ------------- |
| `GET /v1/tasks/{taskKey}/dependencies`                   | `GET /internal/v1/tasks/{taskKey}/dependencies`                   | `tasks:read`  |
| `POST /v1/tasks/{taskKey}/dependencies`                  | `POST /internal/v1/tasks/{taskKey}/dependencies`                  | `tasks:write` |
| `GET /v1/tasks/{taskKey}/dependencies/{dependencyId}`    | `GET /internal/v1/tasks/{taskKey}/dependencies/{dependencyId}`    | `tasks:read`  |
| `DELETE /v1/tasks/{taskKey}/dependencies/{dependencyId}` | `DELETE /internal/v1/tasks/{taskKey}/dependencies/{dependencyId}` | `tasks:write` |
| `GET /v1/tasks/{taskKey}/dependency-candidates`          | `GET /internal/v1/tasks/{taskKey}/dependency-candidates`          | `tasks:read`  |

## Decisions

Each route invokes an application use case through the task-service port. Writes are sent once and forward `If-Match`; creation also forwards `Idempotency-Key` and returns the public `Location`. Both writes return the anchor task version as `ETag`. The client validates the internal response and creation location.

The task-service controls edge eligibility and cycles. `dependency.cycle` never exposes upstream details; declared task-trash, access and version-mismatch details are retained. A blank `If-Match` is rejected; create and delete accept it optionally.
