# Billing

## Purpose

Exposes the selected organization's subscription and measured quota usage.

## Public entry point

`GET /v1/billing/subscription` accepts a session and requires a selected organization.
The gateway reads the actor's current membership from Organization and calls Billing only for
an active owner. The signed request context is passed to both generated clients.

Every response carries `Cache-Control: private, no-store`. The public validator projects the
subscription fields. Unavailable baselines and source failures return the documented problems.
