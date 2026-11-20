# Reminders

Provides the eight session-only reminder routes for the selected organization. Notification owns
the reminders and their versions. Task checks each resource under the current user before a
reminder or its note is disclosed or changed.

The list scans pending candidates under one Notification generation, checks visibility in bounded
batches, and verifies the selected records before returning the complete count. Its public cursor
is authenticated and bound to the current account and organization.

## Public entry points

This module exposes its HTTP routes only.
