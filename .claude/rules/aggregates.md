---
paths:
  - 'src/modules/**/application/use-cases/queries/**'
---

# Aggregates

- Keep business decisions in the owning service. Use a capability's
  `application/use-cases/queries/<area>/<operation>/` with its own ports and bind adapters in
  `composition/`. Translate the public contract in `presentation/http/`.
- Follow the [aggregate policy](../../docs/integration.md#an-aggregate) for parallel independent
  calls, explicit timeouts within the route budget, and secondary failures. Flag omitted sections
  as `partial: ['gitLinks']` only where the contract allows it. Otherwise return the contract error.

## Review example

For example, task details and Git links can load in parallel if neither needs the other's result.
Exercise a slow secondary service under the route deadline. If partial output is in the contract,
assert that the missing section is flagged. Exercise a primary-service failure separately.
