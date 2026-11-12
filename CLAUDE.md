# cadenway-api-gateway: Claude Code instructions

> **Source of truth.** This file is the entry point for Claude Code. The normative rules live in
> [AGENTS.md](AGENTS.md), imported below: read it, do not paraphrase it from memory.

@AGENTS.md

> **Read on demand, deliberately not `@`-imported**: `../cadenway-api-contracts/openapi/public/` and `../cadenway-api-contracts/openapi/internal/`, the [repositories document](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N). Importing them would
> cost context in every session. The path-scoped rules in `.claude/rules/` load automatically when
> you open a matching file and carry the few things that must never be got wrong there.

## TL;DR for every task

1. The gateway has no business rule: it authenticates, scopes to the organization, routes, aggregates and limits.
2. Every public route is in `openapi/public/` of the installed `@cadenway/contracts`; every internal call uses the generated client of `openapi/internal/`.
3. The organization comes from the verified token, never from the request body or a header the client chooses.
4. Aggregations tolerate a slow or failing secondary service: explicit timeouts, partial responses where the contract allows them.
5. Rate limit: 600 requests per minute per token, 429 with `Retry-After`; counters in Redis.
6. Strict TypeScript; no `any`; no non-null assertion.

## Boundaries (hard rules)

- No database: Redis only, for rate-limit counters.
- No domain decision: a rule that decides something belongs to the owning service.
- Internal services are reached only through clients generated from `openapi/internal/`; never a hand-written URL.
- Webhooks from GitHub and GitLab are relayed unchanged to cadenway-integration-service, which verifies their signature.
- No sibling sources imported, no `file:` or `link:` dependency.

## Target quality gate

Use the [minimum checks by change](docs/development.md#minimum-checks-by-change) first.
Run `/cw-quality` without arguments for the full local gate when applicable. Report unavailable
checks during bootstrap.

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm test:integration                    # Redis in Docker, internal services faked
pnpm build
docker compose -f compose.dev.yaml config -q
```

## Tooling: this repository ships its own `.claude/`

Open `cadenway-api-gateway/` as the workspace root to activate it. The `cw-gw-*` agents, the `/cw-*`
commands, the skills and the hooks are described in [.claude/README.md](.claude/README.md). Two things
the session listing does not tell you:

- **Rules** in `.claude/rules/` load at session start unless they declare `paths`. Scoped rules
  load when Claude reads a matching file.
- **Hooks** cover the edit and shell tool events matched in `.claude/settings.json`.
  `guard.mjs` refuses edits that break a hard rule
  (generated trees, lockfiles, secrets, sibling checkouts, hand-written internal URLs and `export *` barrels, unpinned third-party actions and `pull_request_target` in workflows), `guard-git.mjs`
  refuses pushes to `main`, tag pushes, force-pushes, rewrites of pushed commits, hook bypasses and
  registry publishing, and `format.mjs` formats supported files when its formatter is available.
  Apply the repository rules across tools. Resolve a refusal without bypassing the hook.

The sibling repositories (`../cadenway-api-contracts`, `../cadenway-service-kit`, `../cadenway-task-service`, `../cadenway-identity-service`, `../cadenway-ops`) are read-only references
from here; add them to the session (`--add-dir`) when a task needs to read them.
