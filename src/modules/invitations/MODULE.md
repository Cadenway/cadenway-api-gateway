# Invitations

Owns the invitation routes of `openapi/public/members.yaml`: invite a batch of addresses to the
current organization, list its pending invitations, read one in any state, revoke and resend one;
and, for the invitee, list the invitations addressed to them, accept or refuse one.
organization-service owns the
invitations and decides every rule (who may invite, the verified address of the invitee, the
state of an invitation); the gateway decides none.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                                     | Internal call                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `POST /v1/invitations` without `Idempotency-Key` | `POST /internal/v1/invitations`                                      |
| `POST /v1/invitations` with `Idempotency-Key`    | `POST /internal/v1/invitation-batches`                               |
| `GET /v1/invitations`                            | `GET /internal/v1/invitations`                                       |
| `GET /v1/invitations/{invitationId}`             | `GET /internal/v1/invitations/{invitationId}`                        |
| `DELETE /v1/invitations/{invitationId}`          | `DELETE /internal/v1/invitations/{invitationId}`                     |
| `POST /v1/invitations/{invitationId}/resend`     | `POST /internal/v1/invitations/{invitationId}/resend`                |
| `GET /v1/me/invitations`                         | `GET /internal/v1/users/{userId}/invitations`                        |
| `POST /v1/me/invitations/{invitationId}/accept`  | `POST /internal/v1/users/{userId}/invitations/{invitationId}/accept` |
| `POST /v1/me/invitations/{invitationId}/refuse`  | `POST /internal/v1/users/{userId}/invitations/{invitationId}/refuse` |

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
- An `Idempotency-Key` (1 to 255 characters, otherwise `400 request.invalid` before any call)
  sends the batch to `POST /internal/v1/invitation-batches` with the key unchanged, after the
  `If-Organization-Match` check; a key is never dropped nor sent to
  `POST /internal/v1/invitations`. `409 idempotency.request-in-progress` and
  `422 idempotency.key-reused` are relayed with the reason phrase of their status (the contract
  gives them no French title). `429 invitation.keyed-batch-limit-reached` (the replay record
  budget of the organization is used up) is relayed the same way, title `Too Many Requests`, with
  `details.nextAvailableAt` and `Retry-After` derived from it. Only a keyed batch answers it, but
  both internal routes declare it, so the unkeyed relay accepts it as well. A `429` is a client
  error of the internal HTTP client: never retried and never counted by the circuit breaker.
- A `404` of the keyed route whose code is not `organization.not-found` comes from an
  organization-service release without replay support: `503 upstream.unavailable`
  (`details.service: organization-service`) with `Retry-After: 10`, the half-open delay of the
  circuit breaker of the internal HTTP client. Nothing ran, so the same key may be sent again.
  The other `503` answers carry no `Retry-After`. Deploy order: organization-service with the
  keyed route can ship before or after this gateway release.
- `GET /v1/invitations/{invitationId}` answers `Cache-Control: private, no-store` and never `304`:
  `createGatewayApplication` drops its `If-None-Match` and `If-Modified-Since`. It sends no `ETag`,
  as organization-service does not: the expiry changes the state of an invitation without a new
  `version`, so a tag derived from it would wrongly say "unchanged". The handler writes the answer
  itself, so the `EtagInterceptor` of the kit, which tags every other answer with a `version`, sees
  no body.
