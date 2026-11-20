# Documents

## Purpose

Relays the current organization's document operations to Document. The owning service checks current
space access and owns document content and versions.

## Public entry points

None.

## HTTP

The five routes under `/v1/documents` require a verified browser session and organization, the
shared rate limit, and the shared CSRF policy on writes. The public contract defines their body,
preconditions, status codes and private no-store responses.

## Dependencies

Document validates the user's current space authority and owns all mutations and replay. The Gateway
uses its generated internal client and checks the returned body, identifiers and response headers
before publishing the result. No document content is stored in the Gateway.
