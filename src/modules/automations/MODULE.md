# Automations

## Purpose

Relays organization automation rules and returns the caller's latest visible executions.
Automation owns rule state and execution. Organization owns current administration and recipient
eligibility. Task owns task visibility.

## Public entry points

- `GET /v1/automations`
- `POST /v1/automations`
- `PATCH /v1/automations/{ruleId}`
- `DELETE /v1/automations/{ruleId}`
- `GET /v1/automation-runs`

## Invariants

- Uses the credential and rate-limit guards with the caller's selected organization. Every
  response is private and carries `Cache-Control: private, no-store`.
- Before creating a rule with a recipient, request current proof from Organization and place the
  exact canonical recipient scope in the signed Automation request. Repeat this check before
  replaying an identical public creation.
- History reads at most 100 ordered candidates, obtains current Task visibility with the same
  caller and returns at most eight visible executions. Hidden tasks are omitted from the result.
  Unavailable evidence fails the request with the documented problem.
- The gateway stores no rules, recipient proofs or execution records.
