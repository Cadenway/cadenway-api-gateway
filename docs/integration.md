# Domain and integration

[Documentation index](README.md) · [Repository instructions](../AGENTS.md)

**Status:** This page records the target design from repository instructions and skills. Its behavior has not been verified as implemented in this snapshot.

## Public and internal boundaries

The public route contract is owned by `waypoint-api-contracts`; internal service calls use generated clients. Public unauthenticated routes and aggregate composition are listed in [AGENTS.md](../AGENTS.md). The gateway does not own domain decisions or another service's database.

## Gateway Patterns

Source: `wp-gateway-patterns` ([Claude](../.claude/skills/wp-gateway-patterns/SKILL.md), [Codex](../.codex/skills/wp-gateway-patterns/SKILL.md)).

### An authenticated route

```text
request → auth guard (token) → scope guard → organization context → rate limit
        → controller → internal client(s) → mapping to openapi/public → response
```

### An aggregate

1. Start the calls that do not depend on each other together.
2. Give each a timeout (default 800 ms for secondary parts, the route budget for the main one).
3. If the main service fails, the route fails. If a secondary service fails, omit and flag
   that part when the public contract allows a partial response. Otherwise return the contract-defined error.
4. Map to the public contract; never forward internal shapes.

### Errors

Internal `404` of another organization's resource becomes a public `404`, never `403`: the existence of
another tenant's data is not revealed.

## Auth Tokens

Source: `wp-auth-tokens` ([Claude](../.claude/skills/wp-auth-tokens/SKILL.md), [Codex](../.codex/skills/wp-auth-tokens/SKILL.md)).

| Token              | Issued by                                          | Carries                                           | Used for              |
| ------------------ | -------------------------------------------------- | ------------------------------------------------- | --------------------- |
| Session            | identity-service (or the chosen identity provider) | user, organization, member role                   | webapp                |
| Personal API token | identity-service                                   | user, organization, scopes                        | integrations, scripts |
| Internal token     | this gateway, short-lived                          | user, organization, member role, scopes, trace id | calls to services     |

- A session token switches organization only through the explicit organization-selection flow.
- Scopes are checked per route; a session token has every scope its member role allows.

## References

[Interactive mockup](https://claude.ai/artifact/KYRM7AnsYLiBLBLKy8i4HE), [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et), and [repositories and packages](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N). Use [AGENTS.md](../AGENTS.md) as the local source for ownership and hard limits.
