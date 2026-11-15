# cadenway-api-gateway documentation

Planned role: cadenway-api-gateway is the only API the applications and third-party integrations see (`api.<domain>` behind Traefik). It verifies session tokens and personal API tokens, sets the current organization, limits throughput, routes to the internal services and aggregates their responses (task detail, home, command palette). Local port 3000.

## Current status

The gateway runs on the shared runtime of `@cadenway/nest-common`: validated configuration, JSON
logs, OpenTelemetry, `application/problem+json` errors, the request deadline, the internal token
signer, the public-edge HTTP settings (security headers, cookies, one trusted proxy hop, CORS for
the allowed origins) and the health routes, whose readiness checks Redis. It serves the nine routes
of `openapi/public/auth.yaml` (sign-up, sign-in by password or by email code, sign-out,
`GET /v1/me`) through the client of identity-service generated from its internal contract, and
authenticates the session cookie by introspecting it on every request (phase P2a of the
integration plan). The rate limiter comes in phase P2b, the broker connection with the usage event
in phase P5. The target architecture in this guide is what the rest must follow.

## Read the guides

- [Architecture and ownership](architecture.md): boundaries and planned repository structure.
- [Development and checks](development.md): prerequisites, planned commands and verification.
- [Domain and integration](integration.md): repository-specific contracts, behavior and dependencies.

## Sources and policy

- [Repository overview](../.github/README.md) and [contribution guide](../.github/CONTRIBUTING.md).
- [Repository instructions and hard limits](../AGENTS.md).
- [Claude Code instructions](../CLAUDE.md) and [tooling](../.claude/README.md).
- [Codex tooling](../.codex/README.md).
- [Interactive mockup](https://claude.ai/artifact/KYRM7AnsYLiBLBLKy8i4HE), [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et), and [repositories and packages](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N).

Repository instructions take precedence over this summary. Refer to the actual package manifests, implementation, specifications, and workflows once they exist; do not infer a deployed feature from a target design.
