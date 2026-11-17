---
description: "Run the local quality gate, stopping at the first failure."
argument-hint: "[optional path to test]"
allowed-tools: Bash(pnpm format:check), Bash(pnpm test:lint), Bash(pnpm lint), Bash(pnpm typecheck), Bash(pnpm test:architecture), Bash(pnpm test *), Bash(pnpm test:integration *), Bash(pnpm test:coverage), Bash(pnpm build), Bash(docker compose -f compose.dev.yaml config -q)
---

Follow the [quality procedure](../../docs/development.md#full-local-quality-gate) from this checkout. Run and report the checks yourself.
With an argument, use the focused test procedure. Otherwise run the full gate in order.
