# Testing

Tests must exercise actual application behavior and assert observable outcomes. Each test should catch a specific application regression.

Do not add tests that merely validate imports, repeat schema literals, or confirm that a dependency can execute a trivial operation. Test validation through application behavior that depends on accepting or rejecting an input.

Use `@effect/vitest` for Effect tests so they integrate with Effect's test services and runtime.
