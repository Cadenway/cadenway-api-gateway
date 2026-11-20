# Notification preferences

The two session-only account routes read and update notification preferences through the
Notification service. They do not require an organization.

The gateway validates the public patch and response, relays optional version conditions and
returns an ETag for the current version. Notification owns defaults, merging and concurrency.

## Public entry points

This module exposes its HTTP routes only.
