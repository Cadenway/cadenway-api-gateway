# Access

Owns the routes of `openapi/public/access.yaml` on the current organization: list, give or change
and remove the grants of a space and of a list, ask for access to a space, a list or a task, and
list, approve or refuse the pending requests. task-service owns the grants and the access requests
and decides every rule (who manages a grant, who may be given one, whether a request is stored, who
answers it, the hourly limit of requests); the gateway decides none.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                                          | Internal call                                                  | Token scope   |
| ----------------------------------------------------- | -------------------------------------------------------------- | ------------- |
| `GET /v1/spaces/{spaceId}/grants`                     | `GET /internal/v1/spaces/{spaceId}/grants`                     | `tasks:read`  |
| `PUT /v1/spaces/{spaceId}/grants/{userId}`            | `PUT /internal/v1/spaces/{spaceId}/grants/{userId}`            | `tasks:write` |
| `DELETE /v1/spaces/{spaceId}/grants/{userId}`         | `DELETE /internal/v1/spaces/{spaceId}/grants/{userId}`         | `tasks:write` |
| `GET /v1/lists/{listId}/grants`                       | `GET /internal/v1/lists/{listId}/grants`                       | `tasks:read`  |
| `PUT /v1/lists/{listId}/grants/{userId}`              | `PUT /internal/v1/lists/{listId}/grants/{userId}`              | `tasks:write` |
| `DELETE /v1/lists/{listId}/grants/{userId}`           | `DELETE /internal/v1/lists/{listId}/grants/{userId}`           | `tasks:write` |
| `POST /v1/access-requests`                            | `POST /internal/v1/access-requests`                            | `tasks:write` |
| `GET /v1/access-requests`                             | `GET /internal/v1/access-requests`                             | `tasks:read`  |
| `POST /v1/access-requests/{accessRequestId}/approval` | `POST /internal/v1/access-requests/{accessRequestId}/approval` | `tasks:write` |
| `POST /v1/access-requests/{accessRequestId}/refusal`  | `POST /internal/v1/access-requests/{accessRequestId}/refusal`  | `tasks:write` |

## Decisions

- Credentials, scopes, organization context, opaque relay and problem translation as in
  [spaces](../spaces/MODULE.md#decisions). The contract gives grants no scope of their own in this
  version: they are managed with `tasks:write`.
- Two ports, named after their resources: `GrantRegistry` and `AccessRequestRegistry`. The module
  never reaches the internal `/access` routes of task-service, which belong to
  cadenway-realtime-gateway.
- A grant change answers the version of the space or the list as `ETag`, which the `Grant` body
  does not carry: `200` with the grant for a `PUT`, `204` with no body for a `DELETE`. `If-Match`
  is optional and relayed unchanged.
- The grants of a space relay `403 space.manage-forbidden`, those of a list
  `403 access.role-insufficient`, each only where its operation declares it: the other code is
  `503 upstream.failed`. A `404` is relayed as the same `404`, never as another answer.
- `POST /v1/access-requests` always answers `202` with no body; task-service alone answers
  `400 request.invalid` for none or several targets, the public validator only bounds the
  message to 500 characters. Its `429 access-request.limit-reached` is relayed with
  `details.nextAvailableAt` and `Retry-After`, the whole seconds until then, rounded up and at
  least 1. The gateway's own `429 rate-limit.exceeded` answers before any call.
- The approval and the refusal are actions that answer `200` with the request; an approval relays
  the `422` refusals of a grant its operation declares, and both relay
  `409 access-request.already-decided` with `details.state`.
