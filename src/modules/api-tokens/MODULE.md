# Personal API tokens

Owns the routes of `openapi/public/api-tokens.yaml`: create, list and revoke the personal API
tokens of the caller in the current organization of the session. identity-service owns the tokens:
it generates the secret, keeps only its hash and prefix, and decides their validity. The
verification of a bearer token on every route belongs to `auth`.

## Public entry points

This module exposes its HTTP routes. It publishes no TypeScript entry points to other modules.

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

| Public route                         | Internal call                                 |
| ------------------------------------ | --------------------------------------------- |
| `POST /v1/api-tokens`                | `POST /internal/v1/api-tokens`                |
| `GET /v1/api-tokens`                 | `GET /internal/v1/api-tokens`                 |
| `DELETE /v1/api-tokens/{apiTokenId}` | `DELETE /internal/v1/api-tokens/{apiTokenId}` |

## Decisions

- Session only, in the current organization: a token never manages tokens
  (`403 auth.api-token-not-accepted`), and a session without a current organization gets
  `403 organization.not-selected` before any call.
- The secret of a created token leaves the gateway in the body of the creation only; it is never
  logged, and `Location` names the token by its id.
