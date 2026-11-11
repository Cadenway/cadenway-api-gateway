---
name: wp-auth-tokens
description: "The token types the gateway accepts (session, personal API token), how the organization context and scopes are derived, and the internal token forwarded to services. Load it for any auth change."
---

# Tokens and scopes

| Token | Issued by | Carries | Used for |
| --- | --- | --- | --- |
| Session | identity-service (or the chosen identity provider) | user, organization, member role | webapp |
| Personal API token | identity-service | user, organization, scopes | integrations, scripts |
| Internal token | this gateway, short-lived | user, organization, member role, scopes, trace id | calls to services |

- A session token switches organization only through the explicit organization-selection flow.
- Scopes are checked per route; a session token has every scope its member role allows.
