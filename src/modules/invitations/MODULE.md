# Invitations

Owns the invitation routes of `openapi/public/members.yaml`: invite a batch of addresses to the
current organization, list its pending invitations, revoke and resend one; and, for the invitee,
list the invitations addressed to them, accept or refuse one. organization-service owns the
invitations and decides every rule (who may invite, the verified address of the invitee, the
state of an invitation); the gateway decides none.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                                    | Internal call                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `POST /v1/invitations`                          | `POST /internal/v1/invitations`                                      |
| `GET /v1/invitations`                           | `GET /internal/v1/invitations`                                       |
| `DELETE /v1/invitations/{invitationId}`         | `DELETE /internal/v1/invitations/{invitationId}`                     |
| `POST /v1/invitations/{invitationId}/resend`    | `POST /internal/v1/invitations/{invitationId}/resend`                |
| `GET /v1/me/invitations`                        | `GET /internal/v1/users/{userId}/invitations`                        |
| `POST /v1/me/invitations/{invitationId}/accept` | `POST /internal/v1/users/{userId}/invitations/{invitationId}/accept` |
| `POST /v1/me/invitations/{invitationId}/refuse` | `POST /internal/v1/users/{userId}/invitations/{invitationId}/refuse` |

## Decisions

- Session only: a personal API token gets `403 auth.api-token-not-accepted`. The routes of the
  current organization answer `403 organization.not-selected` without one, before any call; the
  routes of the invitee work without a current organization.
- The `userId` of the invitee routes is the user the introspection returned. A `404 user.not-found`
  of organization-service (a path user that is not the actor) cannot follow from a request and
  answers `503 upstream.failed`.
- On a route about one invitation of the current organization, `404 organization.not-found` (the
  caller left it) answers the `404 invitation.not-found` the public operation declares.
- The empty bodies of the resend, the acceptance and the refusal are checked strictly
  (`additionalProperties: false`).
