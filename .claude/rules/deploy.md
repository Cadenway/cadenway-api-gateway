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
  The one exception is `INTERNAL_TOKEN_PRIVATE_JWK`: no private key is committed, not even a
  development one, so `.env.example` leaves it empty and says how to generate one.
- `deploy/compose.yaml` declares the `environment` entries cadenway-ops lists for the gateway in
  `docs/service-environment.md`; a new entry is released after its variable exists on the hosts.
- The `CMD` preloads the telemetry: `node --experimental-loader=@cadenway/nest-common/hook.mjs
  --import ./dist/telemetry.js dist/main.js`.
- Healthcheck on `/health/ready`; explicit memory limit; non-root user; pinned base image.
- Local port: 3000.
- The private `@cadenway/*` packages reach the image build through the `npmrc` build secret, mounted by the install steps only: never an `ARG`, an `ENV` or a copied file.
