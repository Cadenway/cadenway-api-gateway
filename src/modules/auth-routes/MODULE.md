# Public authentication routes

Owns the public sign-in, sign-up, code, sign-out, password reset and re-authentication HTTP
operations under `/v1/auth`. Delegates account and session operations to Identity through an owned
port.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## Decisions

- The password reset (`POST /v1/auth/password-reset`, its `inspection` and its `confirmation`)
  carries no session (`security: []`): it is counted on the client address like the sign-in
  flows, and it never signs in. The reset token arrives in the body, never in a URL: the link
  keeps it in its fragment (`#token=`), which only the browser reads.
- `POST /v1/auth/reauthentication` needs the session, so `ReauthenticationController` serves it
  with the guards of the session routes (`CredentialGuard`, `RateLimitGuard`) and without
  `CsrfGuard`: the credential guard applies the cross-site check to a cookie request, and a
  personal API token, which needs no `Origin`, gets `403 auth.api-token-not-accepted`. The gateway
  sends identity-service the session the introspection returned, in the path.
  `404 session.not-found` means that session ended after its introspection:
  `401 auth.session-expired`.
- The routes that sign in pass `deletionCancelled` on when identity-service sends it.
- Passwords, codes and reset tokens are never logged.
