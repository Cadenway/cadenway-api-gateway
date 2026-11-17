# cadenway-api-gateway: Claude Code instructions

@AGENTS.md

Start Claude Code in this checkout. See the [tooling guide](.claude/README.md) for specialists,
skills, commands, and hook coverage. Rules without `paths` load at startup. Scoped rules load
when Claude reads matching files. Apply the repository rules across tools and respect hook
refusals. Use `/cw-quality` for the full gate or a focused test selection.

Add `cadenway-api-contracts`, `cadenway-service-kit`,
`cadenway-task-service`, `cadenway-identity-service`, and `cadenway-ops` with `--add-dir` when needed as read-only references.
