# Organizations

Owns the public routes of `openapi/public/organizations.yaml`: create an organization, list the
organizations of the caller (the picker), read and update the current organization and its
authentication policy, and choose the current organization of the session. organization-service
owns organizations and decides every role rule; identity-service keeps the current organization of
a session, checks the membership against its copy of the memberships, and keeps and applies the
authentication policy of each organization (decision D5). The gateway decides none of it.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                                   | Internal call                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `POST /v1/organizations`                       | `POST /internal/v1/organizations` (organization-service)                              |
| `GET /v1/organizations`                        | `GET /internal/v1/organizations` (organization-service)                               |
| `GET /v1/organization`                         | `GET /internal/v1/organization` (organization-service)                                |
| `PATCH /v1/organization`                       | `PATCH /internal/v1/organization` (organization-service)                              |
| `PUT /v1/session/organization`                 | `PUT /internal/v1/sessions/{sessionId}/organization` (identity-service)               |
| `GET /v1/organization/authentication-policy`   | `GET /internal/v1/organization/authentication-policy` (identity-service)              |
| `PATCH /v1/organization/authentication-policy` | `PATCH /internal/v1/organization/authentication-policy?sessionId=` (identity-service) |

## Decisions

- Session only: a personal API token gets `403 auth.api-token-not-accepted`. The routes on the
  current organization answer `403 organization.not-selected` before any call when the session
  has none.
- The organization of a call is the one of the internal token, from the introspection; the body
  never names it, except for the choice of the current organization, which identity-service checks.
- `404 session.not-found` of the choice of organization and of the change of the policy answers
  `401 auth.session-expired`: the session ended since its introspection.
- The choice of an organization relays `403 organization.mfa-required` (`details.organizationId`)
  when its policy requires two-step verification of the caller, who has none. On the routes on the
  current organization, the credential guard answers the same code when identity-service withholds
  it, before `403 organization.not-selected`.
- The policy is read and changed as the user of the current organization of the session; the
  change sends the session of the introspection (`?sessionId=`) for its recent authentication and
  relays `403 auth.reauthentication-required`, `403 organization.role-forbidden`,
  `409 auth.two-step-not-enabled` and `412 request.version-mismatch`.
- The creation answers `201` with `Location: /v1/organization` and the `ETag` of the organization;
  the other answers carry the `ETag` of their `version`. `If-Match` is relayed unchanged; a
  blank one answers `400 request.invalid` before any call.
