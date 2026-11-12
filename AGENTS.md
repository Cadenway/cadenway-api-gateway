# waypoint-api-gateway: agent instructions

These instructions are mandatory for every AI assistant working in this repository, whatever the
vendor. [CLAUDE.md](CLAUDE.md) imports them for Claude Code. Explicit user instructions take
precedence over procedures, never over the hard limits below.

This file states the **rules**. See the tooling guides for [Claude Code](.claude/README.md)
and [Codex](.codex/README.md) for agents, skills, commands and hooks.

## First read

- `../waypoint-api-contracts/openapi/public/` for the route you touch, and the internal spec of each service it calls.
- The [repositories document](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N), section "waypoint-api-gateway".
- The `src/aggregates/` folder when the route composes several services.
- `package.json` for versions and scripts once the repository is bootstrapped. Do not restate
  versions elsewhere: a copy goes stale.

## What this repository is

The structure and workflows below describe the bootstrap target. Check the checkout for available files and commands.

waypoint-api-gateway is the only API the applications and third-party integrations see (`api.<domain>` behind Traefik). It verifies session tokens and personal API tokens, sets the current organization, limits throughput, routes to the internal services and aggregates their responses (task detail, home, command palette). Local port 3000.

| Aggregate       | Composed from                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Task detail     | task-service (task) + integration-service (Git links) + storage-service (attachments) + notification-service (reminders) |
| Home            | task-service (my priorities, sprint) + notification-service (mentions, activity)                                         |
| Command palette | search-service                                                                                                           |

Public routes without a session: a list's intake form, newsletter, contact form, GitHub and GitLab webhooks. API token scopes: `tasks:read`, `tasks:write`, `members:read`, `webhooks:manage`.

## Language

- Everything written in the repository is **English**: code, comments, docs, agent prompts, rules,
  skills, commit messages, branch names, PR titles and descriptions.
- Follow the user's language in the conversation only. No emojis.
- Never invent facts about the product, the contracts, the mockup or the tooling: cite the file or
  the document. When something does not exist yet, say so and say which step of the start-up plan
  brings it.

## Architectural ownership

- `src/auth/`: token verification, scopes, organization context.
- `src/rate-limit/`: per-token counters in Redis.
- `src/routes/<resource>/`: one folder per public resource.
- `src/aggregates/`: compositions across services.
- `src/public/`: routes without a session.
- `src/clients/`: clients generated from the internal specs, one per service.

## Boundaries (hard rules)

- No database: Redis only, for rate-limit counters.
- No domain decision: a rule that decides something belongs to the owning service.
- Internal services are reached only through clients generated from `openapi/internal/`; never a hand-written URL.
- Webhooks from GitHub and GitLab are relayed unchanged to waypoint-integration-service, which verifies their signature.
- No sibling sources imported, no `file:` or `link:` dependency.

## GitHub files (`.github/`)

This repository carries everything GitHub reads from it; Waypoint has no organization `.github`
repository and nothing is inherited.

- [`.github/README.md`](.github/README.md) is the repository home page; `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, `PULL_REQUEST_TEMPLATE.md`, `ISSUE_TEMPLATE/` and
  `CODEOWNERS` sit next to it.
- `.github/workflows/` holds this repository's complete CI, release and deploy workflows: no reusable
  workflow from another repository. The Renovate configuration is complete here too, with no shared
  preset.
- The parts shared with the other repositories are duplicated on purpose; a change to them is repeated
  in each repository through its own pull request.

## Commands and quality gates

The scripts below are this repository's contract. While the repository is being bootstrapped,
create them with these exact names; afterwards, use them and never an ad-hoc equivalent. Run the
narrowest check that covers the change first, then widen:

| Changed                         | Minimum check                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------- |
| Routes or aggregates            | `pnpm test src/routes` or `pnpm test src/aggregates`, then the contract tests |
| Auth or rate limit              | `pnpm test:integration auth` or `pnpm test:integration rate-limit`            |
| Any source                      | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`                            |
| Build or runtime configuration  | `pnpm build`, `docker compose -f compose.dev.yaml config -q`                  |
| Docs or agent instructions only | Scoped formatting and link review                                             |

