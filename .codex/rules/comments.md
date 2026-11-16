---
paths:
  - 'src/**/*.ts'
---

# Comments and docblocks

- Use English prose before exported classes, functions, interfaces, type aliases and enums.
  Describe the contract, such as inputs, invariants, side effects, errors or units, where useful.
  Add a comment to a private declaration when it explains a decision that affects maintenance.
- Write JSDoc immediately before the declaration or its first decorator. A short description is
  sufficient when it conveys the contract. Add tags when they explain behavior beyond the signature.
  Use TypeScript modifiers and annotations for access, immutability and types.
- Keep the prescribed member regions. Group adjacent properties, constructors and methods under
  `// #region Properties`, `// #region Constructor` or `// #region Methods`. Getters and setters
  are properties. Put the first docblock after the opener and the closer after the last member.
  Separate documented members by one blank line.
- Keep a single docblock per declaration. Link TODOs to a task ID, remove commented-out code and
  keep inline ESLint configuration disabled. Give tests names that describe observable behavior.

Document authorization, tenant scope, transaction and outbox boundaries, retries, idempotency and
meaningful failures where callers rely on them. Keep personal data and secrets out of comments.
Keep contract examples and documentation synchronized with the guarantees they describe.

```ts
/** Computes the delay in milliseconds before a one-based delivery attempt. */
export function retryDelay(attempt: number): number {
  return attempt * 1000;
}
```
