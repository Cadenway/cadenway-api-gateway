---
description: "Run the local quality gate, stopping at the first failure."
argument-hint: "[optional path to test]"
allowed-tools: Bash(pnpm format:check), Bash(pnpm lint), Bash(pnpm typecheck), Bash(pnpm test *), Bash(pnpm test:integration *), Bash(pnpm test:coverage), Bash(pnpm build), Bash(docker compose -f compose.dev.yaml config -q)
---

Run the gate yourself and report each step. No agent.

**With a path in `$ARGUMENTS`**, run only `pnpm test $ARGUMENTS` and stop.

**Without an argument**, run in this order and stop at the first failure: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:integration`, `pnpm build`, `docker compose -f compose.dev.yaml config -q`.

A script that does not exist yet is reported as **not available**, never replaced. On a failure, show the output and propose the fix. End with one line per step: PASS, FAIL, not run or not available.
