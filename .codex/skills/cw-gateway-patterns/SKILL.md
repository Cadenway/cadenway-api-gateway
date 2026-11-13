---
name: cw-gateway-patterns
description: "How cadenway-api-gateway routes, aggregates and degrades: contract-first public routes, generated internal clients, parallel calls with timeouts, partial responses, error translation. Load it before any route or aggregate change."
---

# Gateway patterns

## An authenticated route

```text
request → auth guard (token) → scope guard → organization context → rate limit
        → controller → internal client(s) → mapping to openapi/public → response
```

## An aggregate

1. Start the calls that do not depend on each other together.
2. Give each a timeout (default 800 ms for secondary parts, the route budget for the main one).
3. If the main service fails, the route fails. If a secondary service fails, omit and flag
   that part when the public contract allows a partial response. Otherwise return the contract-defined error.
4. Map to the public contract; never forward internal shapes.

## Deadlines and internal calls

- A public route has a budget of 10 seconds. It travels as a deadline: each internal call gets the
  time left, never its own fresh timeout.
- One internal call waits 2 seconds at most, or the time left when that is shorter. The cap also
  bounds the main call of an aggregate.
- One retry, only on a connection error or a `503`, and only for an idempotent call.
- One circuit breaker per service: while it is open, the call fails at once, as a failing main or
  secondary service does in an aggregate.
- Deadline, retry and breaker belong to the internal HTTP client of `@cadenway/nest-common`; a route
  does not re-implement them.

## Errors

Internal `404` of another organization's resource becomes a public `404`, never `403`: the existence of
another tenant's data is not revealed.

Every error leaves as `application/problem+json` (RFC 9457): `type`, `title`, `status`, `detail`,
`instance`, plus `code` and, when the contract defines them, `details`.

- `code` is `<domain>.<reason>` in kebab-case and stable; its text is French when the webapp shows it
  as is.
- The response carries `X-Request-Id`, the reference the webapp displays.
- The error filter comes from `@cadenway/nest-common`; an internal problem document is translated to
  the public contract, never forwarded.
