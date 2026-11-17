# Git and commits

- Branch from `main`. Only squash-merged PRs enter protected `main`. Never push or merge locally into `main`.
- Branch names use `<type>/<lowercase-kebab-description>`. Types: `feat`, `fix`, `docs`, `style`,
  `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Start the description with the task ID
  when available (e.g. `feat/cad-482-sso-screen`) so Git integration links it. Never use an agent prefix.
- English Conventional Commits and PR titles use `type(scope): subject`. Use a lowercase, imperative
  subject without a trailing period, at most 100 characters for the full line. Use `!` for breaking
  changes only. Put `Refs: CAD-482` or `Fixes: CAD-482` (when the merge completes it) in the body.
- **Versions** are never bumped by hand: release-please derives the next version from the commits and opens the release pull request.
- Never force-push, never amend or rebase a pushed commit, never bypass hooks (`--no-verify`).
