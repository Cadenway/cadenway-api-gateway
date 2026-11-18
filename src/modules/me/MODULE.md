# Current account

Owns the public current-user HTTP operations under `/v1/me`: the account and its profile
(`GET /v1/me`, `PATCH /v1/me`) and the security of the account (`PUT /v1/me/password`,
`POST /v1/me/email-change` and its `confirmation`, `POST /v1/me/deletion`). Reads and changes the
account of the verified session using the Identity port; identity-service checks the values, the
version, the passwords, the codes and the recent authentication.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## Decisions

- Session only: a personal API token gets `403 auth.api-token-not-accepted` from the credential
  guard of `auth`.
- `404 user.not-found` of identity-service, on any route, answers `401 auth.session-expired`:
  the public routes declare no `404`, and the session can no longer be used. The routes about the
  security of the account send identity-service the session the introspection returned
  (`sessionId` in the body), and answer its `404 session.not-found` the same way: the session
  ended after its introspection.
- `403 auth.reauthentication-required` of identity-service (change of address, deletion) is
  forwarded with its `details.methods` and its French title; the gateway decides nothing about
  the recent authentication.
- The deletion clears the session cookie on its `202`: identity-service has revoked every session
  of the account. A refused deletion leaves the cookie. Its internal body holds only the
  introspected session, so an internal `400` is a defect, answered `503 upstream.failed`.
- The password change is not retried after a connection error or a `503`, although it is a
  `PUT`: a change already applied would be repeated with a current password that no longer
  works, counting a failure towards the lockout.
- An older identity-service that omits `displayName`, `jobTitle` or `timeZone` is answered with
  the defaults of the contract (`null`, `null`, `Europe/Paris`) by the shared `toCurrentUser`;
  `passwordChangedAt` is passed on when identity-service sends it and left out otherwise.
- Passwords and codes are never logged.
