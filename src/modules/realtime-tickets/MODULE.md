# Realtime tickets

## Purpose

Issues one single-use realtime handshake credential for the verified browser session. Identity
owns the credential and validates the current membership and session during issuance.

## Public entry points

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

## API

`POST /v1/realtime/tickets` accepts a required empty JSON object from a browser session with a
selected organization and returns a fresh token and its expiry. It uses the verified session ID
and forwards no client-selected identity. Personal API tokens are refused. The route uses the
shared CSRF and rate-limit guards and disables caching.

## Decisions

Issuance is attempted once. A lost response requires a fresh request. Identity's session-not-found
response becomes `auth.session-expired`, while its current-organization and MFA refusals keep the
public contract codes.
