# Billing

## Purpose

Exposes the selected organization's subscription and measured quota usage.
Relays Stripe billing deliveries to Billing using their original bytes and signature.

## Public entry point

`GET /v1/billing/subscription` accepts a session and requires a selected organization.
The gateway reads the actor's current membership from Organization and calls Billing only for
an active owner. The signed request context is passed to both generated clients.

`POST /v1/billing/checkout` and `GET /v1/billing/invoices` use the same current-owner
verification for every request, including checkout retries and invoice page requests. Checkout
forwards the validated idempotency key to Billing, which owns the replay and billing decisions.

`POST /v1/billing/webhooks/stripe` is public, uses a separate provider and address
rate limit, and sends one delivery to Billing under a signed system identity. Billing
verifies the signature and commits or rejects the delivery. The gateway does not decode it.

Every response carries `Cache-Control: private, no-store`. The public validator projects the
subscription fields. Unavailable baselines and source failures return the documented problems.
