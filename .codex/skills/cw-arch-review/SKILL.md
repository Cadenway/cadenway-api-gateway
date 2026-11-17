---
name: cw-arch-review
description: Review boundaries of the current change.
---

Delegate the user's arguments to **cw-gw-architecture-reviewer** if delegation is available and authorized.
Otherwise read and follow `.codex/agents/cw-gw-architecture-reviewer.toml` directly with those arguments.
Do not restate its rules or procedure.

Review ownership at the full capability path. Check that HTTP adapters reach upstreams through
capability-owned ports, that `ClientsModule` exposes technical clients only under V2, and that
aggregates preserve deadlines and partial-response contracts.
