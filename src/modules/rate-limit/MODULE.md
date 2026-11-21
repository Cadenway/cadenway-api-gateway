# Rate limit

Owns the rate limits of the gateway, counted in fixed windows on the gateway's Redis with
rate-limiter-flexible, and `429 rate-limit.exceeded` with `Retry-After` beyond each of them:

| Limit                                    | Quota              | Counter key                                                           |
| ---------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| Per session or personal API token        | 600 per minute     | `rate-limit:session:<sessionId>`, `rate-limit:api-token:<apiTokenId>` |
| Per client address, without a credential | 60 per minute      | `rate-limit:anonymous:<pseudonym>`                                    |
| Public intake form reads                 | 30 per minute      | `rate-limit:intake-read:<pseudonym>`                                  |
| Public intake submissions                | 10 per minute      | `rate-limit:intake-submit:<pseudonym>`                                |
| Public intake upload mutations           | 10 per minute      | `rate-limit:intake-attachment:<pseudonym>`                            |
| GitHub webhook deliveries                | 60 per minute      | `rate-limit:webhook-github:<pseudonym>`                               |
| GitLab webhook deliveries                | 60 per minute      | `rate-limit:webhook-gitlab:<pseudonym>`                               |
| Public site contact submissions          | 5 per minute       | `rate-limit:site-contact:<pseudonym>`                                 |
| Public site newsletter submissions       | 10 per minute      | `rate-limit:site-newsletter:<pseudonym>`                              |
| Per client address, failed bearer tokens | 10 failures/minute | `rate-limit:bearer-failures:<pseudonym>`                              |

The first is decision 8 of the integration plan; the two others are decision 2 of the P2b security
follow-ups. A credential is counted on the id the introspection returned, never on its secret; an
address on its pseudonym, never on the address itself. Redis holds these counters and nothing
else; the connection belongs to the technical `RedisModule`.

## Public entry points

| Entry point                              | Consumers                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rate-limit.module                        | auth, auth-routes, me, sessions, two-step-verification, organizations, members, invitations, api-tokens, spaces, lists, tasks, access, archives, trash, comments, watchers, dependencies, task-templates, saved-views, favorites, notification-preferences, inbox, reminders, realtime-tickets, profile-media, documents, search, billing, webhooks, site |
| public/requests/site-rate-limit-guard    | site                                                                                                                                                                                                                                                                                                                                                      |
| public/addresses/count-site-request      | site                                                                                                                                                                                                                                                                                                                                                      |
| public/requests/rate-limit-guard         | auth-routes, me, sessions, two-step-verification, organizations, members, invitations, api-tokens, spaces, lists, tasks, access, archives, trash, comments, watchers, dependencies, task-templates, saved-views, favorites, notification-preferences, inbox, reminders, realtime-tickets, profile-media, documents, search, billing                       |
| public/requests/intake-rate-limit-guard  | tasks                                                                                                                                                                                                                                                                                                                                                     |
| public/requests/webhook-rate-limit-guard | webhooks                                                                                                                                                                                                                                                                                                                                                  |
| public/addresses/count-webhook-request   | webhooks                                                                                                                                                                                                                                                                                                                                                  |
| public/addresses/count-intake-request    | tasks                                                                                                                                                                                                                                                                                                                                                     |
| public/requests/count-request            | auth-routes, me, sessions, two-step-verification, organizations, members, invitations, api-tokens, spaces, lists, tasks, access, archives, trash, comments, watchers, dependencies, task-templates, saved-views, favorites, realtime-tickets                                                                                                              |
| public/addresses/count-anonymous-request | auth-routes, me, sessions, two-step-verification, organizations, members, invitations, api-tokens, spaces, lists, tasks, access, archives, trash, comments, watchers, dependencies, task-templates, saved-views, favorites, realtime-tickets                                                                                                              |
| public/addresses/check-bearer-failures   | auth                                                                                                                                                                                                                                                                                                                                                      |
| public/addresses/count-bearer-failure    | auth                                                                                                                                                                                                                                                                                                                                                      |

`RateLimitGuard` runs after the credential guard of `auth`, which attaches the verified
credential; `CountRequest` and `CountAnonymousRequest` are exported because a module that applies
the guard instantiates it in its own injector. `CheckBearerFailures` and `CountBearerFailure` are
the operations behind the `BearerFailureLimit` port of `auth`, which verifies bearer tokens.

## Decisions

