# Public site forms

## Purpose

Relays anonymous contact and newsletter requests to Notification with independent per-network
limits. Notification owns delivery, subscription state and contact idempotency.

## Routes

`POST /v1/contact-submissions` and `POST /v1/newsletter-subscriptions` validate the published
JSON contracts, ignore credentials and return an empty 202 after Notification accepts the request.
The contact retry key is forwarded unchanged.

## Internal calls

The Notification client signs a system principal for api-gateway and sends no organization.

## State and events

This module stores no state and emits no events.

## Errors

Public errors are reconstructed from the declared codes without retaining submitted values.
