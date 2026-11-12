# Contributing to waypoint-api-gateway

Thank you for helping build Waypoint. This guide covers this repository; the rules that people and AI
assistants follow here are in [AGENTS.md](../AGENTS.md).

## Before you start

- **Link your work to a task.** Every change starts from a Waypoint task (`WAY-482`); its id goes in
  the branch name and in the pull request.
- Routes and events come from `waypoint-api-contracts`; never invent one here.
- What this repository owns, and what it must not touch, is in [AGENTS.md](../AGENTS.md).

## Local setup

Follow [Getting started](README.md#getting-started), then run the checks below before you open a pull request.

## Branches

- `main` is the only long-lived branch. It is protected and receives squash-merged pull requests only.
- Work branches come from `main`: `<type>/<lowercase-kebab-description>`, with the task id first when
  there is one.

  ```text
  feat/way-482-sso-screen
  fix/way-517-status-flicker
  docs/contributing-guide
  ```

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
type(scope): subject in the imperative, lowercase, no trailing period

Why the change is needed, in a few lines.

Refs: WAY-482
```

- English, at most 100 characters on the first line.
- `!` after the type only for a breaking change (`feat(api)!: …`), with a `BREAKING CHANGE:` footer.
- `Fixes: WAY-482` completes the task when the pull request is merged; `Refs: WAY-482` only links it.

## Pull requests

- Target `main`. Keep a pull request focused on one change; split refactors from behavior changes.
- Title in Conventional Commits form: it becomes the squash commit.
- Fill in the [template](PULL_REQUEST_TEMPLATE.md).
- An approving review from a code owner and green CI are required to merge.
- The author merges, with a squash merge, once approved.

## Changes across several repositories

Each repository ships alone. A change that crosses repositories lands in this order, each step only
adding to the previous one:

1. `waypoint-api-contracts`: the spec, then the published packages;
2. the service that produces the data or the event;
3. the gateways and the services that listen;
4. `waypoint-webapp`.

This repository is **step 3**: it exposes or pushes what the services already provide.

Never import another repository's sources and never use a `file:` or `link:` dependency: use the
published `@waypoint/*` packages.

## Checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test src/<area>
pnpm test:integration                    # Redis in Docker, internal services faked
pnpm test:coverage
pnpm build
docker compose -f compose.dev.yaml config -q
```

The checks run in CI on every pull request; report in the pull request the ones you ran locally.

## Releases and deployment

release-please opens a release pull request from the commits; merging it tags the version and
publishes the Docker image. This repository's deploy workflow then writes the version into
`waypoint-ops`: staging automatically, production after the approval of the protected
environment. Never tag, publish or push to `main` by hand.

## GitHub files

Everything under `.github/` belongs to this repository: workflows, templates, code owners and these
guides. The other Waypoint repositories keep their own copies; a change to a shared part (the code of
conduct, the security policy, the templates) is repeated in each of them through its own pull request.

## Security

Never commit a secret, a token or a private key. To report a vulnerability, follow
[SECURITY.md](SECURITY.md); never open a public issue for it.

## Conduct

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).
