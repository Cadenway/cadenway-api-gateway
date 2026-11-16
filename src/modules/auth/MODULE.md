# Gateway authentication

Owns request authentication, cross-site validation and the verified actor context.
The Identity service owns session validity. The outbound adapter delegates to the
technical Identity client exported by the shared clients module.

## Public entry points

| Entry point                   | Consumers       |
| ----------------------------- | --------------- |
| auth.module                   | auth-routes, me |
| public/session/csrf-guard     | auth-routes     |
| public/session/session-guard  | auth-routes, me |
| public/session/verify-session | auth-routes, me |

The `VerifySession` provider is exported to resolve published `SessionGuard`
enhancers in consuming route modules. Route handlers consume the guards and
the verified identifiers attached to the request.
