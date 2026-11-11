---
paths:
  - 'src/aggregates/**'
---

# Aggregates

- Compose, never decide: no business value is computed here.
- Independent calls run in parallel, each with an explicit timeout under the route budget.
- A failing secondary service removes its part and flags it (`partial: ['gitLinks']`) when the
  contract allows partial responses; otherwise the route fails with a clear code.
