# Development and verification

[Documentation index](README.md) · [Repository overview](../.github/README.md) · [Repository instructions](../AGENTS.md)

## Status

The gateway runs on the shared runtime of `@cadenway/nest-common`, answers the health routes and
serves the routes of `openapi/public/auth.yaml`, `organizations.yaml`, `members.yaml`,
`api-tokens.yaml`, `spaces.yaml`, `lists.yaml`, `tasks.yaml`, `access.yaml`, `archives.yaml` and
`trash.yaml` through the generated clients of
identity-service, organization-service and task-service, with
the per-credential rate limit on Redis (see the [documentation index](README.md)). The scripts and checks below exist in `package.json` and CI.
Run Git, pnpm, build, and test commands with this repository as the working directory, never from
the parent workspace.

## Before making a change

- `../cadenway-api-contracts/openapi/public/` for the route you touch, and the internal spec of each service it calls.
- The [repositories document](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N), section "cadenway-api-gateway".
- The `src/modules/` folder when the route composes several services.
- `package.json` for versions and scripts once the repository is bootstrapped. Do not restate
  versions elsewhere: a copy goes stale.

## Setup

Requirements: Node.js LTS and pnpm (versions in `package.json`), and Docker.

1. Clone this repository next to the other Cadenway repositories, flat, in one folder.
2. To run it with the rest of Cadenway, start the stack from `cadenway-ops`; it builds the sibling
   folders, this one included (`core` profile; `full` adds every other service):

   ```bash
   cd ../cadenway-ops/compose
   docker compose -f compose.yaml -f compose.local.yaml --profile core up -d
   ```

3. To work on this repository alone:

   ```bash
   pnpm install
   cp .env.example .env
   docker compose -f compose.dev.yaml up -d   # Redis, for the rate-limit counters
   pnpm start:dev                             # http://localhost:3000, reads .env
   ```

   The gateway refuses to start until `INTERNAL_TOKEN_PRIVATE_JWK` holds an Ed25519 private key,
   and no key is committed, not even a development one. Generate one from `cadenway-ops`:

   ```bash
   cd ../cadenway-ops/compose
   cp .env.example .env        # once, if it is not there yet: it names compose.local.yaml
   docker compose run --rm internal-token-keys --print
   ```

   It prints a fresh pair per issuer on the terminal and writes nothing. Put the value of
   `API_GATEWAY_INTERNAL_TOKEN_PRIVATE_JWK` into `INTERNAL_TOKEN_PRIVATE_JWK` of `.env`, between
   single quotes.

Every variable is validated at start-up: a missing or invalid one stops the process with a
`ConfigError` that names it and never prints its value, written as one JSON line on the standard
error. `.env.example` describes each of them.

## Minimum checks by change

The scripts below are this repository's contract. While the repository is being bootstrapped,
create them with these exact names; afterwards, use them and never an ad-hoc equivalent. Run the
narrowest check that covers the change first, then widen:

| Changed                         | Minimum check                                                               |
| ------------------------------- | --------------------------------------------------------------------------- |
| Routes or aggregates            | `pnpm test src/modules/<module>`, then the contract tests                   |
| Auth or rate limit              | `pnpm test:integration auth` or `pnpm test:integration rate-limit`          |
| Any source                      | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`                          |
| Build or runtime configuration  | `pnpm build`, `docker compose -f compose.dev.yaml config -q`                |
| Installed `@cadenway/contracts` | `pnpm generate:clients`, then commit `src/clients/generated/` if it changed |
| Docs or agent instructions only | Scoped formatting and link review                                           |

Report the commands you actually ran and their results; a check you did not run is reported as not
run.

## Internal clients

`pnpm generate:clients` runs orval (`orval.config.ts`, the `fetch` client) on the internal specs
the installed `@cadenway/contracts` ships (`specs/openapi/internal/<service>.yaml`) and writes
`src/clients/generated/`. The generated files are committed and never edited by hand; lint, format
and coverage skip them. After an update of `@cadenway/contracts`, run it and commit the result: CI
generates them again and fails when they differ. The authored code of `src/clients/` binds each
generated client to an `InternalHttpClient` of `@cadenway/nest-common` (deadline, one retry on a
connection error or a `503` for an idempotent call, circuit breaker, internal token signed for the
called service) and checks every answer against the zod validators of the contract.

## Full local quality gate

Run the commands below from this repository, in order, and stop at the first failure.
`pnpm quality` runs the package checks other than the integration suite and Compose validation.

```bash
pnpm format:check
pnpm test:lint
pnpm lint
pnpm typecheck
pnpm test:architecture
pnpm test:coverage
pnpm test:integration                    # disposable Redis in Docker, internal services faked over HTTP
pnpm build
docker compose -f compose.dev.yaml config -q
```

For a focused check, use `pnpm test "<path>"` for unit specs and
`pnpm test:integration "<path>"` for integration specs. Run both only when the path covers both
suites. Pass the path as one argument.

Report each command as passed, failed, not run or unavailable. When a test command runs,
include the executed count. Report `0 tests executed` as unverified even if the process exits
successfully. If a required dependency is unavailable, state what it prevented you from checking.

## Collaboration and release

- Trunk-based: work branches come from `main`, named `<type>/<lowercase-kebab-description>` with a
  type among `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
  `revert`; put the Cadenway task id first when there is one (`feat/cad-482-sso-screen`). Never an
  agent name as a prefix. Validate with `git check-ref-format --branch <name>`.
- Commits and PR titles follow Conventional Commits: `type(scope): subject`, English, imperative,
  lowercase subject, no trailing period, at most 100 characters; `!` only for a breaking change.
- Pull requests target `main` and are squash-merged after review and green CI. release-please opens the release pull request; its merge tags, publishes the image and lets the deploy workflow write the version into cadenway-ops.
- Stage only the files of your task; preserve other people's changes in the working tree.

Keep credentials, private keys, decrypted environment files and Terraform state out of documentation and logs. Follow the hard limits in [AGENTS.md](../AGENTS.md); setup instructions do not authorize deployments or changes to real infrastructure.
