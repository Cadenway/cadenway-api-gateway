# Gateway authentication

Owns request authentication, the scopes of personal API tokens, the organization context of a
request, cross-site validation and the verified actor context. The Identity service owns the
validity of sessions and personal API tokens; the outbound adapters delegate to the technical
Identity client exported by the shared clients module.

## Public entry points

| Entry point                                        | Consumers                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| auth.module                                        | auth-routes, me, sessions, two-step-verification, organizations, members, invitations, api-tokens, spaces, lists, tasks, access, archives, trash, comments, watchers, dependencies, task-templates, saved-views, favorites, notification-preferences, inbox, reminders, realtime-tickets, profile-media, documents, search, billing, automations, webhooks, site |
| public/session/csrf-guard                          | auth-routes                                                                                                                                                                                                                                                                                                                                                      |
| public/credential/credential-guard                 | auth-routes, me, sessions, two-step-verification, organizations, members, invitations, api-tokens, spaces, lists, tasks, access, archives, trash, comments, watchers, dependencies, task-templates, saved-views, favorites, notification-preferences, inbox, reminders, realtime-tickets, profile-media, documents, search, billing, automations, webhooks, site |
| public/credential/prepare-credential-introspection | auth-routes, me, sessions, two-step-verification, organizations, members, invitations, api-tokens, spaces, lists, tasks, access, archives, trash, comments, watchers, dependencies, task-templates, saved-views, favorites, notification-preferences, inbox, reminders, realtime-tickets, profile-media, documents, search, billing, automations, webhooks, site |
| public/session/verify-session                      | auth-routes, me, sessions, two-step-verification, organizations, members, invitations, api-tokens, spaces, lists, tasks, access, archives, trash, comments, watchers, dependencies, task-templates, saved-views, favorites, realtime-tickets                                                                                                                     |
| public/api-token/verify-api-token                  | auth-routes, me, sessions, two-step-verification, organizations, members, invitations, api-tokens, spaces, lists, tasks, access, archives, trash, comments, watchers, dependencies, task-templates, saved-views, favorites, realtime-tickets                                                                                                                     |
| public/reporting/sprint-report-cursor              | tasks                                                                                                                                                                                                                                                                                                                                                            |
| public/reminder/reminder-cursor                    | reminders                                                                                                                                                                                                                                                                                                                                                        |

`CredentialGuard` is published for the route modules; the `VerifySession` and `VerifyApiToken`
providers are exported because a module that applies the guard instantiates it in its own
injector. Route handlers declare the security of their public operation with
`CredentialGuard.requires` and read the verified credential attached to the request.

## Decisions

- A Sprint report cursor given to a caller is a bounded envelope signed by the gateway and
  bound to the verified organization and account, list, date and time zone. The signing
  input is separate from JWT signing input. A signing-key rotation invalidates earlier
  envelopes. Task still validates its inner cursor and checks current access on every page.
- The security of each operation is copied from `openapi/public/` onto its handler and checked
  against the shipped specs by `operation-security.validation.spec.ts`: a route the contract does
  not declare, or a security that differs from it, fails the unit tests.
- Candidate sessions and well-formed personal API tokens acquire a slot in the shared credential
  admission policy before verification. The slot is released even when Identity fails. Session
  verification remains uncached and each credential keeps its own request quota.
- A request with `Authorization: Bearer` is authenticated with that token alone; the cookie is
  ignored. The sign-out, whose credential is optional, ignores the bearer token instead.
- The token is introspected before the operation is checked, so an inactive token answers
  `401 auth.api-token-invalid` on every route, and an active one on a session-only route
  `403 auth.api-token-not-accepted`.
- Failed bearer tokens are limited per client address (decision 2 of the P2b security
  follow-ups): `VerifyApiToken` asks its `BearerFailureLimit` port, bound to the counters of
  `rate-limit`, before anything else, and answers `throttled` once the address failed 10 times in
  the current minute, so the guard answers `429 rate-limit.exceeded` with `Retry-After` without an
  introspection, whatever the token. A malformed token, or one the introspection does not find
  active, counts one failure and answers `401 auth.api-token-invalid`. A verified token counts
  none and keeps only the per-token limit. `VerifyApiToken` is a command because it records those
  failures.
- The cross-site check applies to requests authenticated by the cookie: an exact `Origin` and
  `Content-Type: application/json`. A bodiless `DELETE` and the explicitly opted-in bodyless
  Inbox and reminder POST operations pass on `Origin` alone without a media type or request body.
  The routes of `openapi/public/auth.yaml` without a session keep `CsrfGuard`, signed in or not.
- The organization and role of a request come from the introspection only, into the internal
  token; the gateway never decides a role rule.
- A `withheldOrganization` of either introspection (two-step verification required by the policy
  of the organization, decision of P2c-2) is checked before the organization and scope checks: a
  session answers `403 organization.mfa-required` with `details.organizationId` on the operations
  on the current organization, and a personal API token on every operation it may call, after
  `403 auth.api-token-not-accepted` and before `403 auth.scope-missing`. A withheld session still
  reaches the routes that need no organization, without any organization context. A code the
  public contracts do not declare is answered `403 organization.not-selected` (session) or
  `403 auth.scope-missing` (token), never as is.
