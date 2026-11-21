# Search

## Purpose

Relays authorized command palette queries to Search. Search owns index visibility and continuation decisions.

## Public entry points

None.

## HTTP

`GET /v1/search` requires a verified browser session and organization. The shared rate limit applies.
The route validates the query, forwards the caller's context and returns private, uncacheable pages.

## Dependencies

The generated Search client calls the internal service within the shared request deadline. The
gateway validates the public response and translates permitted problems without upstream content.
