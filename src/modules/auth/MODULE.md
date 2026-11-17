# Gateway authentication

Owns request authentication, the scopes of personal API tokens, the organization context of a
request, cross-site validation and the verified actor context. The Identity service owns the
validity of sessions and personal API tokens; the outbound adapters delegate to the technical
Identity client exported by the shared clients module.

## Public entry points

| Entry point                        | Consumers                                                        |
| ---------------------------------- | ---------------------------------------------------------------- |
| auth.module                        | auth-routes, me, organizations, members, invitations, api-tokens |
| public/session/csrf-guard          | auth-routes                                                      |
| public/credential/credential-guard | auth-routes, me, organizations, members, invitations, api-tokens |
| public/session/verify-session      | auth-routes, me, organizations, members, invitations, api-tokens |
| public/api-token/verify-api-token  | auth-routes, me, organizations, members, invitations, api-tokens |

`CredentialGuard` is published for the route modules; the `VerifySession` and `VerifyApiToken`
providers are exported because a module that applies the guard instantiates it in its own
injector. Route handlers declare the security of their public operation with
`CredentialGuard.requires` and read the verified credential attached to the request.

## Decisions

- The security of each operation is copied from `openapi/public/` onto its handler and checked
  against the shipped specs by `operation-security.validation.spec.ts`: a route the contract does
  not declare, or a security that differs from it, fails the unit tests.
- A request with `Authorization: Bearer` is authenticated with that token alone; the cookie is
  ignored. The sign-out, whose credential is optional, ignores the bearer token instead.
- The token is introspected before the operation is checked, so an inactive token answers
  `401 auth.api-token-invalid` on every route, and an active one on a session-only route
  `403 auth.api-token-not-accepted`.
- The cross-site check applies to requests authenticated by the cookie: an exact `Origin` and
  `Content-Type: application/json`, but a bodiless `DELETE`, which passes on its `Origin` alone.
  The routes of `openapi/public/auth.yaml` without a session keep `CsrfGuard`, signed in or not.
- The organization and role of a request come from the introspection only, into the internal
  token; the gateway never decides a role rule.
