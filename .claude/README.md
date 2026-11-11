# waypoint-api-gateway: Claude Code tooling

This `.claude/` folder ships the Claude Code tooling of waypoint-api-gateway: **14 agents**,
15 slash commands, 10 rules, 13 skills, 3 hooks, the project
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
claude --add-dir ../waypoint-api-contracts ../waypoint-service-kit ../waypoint-task-service
```

Their `.claude/agents/` are discovered too, so their `wp-*` roles become available. Peer checkouts
are **read-only** from a waypoint-api-gateway session (the guard refuses edits there): change them in their
own session and pull request.

## Agents

Builders write only assigned files, inherit permissions and preserve concurrent work. Reviewers are
read-only: their tools exclude `Edit` and `Write`, and they ask the parent for the output of any
check that writes files. No agent delegates further.

| Agent | Responsibility | Model | Effort | Mode |
| --- | --- | --- | --- | --- |
| `wp-gw-route-explorer` | Map a public route end to end. | sonnet | medium | Read-only |
| `wp-gw-route-builder` | Implement a public route from openapi/public. | sonnet | high | Assigned writes |
| `wp-gw-aggregate-builder` | Compose several services into one response. | opus | high | Assigned writes |
| `wp-gw-auth-builder` | Token verification, scopes, organization context. | opus | xhigh | Assigned writes |
| `wp-gw-public-endpoint-builder` | Routes without a session: forms, contact, webhooks. | sonnet | high | Assigned writes |
| `wp-gw-client-builder` | Generated internal clients. | sonnet | medium | Assigned writes |
| `wp-gw-rate-limit-maintainer` | Per-token limits in Redis. | sonnet | medium | Assigned writes |
| `wp-gw-test-writer` | Route, aggregate and contract tests. | sonnet | high | Assigned writes |
| `wp-gw-deploy-maintainer` | Dockerfile, deploy/compose.yaml, Traefik labels. | sonnet | medium | Assigned writes |
| `wp-gw-contract-reviewer` | Public and internal contract fidelity. | opus | high | Read-only |
| `wp-gw-security-auditor` | Auth, scopes, tenant isolation, public routes. | opus | xhigh | Read-only |
| `wp-gw-performance-reviewer` | Fan-out, timeouts, payload size. | sonnet | high | Read-only |
| `wp-gw-architecture-reviewer` | No logic, no data, contract-first. | opus | xhigh | Read-only |
| `wp-gw-github-maintainer` | Workflows, templates and community files in .github/. | sonnet | medium | Assigned writes |

## Commands

| Command | What it does | Runs |
| --- | --- | --- |
| `/wp-explore` | Trace a public route end to end. | `wp-gw-route-explorer` |
| `/wp-route` | Implement a public route from openapi/public. | `wp-gw-route-builder` |
| `/wp-aggregate` | Build or change an aggregate across services. | `wp-gw-aggregate-builder` |
| `/wp-auth` | Change token verification, scopes or organization context. | `wp-gw-auth-builder` |
| `/wp-public` | Build a route without a session (forms, contact, webhooks). | `wp-gw-public-endpoint-builder` |
| `/wp-client` | Add or regenerate an internal service client. | `wp-gw-client-builder` |
| `/wp-rate-limit` | Change rate limits. | `wp-gw-rate-limit-maintainer` |
| `/wp-tests` | Write route, aggregate or contract tests. | `wp-gw-test-writer` |
| `/wp-deploy` | Change deployment files or Traefik labels. | `wp-gw-deploy-maintainer` |
| `/wp-contract-review` | Check routes against the contracts. | `wp-gw-contract-reviewer` |
| `/wp-security-review` | Audit auth, scopes and public routes. | `wp-gw-security-auditor` |
| `/wp-perf-review` | Review fan-out and timeouts. | `wp-gw-performance-reviewer` |
| `/wp-arch-review` | Review boundaries of the current change. | `wp-gw-architecture-reviewer` |
| `/wp-github` | Change workflows, templates or community files in .github/. | `wp-gw-github-maintainer` |
| `/wp-quality` | Run the local quality gate, stopping at the first failure. | runs the commands itself |

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
| `wp-context` | What Waypoint is, where the mockup, the integration guide and the repository map live, the product vocabulary (spaces, lists, sprints, tasks, statuses, milestones) and the multi-repository ownership rules. |
| `wp-gateway-patterns` | How waypoint-api-gateway routes, aggregates and degrades: contract-first public routes, generated internal clients, parallel calls with timeouts, partial responses, error translation. |
| `wp-auth-tokens` | The token types the gateway accepts (session, personal API token), how the organization context and scopes are derived, and the internal token forwarded to services. |

## Hooks

| Hook | When | What it refuses or does |
| --- | --- | --- |
| `guard.mjs` | before `Write`, `Edit` or `MultiEdit` | Sibling checkouts, generated trees, lockfiles, `.git/`, secrets and tokens, hand-written internal URLs and `export *` barrels, unpinned third-party actions and `pull_request_target` in workflows. |
| `guard-git.mjs` | before `Bash` or `PowerShell` | Pushes to `main`, tag pushes, force-pushes, rewrites of pushed commits, hook bypasses, destructive resets, registry publishing, branch names outside `<type>/<kebab>`. Adapted from the dentalstock guard. |
| `format.mjs` | after a successful `Write`, `Edit` or `MultiEdit` | Formats supported files with the repository's Prettier; a no-op until the formatter is installed. |
