# Current account

Owns the public current-user HTTP operations, `GET /v1/me` and `PATCH /v1/me`. Reads and changes
the account of the verified session using the Identity port; identity-service checks the profile
values and the version.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## Decisions

- Session only: a personal API token gets `403 auth.api-token-not-accepted` from the credential
  guard of `auth`.
- `404 user.not-found` of identity-service, on either route, answers `401 auth.session-expired`:
  the public routes declare no `404`, and the session can no longer be used.
- An older identity-service that omits `displayName`, `jobTitle` or `timeZone` is answered with
  the defaults of the contract (`null`, `null`, `Europe/Paris`) by the shared `toCurrentUser`.
