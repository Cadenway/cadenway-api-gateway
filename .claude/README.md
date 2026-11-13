# cadenway-api-gateway: Claude Code tooling

This `.claude/` folder ships the Claude Code tooling of cadenway-api-gateway: **14 agents**,
15 slash commands, 10 rules, 14 skills, 3 hooks, the project
settings and launch configuration. The application launch requires the planned package scripts.

Start from [AGENTS.md](../AGENTS.md) (the rules every assistant follows) and [CLAUDE.md](../CLAUDE.md)
(the Claude entry point).

## Settings (`settings.json`)

- **Hooks** are wired through `${CLAUDE_PROJECT_DIR}` so they resolve from any working directory:
  `guard.mjs` before every `Write` / `Edit` / `MultiEdit`, `guard-git.mjs` before every `Bash` /
  `PowerShell` command, and `format.mjs` after matching edit events for supported files.
  Apply the repository rules across tools.
- **Permissions** allow specific repository commands and read-only Git commands. The project
  denies `Read` on `.env` and `.env.*`. Follow the repository secret-handling rules across tools.
  The project does not pre-approve `git push`, `gh` writes or arbitrary shell commands.
- **Fast mode is off** (`fastMode: false` and `CLAUDE_CODE_DISABLE_FAST_MODE=1`). Agent models and
  efforts are explicit in each agent's frontmatter; do not silently substitute a model.
- **MCP**: `enabledMcpjsonServers` enables `context7` from the root `.mcp.json`.
- **No plugins** are enabled (`enabledPlugins: {}`). The folder is itself a plugin
  (`.claude-plugin/plugin.json`, `hooks/hooks.json`) for installations outside this checkout.

## Working with the sibling repositories

Start from this checkout and attach the peers you need, for example:

```powershell
claude --add-dir ../cadenway-api-contracts ../cadenway-service-kit ../cadenway-task-service
```

Their `.claude/agents/` are discovered too, so their `cw-*` roles become available. Peer checkouts
are **read-only** from a cadenway-api-gateway session (the guard refuses edits there): change them in their
own session and pull request.

## Agents

Builders write only assigned files, inherit permissions and preserve concurrent work. Reviewers are
read-only: their tools exclude `Edit` and `Write`, and they ask the parent for the output of any
check that writes files. No agent delegates further.

| Agent | Responsibility | Model | Effort | Mode |
| --- | --- | --- | --- | --- |
| `cw-gw-route-explorer` | Map a public route end to end. | sonnet | medium | Read-only |
| `cw-gw-route-builder` | Implement a public route from openapi/public. | sonnet | high | Assigned writes |
| `cw-gw-aggregate-builder` | Compose several services into one response. | opus | high | Assigned writes |
| `cw-gw-auth-builder` | Token verification, scopes, organization context. | opus | xhigh | Assigned writes |
| `cw-gw-public-endpoint-builder` | Routes without a session: forms, contact, webhooks. | sonnet | high | Assigned writes |
| `cw-gw-client-builder` | Generated internal clients. | sonnet | medium | Assigned writes |
| `cw-gw-rate-limit-maintainer` | Per-token limits in Redis. | sonnet | medium | Assigned writes |
| `cw-gw-test-writer` | Route, aggregate and contract tests. | sonnet | high | Assigned writes |
| `cw-gw-deploy-maintainer` | Dockerfile, deploy/compose.yaml, Traefik labels. | sonnet | medium | Assigned writes |
| `cw-gw-contract-reviewer` | Public and internal contract fidelity. | opus | high | Read-only |
| `cw-gw-security-auditor` | Auth, scopes, tenant isolation, public routes. | opus | xhigh | Read-only |
| `cw-gw-performance-reviewer` | Fan-out, timeouts, payload size. | sonnet | high | Read-only |
| `cw-gw-architecture-reviewer` | No logic, no data, contract-first. | opus | xhigh | Read-only |
| `cw-gw-github-maintainer` | Workflows, templates and community files in .github/. | sonnet | medium | Assigned writes |

