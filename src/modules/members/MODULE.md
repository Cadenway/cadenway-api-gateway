# Members

Owns the member routes of `openapi/public/members.yaml` on the current organization: list and
read the members, change the role of a member and remove one. organization-service owns the
members and decides every role rule (guests do not read the list, nobody changes the role of the
owner or removes them, nobody becomes owner); the gateway decides none.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                    | Internal call                            | Credential                       |
| ------------------------------- | ---------------------------------------- | -------------------------------- |
| `GET /v1/members`               | `GET /internal/v1/members`               | session, or token `members:read` |
| `GET /v1/members/{memberId}`    | `GET /internal/v1/members/{memberId}`    | session, or token `members:read` |
| `PATCH /v1/members/{memberId}`  | `PATCH /internal/v1/members/{memberId}`  | session                          |
| `DELETE /v1/members/{memberId}` | `DELETE /internal/v1/members/{memberId}` | session                          |

## Decisions

- A personal API token without `members:read` gets `403 auth.scope-missing`, one on the session
  routes `403 auth.api-token-not-accepted`; a session without a current organization
  `403 organization.not-selected`. All before any call.
- On a route about one member, `404 organization.not-found` of organization-service (the caller
  left the organization) answers the `404 member.not-found` the public operation declares.
- `role` of the list is a comma-separated query parameter (`role=owner,admin`); `limit` is read
  from its text before the validator of the contract checks it.
- `If-Match` is relayed unchanged; the `ETag` of an answer is its `version`.
