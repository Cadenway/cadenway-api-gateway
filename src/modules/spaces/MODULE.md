# Spaces

Owns the space routes of `openapi/public/spaces.yaml` on the current organization: list, create,
read, change and delete the spaces, and the overview of one. task-service owns the spaces and
decides every rule (who sees a space, the role of the caller on it, who manages it, prefixes,
statuses, deletion); the gateway decides none.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

The single-space read accepts an optional `If-Organization-Match` UUID. A mismatch returns
`412 organization.context-changed` before Task reads the space.

| Public route                          | Internal call                                  | Token scope   |
| ------------------------------------- | ---------------------------------------------- | ------------- |
| `GET /v1/spaces/{spaceId}/milestones` | `GET /internal/v1/spaces/{spaceId}/milestones` | `tasks:read`  |
| `GET /v1/spaces`                      | `GET /internal/v1/spaces`                      | `tasks:read`  |
| `POST /v1/spaces`                     | `POST /internal/v1/spaces`                     | `tasks:write` |
| `GET /v1/spaces/{spaceId}`            | `GET /internal/v1/spaces/{spaceId}`            | `tasks:read`  |
| `PATCH /v1/spaces/{spaceId}`          | `PATCH /internal/v1/spaces/{spaceId}`          | `tasks:write` |
| `DELETE /v1/spaces/{spaceId}`         | `DELETE /internal/v1/spaces/{spaceId}`         | `tasks:write` |
| `GET /v1/spaces/{spaceId}/overview`   | `GET /internal/v1/spaces/{spaceId}/overview`   | `tasks:read`  |

## Decisions

- Every route accepts the session cookie or a personal API token with the scope above. A token
  without it gets `403 auth.scope-missing`, a session without a current organization
  `403 organization.not-selected`, an organization withheld for want of two-step verification
  `403 organization.mfa-required`. All before any call.
- The bodies of task-service are relayed as opaque documents (`TaskServiceDocument`): the client
  checks the query or body against the internal contract before the call and the answer after it,
  and the controller maps the answer to the public contract through the public validator of the
  operation, which drops any member the public contract does not declare. A mismatch of the
  answer is `503 upstream.failed`. `tests/support/task-contract-fit.ts` makes a drift between the
  public and internal validators fail `pnpm typecheck`, as hand-written models would.
- Each route relays the client errors its public operation declares (`<OPERATION>_PROBLEMS`), with
  the French titles of `PROBLEM_TITLES`; any other is `503 upstream.failed`. An actor task-service
  does not know yet answers `404 organization.not-found`, relayed.
- `Idempotency-Key` (1 to 255 characters) and `If-Match` are relayed unchanged; a blank
  `If-Match`, or a required body that is zero-byte or not JSON in UTF-8, answers
  `400 request.invalid` before any call. The
  `ETag` of an answer is the `version` of the space. The creation answers `201` with
  `Location: /v1/spaces/<spaceId>` and the `ETag` of the space.
- The overview relays the `today` of the caller, the day its counts are computed on.
- `callerRole` and `callerCanManage` of a space, and `organizationAccess`, `archivedAt`,
  `archivedBy` and `callerRole` of the first list of a creation, come from task-service and reach
  the answer through the public validator; the gateway reads none of them. A change task-service
  refuses answers `403 access.role-insufficient` or `403 space.visibility-forbidden`, relayed.
- The deletion answers `204` without a body nor an `ETag`, as the contract declares, with
  `If-Match` relayed unchanged; `403 space.manage-forbidden`, `404` and `412` are relayed.
  task-service deletes the lists with the space and moves its tasks to the trash afterwards; the
  gateway decides nothing about either. task-service serves the deletion once its PR 3 (trash and
  deletion) is merged and deployed; until then the route answers `503 upstream.failed`.

`GET /v1/spaces/{spaceId}/milestones` relays a page of visible milestones with `tasks:read`.
