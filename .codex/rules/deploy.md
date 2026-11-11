---
paths:
  - 'Dockerfile'
  - 'deploy/**'
  - 'compose.dev.yaml'
  - '.env.example'
---

# Deployment files

- `deploy/compose.yaml` is this gateway's definition for Docker Compose; CI copies it into
  `waypoint-ops/services/api-gateway.yaml` on each release.
- Exposed through Traefik on `api.<domain>`: the labels live in `deploy/compose.yaml`; it joins both the `edge` and `internal` networks.
- Every variable is in `.env.example` with a working local value; secret values live in waypoint-ops (SOPS).
- Healthcheck on `/health/ready`; explicit memory limit; non-root user; pinned base image.
- Local port: 3000.