## Commands

| Command | What it does | Runs |
| --- | --- | --- |
| `/cw-explore` | Trace a public route end to end. | `cw-gw-route-explorer` |
| `/cw-route` | Implement a public route from openapi/public. | `cw-gw-route-builder` |
| `/cw-aggregate` | Build or change an aggregate across services. | `cw-gw-aggregate-builder` |
| `/cw-auth` | Change token verification, scopes or organization context. | `cw-gw-auth-builder` |
| `/cw-public` | Build a route without a session (forms, contact, webhooks). | `cw-gw-public-endpoint-builder` |
| `/cw-client` | Add or regenerate an internal service client. | `cw-gw-client-builder` |
| `/cw-rate-limit` | Change rate limits. | `cw-gw-rate-limit-maintainer` |
| `/cw-tests` | Write route, aggregate or contract tests. | `cw-gw-test-writer` |
| `/cw-deploy` | Change deployment files or Traefik labels. | `cw-gw-deploy-maintainer` |
| `/cw-contract-review` | Check routes against the contracts. | `cw-gw-contract-reviewer` |
| `/cw-security-review` | Audit auth, scopes and public routes. | `cw-gw-security-auditor` |
| `/cw-perf-review` | Review fan-out and timeouts. | `cw-gw-performance-reviewer` |
| `/cw-arch-review` | Review boundaries of the current change. | `cw-gw-architecture-reviewer` |
| `/cw-github` | Change workflows, templates or community files in .github/. | `cw-gw-github-maintainer` |
| `/cw-quality` | Run the local quality gate, stopping at the first failure. | runs the commands itself |

## Rules

| File | Subject | Loads for |
| --- | --- | --- |
| `routes.md` | Public routes | `src/routes/**` |
| `aggregates.md` | Aggregates | `src/aggregates/**` |
| `auth.md` | Authentication and authorization | `src/auth/**` |
| `clients.md` | Internal clients | `src/clients/**` |
| `tests.md` | Tests | `**/*.spec.ts`, `test/**` |
| `deploy.md` | Deployment files | `Dockerfile`, `deploy/**`, `compose.dev.yaml`, `.env.example` |
| `language.md` | Language | always |
| `git-and-commits.md` | Git and commits | always |
| `comments.md` | Comments and docblocks | `src/**/*.ts` |
| `github.md` | GitHub files | `.github/**` |

## Skills

See [skills/](skills/) for the complete inventory, including the technology guides.

| Skill | Use |
| --- | --- |
| `cw-context` | What Cadenway is, where the mockup, the integration guide and the repository map live, the product vocabulary (spaces, lists, sprints, tasks, statuses, milestones) and the multi-repository ownership rules. |
| `cw-gateway-patterns` | How cadenway-api-gateway routes, aggregates and degrades: contract-first public routes, generated internal clients, parallel calls with timeouts, partial responses, error translation. |
| `cw-auth-tokens` | The token types the gateway accepts (session, personal API token), how the organization context and scopes are derived, and the internal token forwarded to services. |
| `cw-logging-and-tracing` | Log fields, redaction, trace propagation, the ESM start-up of OpenTelemetry and the metrics of cadenway-api-gateway. |

## Hooks

| Hook | When | What it refuses or does |
| --- | --- | --- |
| `guard.mjs` | before `Write`, `Edit` or `MultiEdit` | Sibling checkouts, generated trees, lockfiles, `.git/`, secrets and tokens, hand-written internal URLs and `export *` barrels, unpinned third-party actions and `pull_request_target` in workflows. |
| `guard-git.mjs` | before `Bash` or `PowerShell` | Pushes to `main`, tag pushes, force-pushes, rewrites of pushed commits, hook bypasses, destructive resets, registry publishing, branch names outside `<type>/<kebab>`. Adapted from the dentalstock guard. |
| `format.mjs` | after a successful `Write`, `Edit` or `MultiEdit` | Formats supported files with the repository's Prettier; a no-op until the formatter is installed. |
