# Two-step verification

Owns the routes of the tag `two-step-verification` of `openapi/public/auth.yaml`, under
`/v1/me/two-step-verification`: read the two-step verification of the signed-in person, turn it
off, set up or reconfigure the authenticator app, generate new backup codes, and register or
remove a security key. identity-service owns the two-step verification: it keeps the secret of
the app encrypted and the backup codes hashed, verifies the WebAuthn answers, checks the recent
authentication and applies the authentication policies. The gateway decides none of it. The
two-step challenge of the sign-ins belongs to `auth-routes`.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                                                             | Internal call                                                                                 |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `GET /v1/me/two-step-verification`                                       | `GET /internal/v1/users/{userId}/two-step-verification`                                       |
| `DELETE /v1/me/two-step-verification`                                    | `POST /internal/v1/users/{userId}/two-step-verification/disable`                              |
| `POST /v1/me/two-step-verification/authenticator-app/setup`              | `POST /internal/v1/users/{userId}/two-step-verification/authenticator-app/setup`              |
| `POST /v1/me/two-step-verification/authenticator-app/setup/confirmation` | `POST /internal/v1/users/{userId}/two-step-verification/authenticator-app/setup/confirmation` |
| `POST /v1/me/two-step-verification/backup-codes/regenerate`              | `POST /internal/v1/users/{userId}/two-step-verification/backup-codes/regenerate`              |
| `POST /v1/me/two-step-verification/security-keys/registration`           | `POST /internal/v1/users/{userId}/two-step-verification/security-keys/registration`           |
| `POST /v1/me/two-step-verification/security-keys`                        | `POST /internal/v1/users/{userId}/two-step-verification/security-keys`                        |
| `DELETE /v1/me/two-step-verification/security-keys/{securityKeyId}`      | `POST /internal/v1/users/{userId}/two-step-verification/security-keys/{securityKeyId}/remove` |

Every internal call carries the user and, in the body, the session the introspection returned
(`sessionId`), and the browser of the request (`client`) for the security emails where the
internal operation takes it.

## Decisions

- Session only: a personal API token gets `403 auth.api-token-not-accepted`. No route needs an
  organization, so a person whose organization is withheld for want of two-step verification
  (`403 organization.mfa-required` on the organization routes) sets it up here.
- Recent authentication is checked by identity-service on the starts and removals; its
  `403 auth.reauthentication-required` is relayed with `details.methods` and the French title.
- `404 session.not-found` and `404 user.not-found` mean the session of the request ended after its
  introspection: `401 auth.session-expired`. `404 security-key.not-found` of the removal is
  relayed as is: it names the key of the path.
- The routes whose internal body holds only the introspected session and the browser (the
  disabling, the starts, the regeneration) answer an internal `400` as `503 upstream.failed`; the
  confirmation and the addition of a key relay it, since their code, name and answer come from the
  browser.
- The WebAuthn options identity-service builds and the answers the browser sends are passed on
  whole, members the contract does not list included, as the contract asks.
- The secret of the app, its `otpauth://` URI and the backup codes reach the browser once, in the
  answer of the route that creates them; like the codes and the WebAuthn answers, they are never
  logged. Every answer carries `Cache-Control: no-store`.
- None of these calls is retried but the read (`GET`): a start replaces the pending setup or
  registration, and a confirmation or a removal may already have been applied.
- The addition answers `201` with `Location: /v1/me/two-step-verification/security-keys/<id>`, the
  public path of the key.
