# Public authentication routes

Owns the public sign-in (with its two-step challenge), sign-up, code, sign-out, password reset and
re-authentication HTTP operations under `/v1/auth`. Delegates account and session operations to Identity through an owned
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
- The two sign-ins (password, email code) send the trusted device cookie
  `__Host-cw_trusted_device` as `trustedDeviceToken` when it holds 1 to 256 characters, and no other
  route reads it. Their `202`, for an account with two-step verification, is validated with
  `InspectSignInChallengeInternalResponse` and answered as is, with no cookie.
- `SignInChallengeController` serves `/v1/auth/sign-in/challenge/…` (inspection, the code of the
  app, a backup code, the WebAuthn options and the answer of a key) with the guards of the flows:
  `CsrfGuard`, no session, and the limit per client address. A right answer sets the session
  cookie, and, when it asked for `trustDevice` and identity-service returned `trustedDevice`, the
  device cookie with exactly the attributes of the contract (`SameSite=Strict`,
  `Max-Age=2592000`). The contract clears the device cookie nowhere: identity-service forgets the
  devices and ignores a stale cookie.
- `POST /v1/auth/reauthentication` sends `password` or `code` as the browser sent them and relays
  `403 auth.reauthentication-required`, `409 auth.two-step-not-enabled`,
  `422 auth.two-step-code-invalid` and `429 auth.two-step-locked` besides the refusals of the
  password.
- Passwords, codes, backup codes, challenge and device tokens and WebAuthn answers are never
  logged.
