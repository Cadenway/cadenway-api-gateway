---
name: cw-quality
description: Run the local quality gate, stopping at the first failure.
---

Run the gate yourself and report each step. No agent.

**With a test path**, pass the requested path to `pnpm test --` as one argument. Report the result and stop.

**Without an argument**, run in this order and stop at the first failure: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:architecture`, `pnpm test:coverage`, `pnpm test:integration`, `pnpm build`, `docker compose -f compose.dev.yaml config -q`.

A script that does not exist yet is reported as **not available**, never replaced. On a failure, show the output and propose the fix. End with one line per step: PASS, FAIL, not run or not available.
