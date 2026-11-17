# Rate limit

Owns the per-credential rate limit of the gateway (decision 8 of the integration plan): 600
requests per minute per session or personal API token, counted in fixed windows on the gateway's
Redis with rate-limiter-flexible, and `429 rate-limit.exceeded` with `Retry-After` beyond. The
counter key is the kind and the id of the credential that the introspection returned
(`rate-limit:session:<sessionId>`, `rate-limit:api-token:<apiTokenId>`), never its secret. Redis
holds these counters and nothing else; the connection belongs to the technical `RedisModule`.

## Public entry points

| Entry point                      | Consumers                                                        |
| -------------------------------- | ---------------------------------------------------------------- |
| rate-limit.module                | auth-routes, me, organizations, members, invitations, api-tokens |
| public/requests/rate-limit-guard | auth-routes, me, organizations, members, invitations, api-tokens |
| public/requests/count-request    | auth-routes, me, organizations, members, invitations, api-tokens |

`RateLimitGuard` runs after the credential guard of `auth`, which attaches the verified
credential; `CountRequest` is exported because a module that applies the guard instantiates it in
its own injector.

## Decisions

- **Order.** The credential guard runs first: a request it refuses (`401`, `403`) is not counted,
  and a request without a credential (`security: []`, or a sign-out without an active session) is
  not limited here.
- **Headers.** Only `Retry-After`: the contracts declare no `RateLimit` header.
- **Redis down.** When Redis cannot count (unreachable, not ready, or slower than 100
  milliseconds), the request is counted in the memory of the instance with the same quota, and
  so are the requests of the next second before Redis is tried again; a `warn` line says so once
  per outage and a line says when Redis counts again. The authenticated
  routes stay available and a credential is still limited per instance (at most 600 times the
  number of instances per minute) rather than not at all; readiness reports the outage meanwhile.
