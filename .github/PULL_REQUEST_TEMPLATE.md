<!--
Title: Conventional Commits, for example `feat(tasks): add sprint burndown`. It becomes the squash
commit on main. See .github/CONTRIBUTING.md.
-->

## Task

Fixes: CAD-

<!-- Use `Refs: CAD-…` instead when this pull request does not complete the task. -->

## Summary

<!-- What changes and why, in a few lines. -->

## Checks run

<!-- Tick what you ran locally. A check you did not run stays unticked, with the reason. -->

- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test src/<area>`
- [ ] `pnpm test:integration`
- [ ] `pnpm test:coverage`
- [ ] `pnpm build`
- [ ] `docker compose -f compose.dev.yaml config -q`

## Contracts

- [ ] No change to a route or an event
- [ ] Uses routes or events already published by `cadenway-api-contracts`: <!-- version -->
- [ ] Additive only: every existing consumer keeps working

## Deployment

- [ ] Nothing special
- [ ] New environment variable, documented in `.env.example` and added in `cadenway-ops`
- [ ] Must ship after: <!-- pull requests in other repositories, in order -->
