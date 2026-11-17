# Open sessions

Owns the routes of the tag `sessions` of `openapi/public/auth.yaml`: list the open sessions of the
signed-in person, close one of them, and close every other one. identity-service owns the sessions:
it reads their device, records their activity and decides which belong to the account. The
verification of the session cookie on every route belongs to `auth`.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                      | Internal call                                                            |
| --------------------------------- | ------------------------------------------------------------------------ |
| `GET /v1/sessions`                | `GET /internal/v1/users/{userId}/sessions?currentSessionId=<session>`    |
| `DELETE /v1/sessions/{sessionId}` | `DELETE /internal/v1/sessions/{sessionId}`, with the id of the path      |
| `POST /v1/sessions/revoke-others` | `POST /internal/v1/sessions/{sessionId}/revoke-others`, with the session |

## Decisions

- Session only: a personal API token gets `403 auth.api-token-not-accepted`. No route acts on the
  current organization, and none needs a recent authentication.
- The account and the session of the request are the ones the introspection returned: the list
  sends the session as `currentSessionId`, the closing of the others in the path.
- `404 session.not-found` of the list or of the closing of the others means the session of the
  request ended after its introspection: `401 auth.session-expired`, as `404 user.not-found` of
  the list. On `DELETE /v1/sessions/{sessionId}` the code names the session of the path and is
  relayed as `404 session.not-found`.
- The closing of the others and of one session build their internal request from the
  introspection and a path id checked as a UUID: an internal `400` is a defect, answered
  `503 upstream.failed`. The list relays it, since its cursor comes from the browser.
- Every answer carries `Cache-Control: no-store`.
