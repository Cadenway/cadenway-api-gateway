# Inbox

## Purpose

Composes the current member's inbox through Notification and verifies current subject visibility
through Task before exposing linked data or forwarding an individual mutation.

## Public entry points

None.

## HTTP

The five session-only routes under `/v1/inbox` require an organization and apply the shared
credential and rate-limit guards. Notification owns the records and their optimistic versions.

## Dependencies

Notification supplies owner-scoped candidates and atomic writes. Task checks each linked subject
and returns requested task display data. Organization resolves names only after authorization.
Unread counts and read-all scan one owner generation, and the read-all cutoff remains fixed across
retries. A missing or hidden linked subject is concealed as `notification.not-found`.
