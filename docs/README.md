# cadenway-api-gateway documentation

Planned role: cadenway-api-gateway is the only API the applications and third-party integrations see (`api.<domain>` behind Traefik). It verifies session tokens and personal API tokens, sets the current organization, limits throughput, routes to the internal services and aggregates their responses (task detail, home, command palette). Local port 3000.

## Current status

The gateway runs on the shared runtime of `@cadenway/nest-common`: validated configuration, JSON
logs, OpenTelemetry, `application/problem+json` errors, the request deadline, the internal token
signer, the public-edge HTTP settings (security headers, cookies, one trusted proxy hop, CORS for
the allowed origins) and the health routes, whose readiness checks Redis. It serves every route
of `openapi/public/auth.yaml`, `organizations.yaml`, `members.yaml` and `api-tokens.yaml` through
the clients of identity-service and organization-service generated from their internal contracts
(phases P2a and P2b of the integration plan). It authenticates the session cookie and the
personal API token by introspecting them on every request, enforces the security requirement and
the organization scope of each operation, and limits each session or token to 600 requests per
minute on Redis, each client address to 60 requests without a credential and 10 failed bearer
tokens per minute. The broker connection with the usage event comes in phase P5. The target
architecture in this guide is what the rest must follow.

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
