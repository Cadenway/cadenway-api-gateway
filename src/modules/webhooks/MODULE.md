# Git webhooks

## Purpose

Relays provider deliveries to Integration without authenticating or interpreting their content.

## Public entry points

None. The HTTP controller is composed by this module.

## Routes

`POST /v1/webhooks/github` and `POST /v1/webhooks/gitlab` use their respective per-address rate
limits. Each validates the published query and header shapes and forwards the original JSON bytes.
The provider signature, configured binding and payload are verified by Integration.

## Internal calls

The signed Integration client uses a gateway system actor with no organization. The binding
identifies an Integration configuration and never sets a gateway tenant context.

## Events

None.

## State

This capability owns no persistent state. Integration commits its delivery receipt and work before
acknowledging acceptance.

## Error handling

The public route reconstructs declared errors without provider payloads, credential values or
upstream details.
