---
paths:
  - 'src/modules/auth/**'
---

# Authentication and authorization

- Only the verifying guard sets organization and member context with
  `setRequestOrganizationContext` from `@cadenway/nest-common`, using the verified introspection result.
- Use `CredentialGuard.requires` to declare each public operation's `security` as shipped by
  the contract and checked by the unit tests. Require route-declared scopes for API tokens (`tasks:read`, `tasks:write`, `members:read`,
  `webhooks:manage`). A session holds every scope. Use configured issuers and verification keys.
- Limit requests without a credential to 60 per minute per client address and failed bearer
  authentications to 10 per minute per address. Reject excess bearer requests with
  `429 rate-limit.exceeded` before introspection. Read `request.ip` with one trusted hop and
  use a keyed hash for every address counter key. Valid sessions and tokens keep their own limits.
- Follow [`cw-auth-tokens`](../skills/cw-auth-tokens/SKILL.md) for cookie and CSRF requirements,
  per-request session introspection, and internal JWT claims and lifetime. Keep the session opaque
  and uncached. Never decode it. Forward only the short-lived
  internal token to services.
- Under V2, keep guards, cookies, and CSRF in `presentation/http/`. Put verification and its
  ports in `application/`.
