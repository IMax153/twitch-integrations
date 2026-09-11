# 01: Toolchain prep: SQL adapter packages and domain package skeleton

**What to build:** The workspace can build a Connection store against Effect's generic `SqlClient` with a Durable Object adapter in production and a Node SQLite adapter in tests, and a shared domain package exists for other apps to import. Nothing user-visible changes yet; `vp check` and `vp test` stay green.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] A `packages/domain` workspace package exists, extends the base tsconfig, is added to the workspace references, and imports nothing from Cloudflare or Alchemy
- [x] It exports `ProviderName` (spotify or twitch) and `ConnectionStatus` (Not Configured, Authorized, Reauthorization Required) as Effect Schemas
- [x] The api app depends on the domain package and can import those Schemas
- [x] The Durable Object SQLite and Node SQLite `SqlClient` adapter packages are added to the catalog at the workspace's current Effect release (rc.113), and `vp install` resolves exactly one Effect
- [x] The Node SQLite adapter is available for application behavior tests. The trivial-query smoke test requirement was withdrawn during review.
- [x] A short note in the patches README records that the adapter packages are pinned to the workspace Effect release; bumping Effect and Alchemy to their latest releases is out of scope for this feature

## Comments

Implemented on 2026-09-11. Added the domain schemas, workspace references, rc.113 SQL adapter dependencies, and API tests for domain imports and an in-memory query through the generic SqlClient. `vp why effect` confirms one Effect version, 4.0.0-rc.113.

Validation found an existing Access service mismatch. Access now reads `Cloudflare.Worker.Self`, matching the service supplied by the stack. `vp check` passes with the existing require-yield warning in Worker.ts; `vp test` passes all 7 tests.

Review follow-up: removed the toolchain smoke tests as requested. Added guidance to AGENTS.md to test application behavior and use `@effect/vitest` for Effect tests. Both domain schemas now have identifiers matching their names.