Report the commands you actually ran and their results; a check you did not run is reported as not
run.

## Git and branch flow

- Trunk-based: work branches come from `main`, named `<type>/<lowercase-kebab-description>` with a
  type among `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
  `revert`; put the Waypoint task id first when there is one (`feat/way-482-sso-screen`). Never an
  agent name as a prefix. Validate with `git check-ref-format --branch <name>`.
- Commits and PR titles follow Conventional Commits: `type(scope): subject`, English, imperative,
  lowercase subject, no trailing period, at most 100 characters; `!` only for a breaking change.
- Pull requests target `main` and are squash-merged after review and green CI. release-please opens the release pull request; its merge tags, publishes the image and lets the deploy workflow write the version into waypoint-ops.
- Stage only the files of your task; preserve other people's changes in the working tree.

## Hard limits (never without the user's explicit request in this conversation)

- Never push to `main`, merge into it locally, create or push Git tags, or bump a version by hand.
- Never run a registry publish (`npm publish`, `pnpm publish`): this repository ships as a Docker image built by CI.
- Never force-push, and never amend or rebase commits that are already pushed.
- Never bypass the Git hooks (`--no-verify`, `core.hooksPath` overrides, `ALLOW_MAIN_PUSH=1`,
  `WP_SKIP_PUSH_CHECKS=1`).
- Never write a token, password or private key anywhere; `.npmrc` keeps `${NODE_AUTH_TOKEN}`. Do
  not read or write secret environment files; new variables are documented in `.env.example`.
- Never edit generated trees (`dist/`, `node_modules/`, `coverage/`) or lockfiles by hand.
- Never modify a sibling checkout (`../waypoint-*`) from a task in this repository.

The agent hooks enforce most of these mechanically; a refused command is a signal to stop and ask,
not to find another way around it.

## Agent tooling

- **Claude Code**: [CLAUDE.md](CLAUDE.md) and [.claude/README.md](.claude/README.md): the
  `wp-gw-*` agents, the `/wp-*` commands (`/wp-quality` runs the whole local gate),
  path-scoped rules and hooks.
- **Codex**: [.codex/README.md](.codex/README.md) covers the specialists, `$wp-*` skills, rules and hooks.
- **Builders** (assigned writes): `wp-gw-route-builder`, `wp-gw-aggregate-builder`, `wp-gw-auth-builder`, `wp-gw-public-endpoint-builder`, `wp-gw-client-builder`, `wp-gw-rate-limit-maintainer`, `wp-gw-test-writer`, `wp-gw-deploy-maintainer`, `wp-gw-github-maintainer`.
- **Reviewers** (read-only): `wp-gw-route-explorer`, `wp-gw-contract-reviewer`, `wp-gw-security-auditor`, `wp-gw-performance-reviewer`, `wp-gw-architecture-reviewer`.
- Specialists are available, not mandatory. Delegate a bounded responsibility with explicit files and
  checks, assign disjoint files to parallel agents and integrate their results yourself.

## Repository hygiene

- Reuse existing commands, tools and test infrastructure before adding files.
- Prefer inline commands or a task-specific temporary directory for one-off diagnostics; clean up
  disposable files before delivery.
- Keep a permanent script only when it provides a reusable capability that existing tooling cannot.
- Add permanent tests for meaningful behavior or regressions, in the existing test structure.
- Before delivery, inspect untracked files and remove only the disposable artifacts of the current
  task. Report every new permanent tooling file and why it needs to stay.
- Report material failures, skipped checks and limitations, including non-blocking ones. Ask for
  user input only when a missing decision or authorization blocks the dependent work.

## References

- [Interactive mockup](https://claude.ai/artifact/KYRM7AnsYLiBLBLKy8i4HE), [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et) and
  [repositories and packages](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N) (living documents).
