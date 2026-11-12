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

## Errors

Internal `404` of another organization's resource becomes a public `404`, never `403`: the existence of
another tenant's data is not revealed.
