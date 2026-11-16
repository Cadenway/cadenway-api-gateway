---
description: "Review boundaries of the current change."
argument-hint: "[files]"
---

Delegate to the **cw-gw-architecture-reviewer** subagent: $ARGUMENTS

The agent carries its own procedure and rules; do not restate them.

Review ownership at the full capability path. Check that HTTP adapters reach upstreams through
capability-owned ports, that `ClientsModule` exposes technical clients only under V2, and that
aggregates preserve deadlines and partial-response contracts.