- **Order.** The credential guard runs first: a request it refuses (`401`, `403`) is not counted
  by `RateLimitGuard`. A request with a verified session or token is counted on that credential
  only, whatever its address.
- **Requests without a credential.** `RateLimitGuard` counts a request that reaches it without a
  verified credential on its client address: the routes of `openapi/public/auth.yaml` with
  `security: []` (sign-in methods, sign-up, its code and its verification, sign-in by password,
  sign-in code and its verification, the five routes of the two-step challenge of a sign-in, and
  the password reset: its request, the inspection of its link and its confirmation), and a
  sign-out without an active session, whose contract
  declares the same `429`. Body validation runs after the guards, so a malformed body is counted
  too; a request `CsrfGuard` refuses before them is not, and costs no upstream call.
- **Public intake.** `IntakeRateLimitGuard` counts form reads, submissions, and upload mutations
  separately by pseudonymized address. Reservation, completion, and release share one upload
  quota. The guard runs before route validation and lookup, so unknown keys count. No public or
  draft key is part of a counter. A denied request returns the anonymous `429` problem and
  `Retry-After`.
- **Git webhooks.** `WebhookRateLimitGuard` counts each provider independently by client
  network before validating a delivery or its receiver. Unknown receivers share the same quota.
  A denial includes `Retry-After`, `RateLimit` and `RateLimit-Policy`.
- **Public site forms.** `SiteRateLimitGuard` counts contact and newsletter submissions in
  separate windows by the pseudonymized client address. It counts requests before validation
  and returns a `429` with `Retry-After`, `RateLimit` and `RateLimit-Policy`.
- **Failed bearer tokens.** The credential guard of `auth` reads the failures of the address
  (`CheckBearerFailures`, which counts nothing) before it looks at a bearer token, and answers
  `429` without an introspection once the address has 10 in the window, whatever the token: only
  the introspection could tell a valid token from another. A malformed token, or one the
  introspection does not find active (`401 auth.api-token-invalid`), counts one failure
  (`CountBearerFailure`); a valid token, a refused scope (`403`) or a failed introspection
  (`503`) counts none. The check and the count are two steps around the introspection, so the
  tokens of requests sent concurrently before the tenth failure is counted are all introspected:
  a burst can pass the 10 by as many requests as it keeps in flight, once per window. From then on
  the address waits for the end of the window. Bounding the requests in flight instead would also
  refuse an integration that sends more than 10 valid requests at once.
- **Client address.** `toClientAddress` of `src/presentation/http/mappers/`: `request.ip` with
  `trust proxy` set to one hop, the address Traefik saw, the same address identity-service records
  with a session. An IPv4 address is limited alone, an IPv6 address with its whole `/64`, which
  one subscriber holds and could rotate through; an IPv4 address mapped into IPv6, and a 6to4
  address, are the IPv4 address. Clients behind one address (a carrier-grade NAT, a shared egress)
  share its limits: 10 bad tokens from one of them refuse the bearer tokens of all for the rest of
  the window, but not their sessions.
- **Pseudonyms.** A key holds the first 128 bits, in base64url, of an HMAC-SHA-256 of the network
  of the address under a key derived with HKDF-SHA-256 from the private part of
  `INTERNAL_TOKEN_PRIVATE_JWK`. A plain hash would not do: the 2^32 IPv4 addresses can be hashed in
  minutes, so whoever reads Redis would read the addresses back. The secret is 256 bits, already
  on every instance and the same within an environment, so the counters stay shared and no new
  secret is distributed; the HKDF context separates the derived key from the signing key. Rotating
  the signing key changes every pseudonym, which only restarts the windows in progress. No log
  line carries an address or a pseudonym; the Redis spans of the kit's ioredis instrumentation
  carry the keys, so pseudonyms, never an address.
- **Headers.** The webhook contract also declares `RateLimit` and `RateLimit-Policy` on 429.
  Other existing limits return `Retry-After`.
- **Redis down.** When Redis cannot count or read a counter (unreachable, not ready, or slower
  than 100 milliseconds, which a saturated event loop can cause too), the request is counted,
  or the counter read, in the memory of the instance with the same quota; once a second one
  request tries Redis again while the others keep counting in memory. A `warn` line names the
  limit once per outage and a line says when Redis counts again. All rate limits, including the
  intake limits, stay available per instance (at most the quota times the number of instances per minute);
  readiness reports the outage meanwhile. Each counter holds at most 50,000 keys in memory, about
  8 MB: past it, new keys share one overflow window with the same quota, so a flood of addresses
  cannot exhaust the heap.
