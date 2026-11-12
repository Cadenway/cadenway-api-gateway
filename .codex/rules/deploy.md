---
paths:
  - 'Dockerfile'
  - 'deploy/**'
  - 'compose.dev.yaml'
  - '.env.example'
---

# Deployment files

- `deploy/compose.yaml` is this gateway's definition for Docker Compose; on each release the deploy
  workflow checks it and copies it into cadenway-ops, as
  `environments/<env>/services/api-gateway.yaml`.
- Exposed through Traefik on `api.<domain>`: the labels live in `deploy/compose.yaml`; it joins both the `edge` (`cadenway-edge-${ENVIRONMENT}`) and `internal` networks.
- Every variable is in `.env.example` with a working local value; secret values live in cadenway-ops (SOPS).
- Healthcheck on `/health/ready`; explicit memory limit; non-root user; pinned base image.
- Local port: 3000.
