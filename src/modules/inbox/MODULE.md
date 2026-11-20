# Inbox

## Purpose

Composes the current member's inbox through Notification and verifies current subject visibility
through Task before exposing linked data or forwarding an individual mutation.

## Public entry points

None.

## HTTP

The five session-only routes under `/v1/inbox` require an organization and apply the shared
credential and rate-limit guards. Notification owns the records and their optimistic versions.
Mutation POSTs without a request body may omit the media type with a valid browser Origin.

## Dependencies

Notification supplies owner-scoped candidates and atomic writes. Task checks each linked subject
and returns requested task display data. Organization resolves names only after authorization.
Unread counts and read-all scan one owner generation, and the read-all cutoff remains fixed across
retries. A missing or hidden linked subject is concealed as `notification.not-found`.

The public cursor encrypts the private scan position, including positions after candidates
the caller cannot see. A separately derived replica-shared key authenticates the envelope
for the verified account, organization and effective Inbox state. A signing-key rotation
invalidates issued cursors. Each page still checks current subject visibility.
